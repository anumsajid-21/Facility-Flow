import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: any;
}

/**
 * Records important business operations for auditability:
 *   actor, action, timestamp, entity and relevant change information.
 */
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          details: entry.details ? JSON.stringify(entry.details) : null,
        },
      });
    } catch (err) {
      // Audit must never break the primary operation.
      console.error('Audit log write failed', err);
    }
  }

  async list(filters: { entityType?: string; entityId?: string; actorId?: string }, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType: filters.entityType,
        entityId: filters.entityId,
        actorId: filters.actorId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
  }
}