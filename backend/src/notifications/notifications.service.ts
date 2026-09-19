import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProviderInterface } from './email/email-provider.interface';
import { ConsoleEmailProvider } from './email/console-email.provider';
import { SmtpEmailProvider } from './email/smtp-email.provider';

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  message?: string;
}

/**
 * In-app notifications + transactional email.
 *
 * The email provider is pluggable (ENV EMAIL_PROVIDER=console|smtp).
 * If email delivery fails, the operation is still committed and the
 * in-app notification still exists — never the reverse.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly emailProvider: EmailProviderInterface;

  constructor(private prisma: PrismaService) {
    this.emailProvider = process.env.EMAIL_PROVIDER === 'smtp' ? new SmtpEmailProvider() : new ConsoleEmailProvider();
  }

  async notify(input: NotifyInput): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to store notification for ${input.userId}`, err as Error);
    }
    this.email(input).catch(() => undefined);
  }

  /** Best-effort email; never blocks or breaks the caller. */
  private async email(input: NotifyInput): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, name: true },
      });
      if (!user) return;
      await this.emailProvider.send({
        to: user.email,
        subject: `[FacilityFlow] ${input.title}`,
        body: `${input.message ?? input.title}\n\n— FacilityFlow`,
      });
    } catch (err) {
      this.logger.warn(`Email for ${input.userId} failed (${(err as Error).message}) — continuing`);
    }
  }

  /** Notify every user belonging to a hiring organization. */
  async notifyOrganization(organizationId: string, input: Omit<NotifyInput, 'userId'>): Promise<void> {
    const members = await this.prisma.user.findMany({ where: { hiringOrgId: organizationId }, select: { id: true } });
    for (const m of members) {
      await this.notify({ ...input, userId: m.id });
    }
  }

  /** Notify every user belonging to a provider. */
  async notifyProvider(providerId: string, input: Omit<NotifyInput, 'userId'>): Promise<void> {
    const users = await this.prisma.user.findMany({ where: { providerId }, select: { id: true } });
    for (const u of users) {
      await this.notify({ ...input, userId: u.id });
    }
  }

  async listForUser(userId: string, limit = 50) {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { notifications, unreadCount };
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}