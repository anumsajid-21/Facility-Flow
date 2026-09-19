import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/decorators/user.decorator";
import { NotificationsService } from "../notifications/notifications.service";

const MESSAGE_INCLUDE_AUDIO = { select: { id: true, mimeType: true } };

@Injectable()
export class MessagingService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  private async accessible(user: AuthUser, id: string) {
    const thread = await this.prisma.messageThread.findUnique({
      where: { id },
      include: { organization: true, provider: true },
    });
    if (!thread) throw new NotFoundException("Message thread not found");
    const allowed =
      user.role === "ADMIN" ||
      (user.role === "HIRING_ORG" && user.hiringOrgId === thread.organizationId) ||
      (user.role === "PROVIDER" && user.providerId === thread.providerId);
    if (!allowed) throw new ForbiddenException("You do not have access to this thread");
    return thread;
  }

  /** A voice attachment must be a real, unused MESSAGE_AUDIO file uploaded by this same user. */
  private async validateAudioFile(fileId: string, userId: string): Promise<void> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.kind !== "MESSAGE_AUDIO" || file.uploadedById !== userId) {
      throw new BadRequestException("Invalid voice recording");
    }
    const alreadyUsed = await this.prisma.message.findFirst({ where: { audioFileId: fileId } });
    if (alreadyUsed) throw new BadRequestException("This voice recording has already been sent");
  }

  async list(user: AuthUser) {
    const where = user.role === "HIRING_ORG"
      ? { organizationId: user.hiringOrgId! }
      : user.role === "PROVIDER"
        ? { providerId: user.providerId! }
        : {};
    const threads = await this.prisma.messageThread.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      include: {
        organization: { select: { id: true, name: true } },
        provider: { select: { id: true, name: true, verificationStatus: true } },
        contract: { select: { id: true, title: true, serviceName: true } },
        serviceRequest: { select: { id: true, title: true } },
        messages: user.role === "ADMIN" ? false : { orderBy: { createdAt: "desc" }, take: 1, include: { sender: { select: { id: true, name: true, role: true, avatarUrl: true } }, audioFile: MESSAGE_INCLUDE_AUDIO } },
        _count: { select: { messages: true } },
      },
    });

    let unread = 0;
    let perThreadUnread = new Map<string, number>();
    if (user.role !== "ADMIN") {
      const unreadMessages = await this.prisma.message.findMany({
        where: { thread: where, senderId: { not: user.userId }, readAt: null },
        select: { threadId: true },
      });
      unread = unreadMessages.length;
      for (const m of unreadMessages) {
        perThreadUnread.set(m.threadId, (perThreadUnread.get(m.threadId) ?? 0) + 1);
      }
    }

    const threadsWithUnread = threads.map((t) => ({ ...t, unreadCount: perThreadUnread.get(t.id) ?? 0 }));
    return { threads: threadsWithUnread, unreadCount: unread };
  }

  async get(user: AuthUser, id: string) {
    await this.accessible(user, id);
    await this.prisma.message.updateMany({
      where: { threadId: id, senderId: { not: user.userId }, readAt: null },
      data: { readAt: new Date() },
    });
    return this.prisma.messageThread.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        provider: { select: { id: true, name: true, verificationStatus: true } },
        contract: true,
        serviceRequest: true,
        messages: user.role === "ADMIN" ? false : { orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true, role: true, avatarUrl: true } }, audioFile: MESSAGE_INCLUDE_AUDIO } },
      },
    });
  }

  async create(user: AuthUser, dto: { providerId: string; organizationId?: string; contractId?: string; serviceRequestId?: string; subject: string; body?: string; audioFileId?: string; audioSeconds?: number }) {
    if (user.role !== "HIRING_ORG" && user.role !== "PROVIDER" && user.role !== "ADMIN") {
      throw new ForbiddenException("Messaging is not available for this role");
    }
    let organizationId = user.hiringOrgId ?? dto.organizationId;
    let providerId = user.providerId ?? dto.providerId;
    if (dto.contractId) {
      const contract = await this.prisma.contract.findUnique({ where: { id: dto.contractId }, select: { organizationId: true, providerId: true } });
      if (!contract) throw new BadRequestException("Contract not found");
      if ((organizationId && organizationId !== contract.organizationId) || (providerId && providerId !== contract.providerId)) throw new ForbiddenException("Contract participants do not match");
      organizationId = contract.organizationId;
      providerId = contract.providerId;
    }
    if (dto.serviceRequestId) {
      const request = await this.prisma.serviceRequest.findUnique({ where: { id: dto.serviceRequestId }, select: { organizationId: true } });
      if (!request) throw new BadRequestException("Service request not found");
      if (organizationId && organizationId !== request.organizationId) throw new ForbiddenException("Request does not belong to this organization");
      organizationId = request.organizationId;
    }
    if (!organizationId || !providerId || !dto.subject?.trim()) throw new BadRequestException("Organization, provider and subject are required");

    if (dto.audioFileId) await this.validateAudioFile(dto.audioFileId, user.userId);
    const hasInitialMessage = !!dto.body?.trim() || !!dto.audioFileId;

    const thread = await this.prisma.messageThread.create({
      data: {
        organizationId,
        providerId,
        contractId: dto.contractId,
        serviceRequestId: dto.serviceRequestId,
        subject: dto.subject.trim(),
        createdById: user.userId,
        messages: hasInitialMessage
          ? { create: { senderId: user.userId, body: dto.body?.trim() ?? "", audioFileId: dto.audioFileId, audioSeconds: dto.audioSeconds } }
          : undefined,
      },
    });
    await this.notifyOtherParty(user, organizationId, providerId, `New message: ${dto.subject}`);
    return this.get(user, thread.id);
  }

  async send(user: AuthUser, threadId: string, dto: { body?: string; audioFileId?: string; audioSeconds?: number }) {
    await this.accessible(user, threadId);
    const body = dto.body?.trim() ?? "";
    if (!body && !dto.audioFileId) throw new BadRequestException("Message body is required");
    if (dto.audioFileId) await this.validateAudioFile(dto.audioFileId, user.userId);

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { threadId, senderId: user.userId, body, audioFileId: dto.audioFileId, audioSeconds: dto.audioSeconds },
        include: { sender: { select: { id: true, name: true, role: true } }, audioFile: MESSAGE_INCLUDE_AUDIO },
      });
      await tx.messageThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date() } });
      return created;
    });
    const thread = await this.prisma.messageThread.findUnique({ where: { id: threadId }, select: { organizationId: true, providerId: true, subject: true } });
    if (thread) await this.notifyOtherParty(user, thread.organizationId, thread.providerId, dto.audioFileId ? `New voice message: ${thread.subject}` : `New reply: ${thread.subject}`);
    return message;
  }

  private async notifyOtherParty(user: AuthUser, organizationId: string, providerId: string, message: string) {
    const where = user.role === "HIRING_ORG" ? { providerId } : { hiringOrgId: organizationId };
    const recipients = await this.prisma.user.findMany({ where, select: { id: true } });
    for (const recipient of recipients) {
      await this.notifications.notify({ userId: recipient.id, type: "MESSAGE_RECEIVED", title: "New message", message });
    }
  }
}
