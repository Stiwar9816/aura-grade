import { ForbiddenException, ConflictException } from '@nestjs/common';
import { CourseAssistantService } from './course-assistant.service';

function fixture() {
  const source = {
    id: 'v1',
    documentId: 'd1',
    title: 'Guía',
    version: 1,
    format: 'pdf',
    contentHash: 'hash',
    pages: [{ page: 3, text: 'Contenido' }],
  };
  const store = {
    sources: jest.fn().mockResolvedValue([source]),
    progress: jest.fn().mockResolvedValue({ done: 0, total: 1, ordinals: [] }),
    saveBatch: jest.fn(),
    ready: jest.fn().mockResolvedValue(true),
    retrieve: jest
      .fn()
      .mockResolvedValue([
        { ...source, versionId: 'v1', page: 3, text: 'Contenido', similarity: 0.8 },
      ]),
    stillPublished: jest.fn().mockResolvedValue(true),
  };
  const access = { requireStudentCourse: jest.fn().mockResolvedValue({}) };
  const library = { authorize: jest.fn().mockResolvedValue('Docente') };
  const release = jest.fn();
  const budget = { reserve: jest.fn().mockResolvedValue(release) };
  const provider = {
    assertAvailable: jest.fn(),
    embed: jest.fn().mockResolvedValue([Array(768).fill(0.1)]),
    answer: jest.fn().mockResolvedValue({ answer: 'Contenido', citationIds: ['s1'] }),
  };
  const service = new CourseAssistantService(
    store as any,
    access as any,
    library as any,
    budget as any,
    provider as any
  );
  return { service, store, access, library, budget, provider, release };
}
describe('Course assistant authorization and lifecycle', () => {
  it('denies before retrieval, quota or provider for a revoked student', async () => {
    const f = fixture();
    f.access.requireStudentCourse.mockRejectedValue(new ForbiddenException());
    await expect(f.service.ask('c', 'u', 'Consulta')).rejects.toThrow(ForbiddenException);
    expect(f.store.ready).not.toHaveBeenCalled();
    expect(f.budget.reserve).not.toHaveBeenCalled();
    expect(f.provider.embed).not.toHaveBeenCalled();
  });
  it('does not spend API when no complete published index exists', async () => {
    const f = fixture();
    f.store.ready.mockResolvedValue(false);
    expect((await f.service.ask('c', 'u', 'Consulta')).state).toBe('NOT_READY');
    expect(f.provider.embed).not.toHaveBeenCalled();
    expect(f.budget.reserve).not.toHaveBeenCalled();
  });
  it('fails closed when quota cannot be reserved', async () => {
    const f = fixture();
    f.budget.reserve.mockRejectedValue(new Error('Unavailable'));
    await expect(f.service.ask('c', 'u', 'Consulta')).rejects.toThrow();
    expect(f.provider.embed).not.toHaveBeenCalled();
  });
  it('rechecks enrollment after embedding and avoids generation if revoked', async () => {
    const f = fixture();
    f.provider.embed.mockImplementation(async () => {
      f.access.requireStudentCourse.mockRejectedValue(new ForbiddenException());
      return [Array(768).fill(0.1)];
    });
    await expect(f.service.ask('c', 'u', 'Consulta')).rejects.toThrow(ForbiddenException);
    expect(f.provider.answer).not.toHaveBeenCalled();
    expect(f.release).toHaveBeenCalled();
  });
  it('withholds an answer if the source is withdrawn while generating', async () => {
    const f = fixture();
    f.provider.answer.mockImplementation(async () => {
      f.store.stillPublished.mockResolvedValue(false);
      return { answer: 'Texto', citationIds: ['s1'] };
    });
    await expect(f.service.ask('c', 'u', 'Consulta')).rejects.toThrow(ConflictException);
    expect(f.release).toHaveBeenCalled();
  });
  it('returns only server-created citation metadata', async () => {
    const f = fixture();
    const answer = await f.service.ask('c', 'u', 'Consulta');
    expect(answer.state).toBe('ANSWERED');
    expect(answer.citations[0]).toMatchObject({
      id: 's1',
      documentId: 'd1',
      versionId: 'v1',
      page: 3,
    });
    expect(answer.citations[0]).not.toHaveProperty('text');
    expect(f.access.requireStudentCourse.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
  it('rejects invented references and responds without evidence', async () => {
    const f = fixture();
    f.provider.answer.mockResolvedValue({ answer: 'x', citationIds: ['fake'] });
    expect((await f.service.ask('c', 'u', 'Consulta')).state).toBe('NO_EVIDENCE');
  });
  it('does not pay again for a prepared document', async () => {
    const f = fixture();
    f.store.progress.mockResolvedValue({ done: 1, total: 1, ordinals: [0] });
    expect((await f.service.prepare('c', 'u', 'v1')).complete).toBe(true);
    expect(f.provider.embed).not.toHaveBeenCalled();
    expect(f.budget.reserve).not.toHaveBeenCalled();
  });
  it('reports an oversized source separately so other published sources remain visible', async () => {
    const f = fixture();
    const valid = (await f.store.sources())[0];
    f.store.sources.mockResolvedValue([
      valid,
      {
        ...valid,
        id: 'large',
        pages: Array.from({ length: 300 }, (_, i) => ({ page: i + 1, text: 'x'.repeat(1610) })),
      },
    ]);
    const status = await f.service.status('c', 'u');
    expect(status.items).toHaveLength(2);
    expect(status.items[1]).toMatchObject({ error: expect.stringContaining('Divide') });
    expect(status.items[1].complete).toBe(false);
    expect(status.items[0]).not.toHaveProperty('error');
  });
  it('prepares published DOCX extracted text with fragment references when pages are absent', async () => {
    const f = fixture();
    f.store.sources.mockResolvedValue([
      {
        id: 'v1',
        documentId: 'd1',
        title: 'Guía DOCX',
        version: 1,
        format: 'docx',
        contentHash: 'hash',
        pages: [],
        extractedText: 'Contenido oficial '.repeat(200),
      },
    ]);
    f.provider.embed.mockImplementation(async (texts) => texts.map(() => Array(768).fill(0.1)));
    await f.service.prepare('c', 'u', 'v1');
    expect(f.provider.embed).toHaveBeenCalled();
    const chunks = f.store.saveBatch.mock.calls[0][3];
    expect(chunks.map((c) => c.page)).toEqual([1, 2, 3]);
  });
  it('limits a batch, rechecks teacher ownership before persisting', async () => {
    const f = fixture();
    f.provider.embed.mockImplementation(async () => {
      f.library.authorize.mockRejectedValue(new ForbiddenException());
      return [Array(768).fill(0.1)];
    });
    await expect(f.service.prepare('c', 'u', 'v1')).rejects.toThrow(ForbiddenException);
    expect(f.store.saveBatch).not.toHaveBeenCalled();
    expect(f.release).toHaveBeenCalled();
  });
});
