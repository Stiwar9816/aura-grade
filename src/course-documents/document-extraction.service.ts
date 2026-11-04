import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Worker } from 'worker_threads';

export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
export type DocumentUpload = { originalname: string; mimetype: string; buffer: Buffer };
export type DocumentPage = { page: number; text: string };
export type ExtractedDocument = {
  format: 'pdf' | 'docx';
  state: 'READY' | 'NEEDS_TEXT';
  contentHash: string;
  text: string;
  pages: DocumentPage[];
};

// Isolate untrusted parsers from the HTTP event loop; only package paths and bytes are supplied.
const WORKER_SOURCE = `
const { parentPort, workerData } = require('worker_threads');
(async () => {
  let parser;
  try {
    let text, pages = [];
    if (workerData.format === 'pdf') {
      const { PDFParse } = require(workerData.pdfPath);
      parser = new PDFParse({ data: new Uint8Array(workerData.content), isEvalSupported: false });
      const info = await parser.getInfo();
      if (info.total > 300) throw new Error('too many pages');
      const result = await parser.getText();
      pages = result.pages.map(p => ({ page: p.num, text: p.text.trim() }));
      text = pages.map(p => p.text).join('\\n\\n').trim();
    } else {
      const { hasValidDocxDirectory } = require(workerData.validationPath);
      const buffer = Buffer.from(workerData.content);
      if (!hasValidDocxDirectory(buffer)) throw new Error('invalid DOCX directory');
      const mammoth = require(workerData.docxPath);
      const result = await mammoth.extractRawText({ buffer });
      text = result.value.trim();
    }
    if (text.length > 500000) throw new Error('too much text');
    parentPort.postMessage({ text, pages });
  } catch {
    parentPort.postMessage({ failed: true });
  } finally {
    if (parser) await parser.destroy();
  }
})();`;

@Injectable()
export class DocumentExtractionService {
  async extract(file: DocumentUpload): Promise<ExtractedDocument> {
    const format = file?.originalname?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';
    const validName = file?.originalname && /\.(pdf|docx)$/i.test(file.originalname);
    const validMime =
      format === 'pdf'
        ? file?.mimetype === 'application/pdf'
        : file?.mimetype ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (
      !validName ||
      !validMime ||
      !Buffer.isBuffer(file?.buffer) ||
      !file.buffer.length ||
      file.buffer.length > MAX_DOCUMENT_BYTES
    )
      throw new BadRequestException('Carga un PDF o DOCX válido de hasta 15 MB.');
    if (format === 'pdf' && file.buffer.subarray(0, 5).toString() !== '%PDF-')
      throw new BadRequestException('El contenido no corresponde al formato del documento.');

    const validationPath = require.resolve('../common/helpers/docx-validation');
    const result = await new Promise<{ text: string; pages: DocumentPage[] }>((resolve, reject) => {
      const worker = new Worker(WORKER_SOURCE, {
        eval: true,
        // Source-mode tests/dev need a TS loader; compiled deployments load plain JS.
        execArgv: validationPath.endsWith('.ts')
          ? ['-r', require.resolve('ts-node/register/transpile-only')]
          : [],
        workerData: {
          format,
          content: file.buffer,
          pdfPath: require.resolve('pdf-parse'),
          docxPath: require.resolve('mammoth'),
          validationPath,
        },
        resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 },
      });
      let settled = false;
      const finish = (error?: Error, value?: { text: string; pages: DocumentPage[] }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void worker.terminate();
        if (error) reject(error);
        else resolve(value!);
      };
      const invalid = () =>
        new BadRequestException(
          'No se pudo extraer el documento. Usa un archivo legible, sin contraseña, de hasta 300 páginas y 500000 caracteres.'
        );
      const timer = setTimeout(() => finish(invalid()), 20000);
      worker.once('message', (value) =>
        value.failed ? finish(invalid()) : finish(undefined, value)
      );
      worker.once('error', () => finish(invalid()));
      worker.once('exit', () => {
        if (!settled) finish(invalid());
      });
    });
    return {
      ...result,
      format,
      contentHash: createHash('sha256').update(file.buffer).digest('hex'),
      state: result.text ? 'READY' : 'NEEDS_TEXT',
    };
  }
}
