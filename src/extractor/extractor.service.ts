import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
// Axios para descargar el archivo
import axios from 'axios';
// pdf-parse para extraer texto de PDF
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse');
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

      // 2. Determinar el tipo de archivo por la extensión en la URL
      const extension = url.split('.').pop()?.toLowerCase();

      if (extension === 'pdf') {
        return await this.extractFromPdf(buffer);
      } else if (extension === 'docx') {
        return await this.extractFromDocx(buffer);
      } else {
        throw new Error('Unsupported file format. Only PDF and DOCX are allowed.');
      }
    } catch (error) {
      this.logger.error(`Error extracting text: ${error.message}`);
      throw new InternalServerErrorException('Failed to extract text from document');
    }
  }

  async validateAndExtract(url: string): Promise<string> {
    // 1. Verificar el tamaño real mediante los headers HTTP sin descargar el cuerpo
    const check = await axios.head(url);
    const contentLength = parseInt(check.headers['content-length'], 10);

    const LIMIT_15MB = 15 * 1024 * 1024;

    if (contentLength > LIMIT_15MB) {
      throw new BadRequestException('El archivo en Cloudinary excede los 15MB permitidos.');
    }

    // 2. Si es válido, procedemos a la extracción
    return this.extractTextFromUrl(url);
  }

  private async extractFromPdf(buffer: Buffer): Promise<string> {
    const data = await pdf(buffer);
    return data.text; // Retorn a el texto plano del PDF
  }

  private async extractFromDocx(buffer: Buffer): Promise<string> {
    // mammoth.extractRawText es más rápido y limpio para IA que convertir a HTML
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
}
