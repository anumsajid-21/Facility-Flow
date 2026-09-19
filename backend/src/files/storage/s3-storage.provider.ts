import { createHash, randomUUID } from 'crypto';
import path from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { StorageProviderInterface, StoredFile } from './storage-provider.interface';

/**
 * S3-compatible object storage provider (AWS S3, Cloudflare R2, Backblaze B2,
 * MinIO…). Selected automatically in FilesService when S3_BUCKET is set, so
 * uploads survive ephemeral hosting filesystems (Render, Fly.io, Heroku…).
 *
 * Keys are content-hash + uuid, matching the LocalStorageProvider scheme, so
 * paths are opaque and not directly guessable.
 */
export class S3StorageProvider implements StorageProviderInterface {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error('S3StorageProvider requires S3_BUCKET to be set');
    }
    this.bucket = bucket;
    this.client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      // Custom endpoint => S3-compatible store (R2/MinIO/B2); path-style is
      // required by most of them and harmless for AWS (unused there).
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: !!process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
    });
  }

  async save(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }): Promise<StoredFile> {
    const hash = createHash('sha256').update(file.buffer).digest('hex').slice(0, 16);
    const ext = path.extname(file.originalname || '').toLowerCase();
    const storageKey = `${hash}-${randomUUID()}${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );
    return {
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  async read(storageKey: string): Promise<{ data: Buffer; mimeType: string }> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
    if (!res.Body) {
      throw new Error(`S3 object ${storageKey} has no body`);
    }
    const bytes = await res.Body.transformToByteArray();
    return {
      data: Buffer.from(bytes),
      // Trust our own DB metadata on serve, matching FilesService.read().
      mimeType: res.ContentType || 'application/octet-stream',
    };
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
  }
}
