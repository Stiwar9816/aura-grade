/** Run in a maintenance window after migrations. Dry-run unless --apply is present. */
import { v2 as cloudinary } from 'cloudinary';
import { IsNull, Not } from 'typeorm';
import { AppDataSource } from '../src/config/datasource.config';
import { Submission } from '../src/submission/entities/submission.entity';

async function main() {
  const apply = process.argv.includes('--apply');
  const cloudName = process.env.CLOUDINARY_NAME;
  if (!cloudName || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)
    throw new Error('Cloudinary no configurado.');
  cloudinary.config({
    cloud_name: cloudName,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  await AppDataSource.initialize();
  let migrated = 0;
  try {
    const repository = AppDataSource.getRepository(Submission);
    const submissions = await repository.find({
      where: { cloudinaryPublicId: IsNull(), fileUrl: Not(IsNull()) },
      select: { id: true, fileUrl: true },
      order: { id: 'ASC' },
    });
    for (const submission of submissions) {
      const url = new URL(submission.fileUrl!);
      const prefix = `/${cloudName}/raw/upload/`;
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'res.cloudinary.com' ||
        !url.pathname.startsWith(prefix)
      )
        throw new Error(`Entrega ${submission.id}: origen no reconocido; revisar manualmente.`);
      const publicId = decodeURIComponent(url.pathname.slice(prefix.length).replace(/^v\d+\//, ''));
      if (!/^auragrade\/submissions\/[a-zA-Z0-9_-]+\.docx$/.test(publicId))
        throw new Error(
          `Entrega ${submission.id}: identificador no reconocido; revisar manualmente.`
        );
      const target = `auragrade/submissions/${submission.id}.docx`;
      if (!apply) {
        console.log(`Pendiente: ${submission.id}`);
        continue;
      }
      let result: { public_id: string; secure_url: string; type?: string; resource_type?: string };
      // Resume safely if Cloudinary succeeded but the previous database update failed.
      try {
        result = await cloudinary.api.resource(target, {
          resource_type: 'raw',
          type: 'authenticated',
        });
      } catch (error) {
        if (
          (error as { error?: { http_code?: number } }).error?.http_code !== 404 &&
          (error as { http_code?: number }).http_code !== 404
        )
          throw new Error(`Entrega ${submission.id}: no se pudo consultar el archivo privado.`);
        result = await cloudinary.uploader.rename(publicId, target, {
          resource_type: 'raw',
          type: 'upload',
          to_type: 'authenticated',
          overwrite: false,
          invalidate: true,
        });
      }
      if (
        result.public_id !== target ||
        result.type !== 'authenticated' ||
        result.resource_type !== 'raw'
      )
        throw new Error(
          `Entrega ${submission.id}: el proveedor no confirmó la protección del documento.`
        );
      await repository.update(
        { id: submission.id, cloudinaryPublicId: IsNull() },
        { cloudinaryPublicId: target, fileUrl: result.secure_url }
      );
      migrated++;
      console.log(`Privatizada: ${submission.id}`);
    }
    console.log(
      apply
        ? `Migradas: ${migrated}. Verificar invalidación CDN de las URLs antiguas antes de abrir el servicio.`
        : `Modo lectura: ${submissions.length} documentos pendientes. --apply modifica Cloudinary y PostgreSQL.`
    );
  } finally {
    await AppDataSource.destroy();
  }
}
main().catch(() => {
  console.error(
    'Migración interrumpida. Revise el último identificador y vuelva a ejecutar; no se imprimen credenciales ni respuestas del proveedor.'
  );
  process.exitCode = 1;
});
