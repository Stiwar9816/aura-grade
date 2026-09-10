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

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30000;

@Injectable()
export class ExtractorService {
  private readonly logger = new Logger('ExtractorService');

  async extractTextFromUrl(url: string): Promise<string> {
    try {
      // 1. Descargar el archivo como Buffer
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: DOWNLOAD_TIMEOUT_MS,
        maxContentLength: MAX_FILE_SIZE,
        maxBodyLength: MAX_FILE_SIZE,
        maxRedirects: 0,
      });
      const buffer = Buffer.from(response.data);
      if (buffer.length === 0 || buffer.length > MAX_FILE_SIZE)
        throw new BadRequestException('El archivo descargado no tiene un tamaño válido.');

      return this.extractFromBuffer(buffer);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (axios.isAxiosError(error)) {
        this.logger.error(`Error de Axios: ${error.message} - Estado: ${error.response?.status}`);
      } else {
        this.logger.error(`Error al extraer el contenido: ${error.message}`);
      }
      throw new InternalServerErrorException('No se pudo extraer el texto del documento.');
    }
  }

  async validateAndExtract(url: string): Promise<string> {
    return this.extractTextFromUrl(url);
  }

  async extractFromBuffer(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    if (!result.value.trim())
      throw new BadRequestException('El documento no contiene texto que se pueda evaluar.');
    return result.value;
  }
}
