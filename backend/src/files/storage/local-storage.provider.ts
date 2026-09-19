import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { StorageProviderInterface, StoredFile } from './storage-provider.interface';

/**
 * Stores files on the local filesystem under UPLOAD_ROOT.
 *
 * Keys are opaque and content-addressed (hash + uuid), so paths can never
 * leak user data and are not directly guessable.
 */
@Injectable()
export class LocalStorageProvider implements StorageProviderInterface {
  private root: string;

  constructor() {
    this.root = path.resolve(process.env.UPLOAD_ROOT || './uploads');
    fs.mkdirSync(this.root, { recursive: true });
  }

  async save(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }): Promise<StoredFile> {
    const hash = createHash('sha256').update(file.buffer).digest('hex').slice(0, 16);
    const ext = this.extension(file.originalname, file.mimetype);
    const storageKey = `${hash}-${randomUUID()}${ext}`;
    const abs = path.join(this.root, storageKey);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, file.buffer);
    return {
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  async read(storageKey: string): Promise<{ data: Buffer; mimeType: string }> {
    const abs = path.join(this.root, storageKey);
    const data = await fs.promises.readFile(abs);
    const mimeType =
      path.extname(storageKey) === '.pdf'
        ? 'application/pdf'
        : path.extname(storageKey) === '.png'
          ? 'image/png'
          : path.extname(storageKey) === '.jpg' || path.extname(storageKey) === '.jpeg'
            ? 'image/jpeg'
            : 'application/octet-stream';
    return { data, mimeType };
  }

  async delete(storageKey: string): Promise<void> {
    await fs.promises.rm(path.join(this.root, storageKey), { force: true });
  }

  private extension(original: string, mimetype: string): string {
    const fromName = path.extname(original || '').toLowerCase();
    if (['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx', '.txt', '.webm', '.ogg', '.mp4', '.m4a', '.wav', '.aac'].includes(fromName)) {
      return fromName;
    }
    if (mimetype === 'application/pdf') return '.pdf';
    if (mimetype.includes('png')) return '.png';
    if (mimetype.includes('jpeg') || mimetype.includes('jpg')) return '.jpg';
    if (mimetype.includes('webm')) return '.webm';
    if (mimetype.includes('ogg')) return '.ogg';
    if (mimetype.includes('mp4')) return '.mp4';
    if (mimetype.includes('wav')) return '.wav';
    return '';
  }
}