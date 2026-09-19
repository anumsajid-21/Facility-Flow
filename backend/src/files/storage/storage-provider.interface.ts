/**
 * Pluggable object/file storage abstraction.
 *
 * Implementations: LocalStorageProvider (default), and a future S3-compatible
 * provider can implement this interface without touching any business module.
 */
export interface StoredFile {
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface StorageProviderInterface {
  save(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }): Promise<StoredFile>;
  read(storageKey: string): Promise<{ data: Buffer; mimeType: string }>;
  delete(storageKey: string): Promise<void>;
}