const crypto = require('crypto');

const { getRequiredEnv } = require('../utils/helpers');

const EXTENSION_BY_MIME_TYPE = {
  'image/bmp': 'bmp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

let s3ClientPromise;

async function getS3Client() {
  if (!s3ClientPromise) {
    s3ClientPromise = import('@aws-sdk/client-s3').then(({ S3Client }) => new S3Client({
      credentials: {
        accessKeyId: getRequiredEnv('AWS_ACCESS_KEY_ID'),
        secretAccessKey: getRequiredEnv('AWS_SECRET_ACCESS_KEY'),
      },
      region: getRequiredEnv('AWS_REGION'),
    }));
  }

  return s3ClientPromise;
}

/**
 * Sube un archivo a S3 y devuelve su URL pública.
 * @param {string} keyPrefix Carpeta lógica dentro del bucket (ej. "profile-photos/42")
 * @param {{ buffer: Buffer, mimetype: string }} file Archivo en memoria (multer)
 */
async function uploadPublicFile(keyPrefix, file) {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await getS3Client();
  const bucket = getRequiredEnv('AWS_S3_BUCKET');
  const extension = EXTENSION_BY_MIME_TYPE[file.mimetype] || 'bin';
  const key = `${keyPrefix}/${crypto.randomUUID()}.${extension}`;

  await client.send(new PutObjectCommand({
    Body: file.buffer,
    Bucket: bucket,
    ContentType: file.mimetype,
    Key: key,
  }));

  const publicBaseUrl = (process.env.AWS_S3_PUBLIC_BASE_URL
    || `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com`).replace(/\/$/, '');

  return `${publicBaseUrl}/${key}`;
}

module.exports = {
  uploadPublicFile,
};
