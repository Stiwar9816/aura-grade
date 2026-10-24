import type { INestApplication } from '@nestjs/common';
import { graphqlUploadExpress } from 'graphql-upload-ts';

export function configureGraphqlUploads(app: INestApplication): void {
  // REST multipart endpoints have their own Multer parser; GraphQL must not consume their body.
  app.use('/graphql', graphqlUploadExpress({ maxFileSize: 15 * 1024 * 1024, maxFiles: 1 }));
}
