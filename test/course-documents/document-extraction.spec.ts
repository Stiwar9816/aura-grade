import { BadRequestException } from '@nestjs/common';
import { DocumentExtractionService } from 'src/course-documents/document-extraction.service';
import { docxFixture, pdfFixture } from './files';
import { hasValidDocxDirectory } from 'src/common/helpers/docx-validation';

describe('official document extraction', () => {
  const service = new DocumentExtractionService();
  it('extracts a real PDF with page references', async () => {
    const result = await service.extract({
      originalname: 'guia.pdf',
      mimetype: 'application/pdf',
      buffer: pdfFixture('Official course guide'),
    });
    expect(result.format).toBe('pdf');
    expect(result.state).toBe('READY');
    expect(result.pages).toEqual([{ page: 1, text: 'Official course guide' }]);
    expect(result.text).toContain('Official course guide');
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('preserves an image-only PDF as NEEDS_TEXT instead of inventing content', async () => {
    const result = await service.extract({
      originalname: 'scan.pdf',
      mimetype: 'application/pdf',
      buffer: pdfFixture(),
    });
    expect(result.state).toBe('NEEDS_TEXT');
    expect(result.text).toBe('');
  });
  it('extracts a real DOCX without inventing page numbers', async () => {
    const result = await service.extract({
      originalname: 'guia.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: await docxFixture(),
    });
    expect(result.text).toBe('Guía oficial del curso');
    expect(result.pages).toEqual([]);
    expect(result.state).toBe('READY');
  });
  it.each(['entry count', 'directory size', 'disk count', 'comment length'])(
    'rejects a DOCX with an inconsistent %s before Mammoth can read unchecked entries',
    async (field) => {
      const buffer = await docxFixture(undefined, true);
      const end = buffer.length - 22;
      if (field === 'entry count') {
        const count = buffer.readUInt16LE(end + 10) - 1;
        buffer.writeUInt16LE(count, end + 8);
        buffer.writeUInt16LE(count, end + 10);
      } else if (field === 'directory size') {
        buffer.writeUInt32LE(buffer.readUInt32LE(end + 12) - 1, end + 12);
      } else if (field === 'disk count') {
        buffer.writeUInt16LE(1, end + 8);
      } else {
        buffer.writeUInt16LE(1, end + 20);
      }
      expect(hasValidDocxDirectory(buffer)).toBe(false);
      await expect(
        service.extract({
          originalname: 'unchecked.docx',
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer,
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  );
  it.each([
    ['fake.pdf', 'application/pdf', Buffer.from('not a pdf')],
    [
      'fake.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      Buffer.from('PK not a document'),
    ],
    ['guide.pdf', 'text/html', pdfFixture('Guide')],
    ['script.exe', 'application/pdf', pdfFixture('Guide')],
    ['empty.pdf', 'application/pdf', Buffer.alloc(0)],
    ['large.pdf', 'application/pdf', Buffer.alloc(15 * 1024 * 1024 + 1)],
  ])('rejects invalid upload %s (%s)', async (originalname, mimetype, buffer) => {
    await expect(service.extract({ originalname, mimetype, buffer })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
