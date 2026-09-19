import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageProviderInterface } from './storage/storage-provider.interface';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { S3StorageProvider } from './storage/s3-storage.provider';
import { AuthUser } from '../common/decorators/user.decorator';
import { FileKind } from '@prisma/client';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  // Voice messages (recorded via MediaRecorder in supported browsers).
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-m4a',
  'audio/aac',
]);

/**
 * Central file handling: validation, storage, metadata and authorization.
 * Large binary payloads live on disk / object storage — never in PostgreSQL.
 *
 * Storage backend selection: if S3_BUCKET is configured, all files go to the
 * S3-compatible store (required on ephemeral hosts like Render — local disk
 * is wiped on every deploy). Otherwise falls back to local disk for dev.
 */
@Injectable()
export class FilesService {
  private storage: StorageProviderInterface;

  constructor(private prisma: PrismaService) {
    this.storage = process.env.S3_BUCKET
      ? new S3StorageProvider()
      : new LocalStorageProvider();
  }

  validate(file: Express.Multer.File): void {
    if (!file) throw new BadRequestException('No file was uploaded');
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('The file exceeds the 10 MB size limit');
    }
    if (!ALLOWED_MIME.has(file.mimetype) && !file.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('This file type is not allowed');
    }
  }

  async store(file: Express.Multer.File, kind: FileKind, uploadedById?: string) {
    this.validate(file);
    const stored = await this.storage.save({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
    });
    return this.prisma.file.create({
      data: {
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: stored.size,
        storageKey: stored.storageKey,
        kind,
        uploadedById,
      },
    });
  }

  async get(fileId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  /**
   * Enforces tenancy on file downloads by resolving the owning entity.
   * Admin may download anything; otherwise the requester must be the
   * owner of the related service request, provider document, proof of work,
   * or contract the file belongs to.
   */
  async assertAccess(fileId: string, user: AuthUser): Promise<void> {
    if (user.role === 'ADMIN') return;

    const file = await this.get(fileId);

    const providerDoc = await this.prisma.providerDocument.findFirst({
      where: { fileId },
      include: { provider: { select: { id: true } } },
    });
    if (providerDoc) {
      if (user.providerId === providerDoc.provider.id) return;
      throw new ForbiddenException('You do not have access to this file');
    }

    const attachment = await this.prisma.serviceRequestAttachment.findFirst({
      where: { fileId },
      include: { serviceRequest: { select: { organizationId: true } } },
    });
    if (attachment) {
      if (user.hiringOrgId === attachment.serviceRequest.organizationId) return;
      throw new ForbiddenException('You do not have access to this file');
    }

    const inBefore = await this.prisma.file.findFirst({
      where: { id: fileId, beforeProof: { some: {} } },
      include: { beforeProof: { include: { job: { include: { contract: true } } } } },
    });
    const inAfter = await this.prisma.file.findFirst({
      where: { id: fileId, afterProof: { some: {} } },
      include: { afterProof: { include: { job: { include: { contract: true } } } } },
    });
    const owner = inBefore?.beforeProof[0] || inAfter?.afterProof[0];
    if (owner) {
      const contract = owner.job.contract;
      if (user.hiringOrgId === contract.organizationId || user.providerId === contract.providerId) {
        return;
      }
      throw new ForbiddenException('You do not have access to this file');
    }

    const voiceMessage = await this.prisma.message.findFirst({
      where: { audioFileId: fileId },
      include: { thread: { select: { organizationId: true, providerId: true } } },
    });
    if (voiceMessage) {
      if (user.hiringOrgId === voiceMessage.thread.organizationId || user.providerId === voiceMessage.thread.providerId) {
        return;
      }
      throw new ForbiddenException('You do not have access to this file');
    }

    // Unknown/other file kinds: only the uploader or an admin.
    if (file.uploadedById === user.userId) return;
    throw new ForbiddenException('You do not have access to this file');
  }

  async read(fileId: string) {
    const file = await this.get(fileId);
    const res = await this.storage.read(file.storageKey);
    return {
      data: res.data,
      mimeType: file.mimeType || res.mimeType,
      originalName: file.originalName,
    };
  }

  async remove(fileId: string): Promise<void> {
    const file = await this.get(fileId);
    await this.storage.delete(file.storageKey).catch(() => undefined);
    await this.prisma.file.delete({ where: { id: fileId } });
  }
}