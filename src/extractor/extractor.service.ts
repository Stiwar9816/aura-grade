import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
// Axios para descargar el archivo
import axios from 'axios';
// mammoth para extraer texto de DOCX
import * as mammoth from 'mammoth';

@Injectable()
export class ExtractorService {
  private readonly logger = new Logger('ExtractorService');

  async extractTextFromUrl(url: string): Promise<string> {
    try {
      // 1. Descargar el archivo como Buffer
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);

      // 2. Determinar el tipo de archivo por la extensión en la URL (limpiando query params)
      const cleanUrl = url.split('?')[0];
      const extension = cleanUrl.split('.').pop()?.toLowerCase();

      if (extension === 'docx') {
        return await this.extractFromDocx(buffer);
      } else {
        throw new Error('Unsupported file format. Only DOCX is allowed.');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Axios error: ${error.message} - Status: ${error.response?.status}`);
        this.logger.error(`Headers: ${JSON.stringify(error.response?.headers)}`);
      } else {
        this.logger.error(`Source extraction error: ${error.message}`);
      }
      throw new InternalServerErrorException(`Failed to extract text: ${error.message}`);
    }
  }

  async validateAndExtract(url: string): Promise<string> {
    const check = await axios.head(url);
    const contentLength = parseInt(check.headers['content-length'], 10);
    const LIMIT_15MB = 15 * 1024 * 1024;

    if (contentLength > LIMIT_15MB) {
      throw new BadRequestException('El archivo en Cloudinary excede los 15MB permitidos.');
    }

    return this.extractTextFromUrl(url);
  }

  private async extractFromDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw error;
    }
  }
}
