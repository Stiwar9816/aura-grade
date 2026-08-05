import axios from 'axios';
import * as mammoth from 'mammoth';
import { ExtractorService } from 'src/extractor/extractor.service';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    isAxiosError: jest.fn(),
  },
}));

jest.mock('mammoth', () => ({
  extractRawText: jest.fn(),
}));

describe('ExtractorService', () => {
  const service = new ExtractorService();

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.get as jest.Mock).mockResolvedValue({ data: Buffer.from('docx-content') });
    (mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: 'Texto evaluable' });
  });

  it('downloads DOCX files with bounded size and timeout', async () => {
    await expect(service.extractTextFromUrl('https://example.com/submission.docx')).resolves.toBe(
      'Texto evaluable'
    );

    expect(axios.get).toHaveBeenCalledWith(
      'https://example.com/submission.docx',
      expect.objectContaining({
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 15 * 1024 * 1024,
        maxBodyLength: 15 * 1024 * 1024,
      })
    );
  });

  it('rejects documents without evaluable text', async () => {
    (mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: '   ' });

    await expect(service.extractTextFromUrl('https://example.com/submission.docx')).rejects.toThrow(
      'El documento no contiene texto que se pueda evaluar.'
    );
  });

  it('rejects an empty downloaded file', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: Buffer.alloc(0) });

    await expect(service.extractTextFromUrl('https://example.com/submission.docx')).rejects.toThrow(
      'El archivo descargado no tiene un tamaño válido.'
    );
    expect(mammoth.extractRawText).not.toHaveBeenCalled();
  });
});
