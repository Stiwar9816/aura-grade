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
        throw new Error('Formato de archivo no compatible. Solo se permiten archivos DOCX.');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Error de Axios: ${error.message} - Estado: ${error.response?.status}`);
        this.logger.error(`Encabezados: ${JSON.stringify(error.response?.headers)}`);
      } else {
        this.logger.error(`Error al extraer el contenido: ${error.message}`);
      }
      throw new InternalServerErrorException(`No se pudo extraer el texto: ${error.message}`);
    }
  }

  async validateAndExtract(url: string): Promise<string> {
    const check = await axios.head(url);
    const contentLengthHeader = check.headers['content-length'];
    const contentLength =
      typeof contentLengthHeader === 'number'
        ? contentLengthHeader
        : parseInt(String(contentLengthHeader ?? '0'), 10);
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
