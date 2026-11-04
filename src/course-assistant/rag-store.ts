import { expandContext } from './rag-context';
import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Chunk, EMBEDDING_MODEL, INDEX_REVISION, normalizedVector } from './rag-content';
export type Source = {
  extractedText?: string;
  id: string;
  documentId: string;
  title: string;
  version: number;
  format: 'pdf' | 'docx';
  contentHash: string;
  publishedAt: string;
  pages: { page: number; text: string }[];
};
export type Hit = {
  ordinal: number;
  versionId: string;
  documentId: string;
  title: string;
  version: number;
  format: 'pdf' | 'docx';
  publishedAt: string;
  page: number;
  text: string;
  similarity: number;
};
const live = `v.status = 'PUBLISHED' AND v.reviewed_at IS NOT NULL AND v.extraction_state = 'READY'`;
@Injectable()
export class RagStore {
  constructor(private readonly db: DataSource) {}
  sources(courseId: string): Promise<Source[]> {
    return this.db.query(
      `SELECT v.id, d.id AS "documentId", d.title, v.version, v.format,
      v.content_hash AS "contentHash", v.published_at::text AS "publishedAt", v.pages, CASE WHEN v.format='docx' THEN v.extracted_text ELSE '' END AS "extractedText"
      FROM course_document_versions v JOIN course_documents d ON d.id = v.document_id
      WHERE d.course_id = $1 AND ${live} ORDER BY d.created_at, v.id`,
      [courseId]
    );
  }
  async progress(source: Source, total: number) {
    const rows = await this.db.query(
      `SELECT c.ordinal FROM course_rag_indexes i
      JOIN course_rag_chunks c ON c.version_id = i.version_id
      WHERE i.version_id=$1 AND i.content_hash=$2 AND i.model=$3 AND i.revision=$4 AND i.total=$5`,
      [source.id, source.contentHash, EMBEDDING_MODEL, INDEX_REVISION, total]
    );
    return { total, done: rows.length, ordinals: rows.map((r) => r.ordinal as number) };
  }
  async saveBatch(
    courseId: string,
    source: Source,
    total: number,
    batch: Chunk[],
    vectors: number[][]
  ) {
    // Lock the same parent as publication/withdrawal; no HTTP calls under database locks.
    await this.db.transaction(async (manager) => {
      await manager.query(
        'SELECT id FROM course_documents WHERE id=$1 AND course_id=$2 FOR UPDATE',
        [source.documentId, courseId]
      );
      const [current] = await manager.query(
        `SELECT v.id FROM course_document_versions v
        WHERE v.id=$1 AND v.document_id=$2 AND ${live} AND v.content_hash=$3 AND v.published_at::text=$4 FOR UPDATE`,
        [source.id, source.documentId, source.contentHash, source.publishedAt]
      );
      if (!current) throw new ConflictException('La publicación cambió. Actualiza las fuentes.');
      await manager.query(
        `DELETE FROM course_rag_indexes WHERE version_id=$1 AND
        (content_hash<>$2 OR model<>$3 OR revision<>$4 OR total<>$5)`,
        [source.id, source.contentHash, EMBEDDING_MODEL, INDEX_REVISION, total]
      );
      await manager.query(
        `INSERT INTO course_rag_indexes(version_id,content_hash,model,revision,total)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [source.id, source.contentHash, EMBEDDING_MODEL, INDEX_REVISION, total]
      );
      for (let i = 0; i < batch.length; i++) {
        const c = batch[i];
        await manager.query(
          `INSERT INTO course_rag_chunks(version_id,ordinal,page,content,embedding)
          VALUES($1,$2,$3,$4,$5::vector) ON CONFLICT DO NOTHING`,
          [source.id, c.ordinal, c.page, c.text, JSON.stringify(normalizedVector(vectors[i]))]
        );
      }
    });
  }
  async ready(courseId: string): Promise<boolean> {
    const [r] = await this.db.query(
      `SELECT count(*)::int AS total,
      count(*) FILTER (WHERE i.version_id IS NOT NULL AND
        i.total=(SELECT count(*) FROM course_rag_chunks c WHERE c.version_id=i.version_id))::int AS ready
      FROM course_document_versions v JOIN course_documents d ON d.id=v.document_id
      LEFT JOIN course_rag_indexes i ON i.version_id=v.id AND i.content_hash=v.content_hash AND i.model=$2 AND i.revision=$3
      WHERE d.course_id=$1 AND ${live}`,
      [courseId, EMBEDDING_MODEL, INDEX_REVISION]
    );
    return r.total > 0 && r.ready === r.total;
  }
  async retrieve(courseId: string, vector: number[], question = ''): Promise<Hit[]> {
    const activity = question.match(/\bactividad\s+(\d{1,3})\b/i)?.[1];
    const pattern = activity ? `ACTIVIDAD[[:space:]]+${Number(activity)}([^0-9]|$)` : null;
    const select = `SELECT v.id AS "versionId", d.id AS "documentId", d.title, v.version, v.format,
      v.published_at::text AS "publishedAt", c.ordinal, c.page, c.content AS text,
      1-(c.embedding <=> $2::vector) AS similarity
      FROM course_rag_chunks c JOIN course_rag_indexes i ON i.version_id=c.version_id
      JOIN course_document_versions v ON v.id=i.version_id JOIN course_documents d ON d.id=v.document_id
      WHERE d.course_id=$1 AND ${live} AND i.model=$3 AND i.revision=$4 AND i.content_hash=v.content_hash
        AND i.total=(SELECT count(*) FROM course_rag_chunks z WHERE z.version_id=i.version_id)`;
    const args = [
      courseId,
      JSON.stringify(normalizedVector(vector)),
      EMBEDDING_MODEL,
      INDEX_REVISION,
    ];
    const anchors: Hit[] = await this.db.query(
      `${select}
      ORDER BY CASE WHEN $5::text IS NOT NULL AND c.content ~* $5 THEN 0 ELSE 1 END,
      c.embedding <=> $2::vector, c.version_id, c.ordinal LIMIT 3`,
      [...args, pattern]
    );
    if (!anchors.length) return [];
    const neighbors: Hit[] = await this.db.query(
      `${select} AND (c.version_id,c.ordinal) IN
      (SELECT * FROM unnest($5::uuid[],$6::integer[]))`,
      [...args, anchors.map((a) => a.versionId), anchors.map((a) => a.ordinal + 1)]
    );
    return expandContext(anchors, neighbors);
  }
  async stillPublished(courseId: string, hits: Hit[]) {
    const versions = [...new Map(hits.map((h) => [h.versionId, h.publishedAt])).entries()];
    const rows = await this.db.query(
      `SELECT v.id, v.published_at::text AS stamp
      FROM course_document_versions v JOIN course_documents d ON d.id=v.document_id
      WHERE d.course_id=$1 AND v.id=ANY($2::uuid[]) AND ${live}`,
      [courseId, versions.map((v) => v[0])]
    );
    return versions.every(([id, stamp]) => rows.some((r) => r.id === id && r.stamp === stamp));
  }
}
