import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { EmailMessage, EmailProviderInterface } from './email-provider.interface';

/**
 * SMTP email provider used when SMTP_* environment variables are set.
 * Replaces ConsoleEmailProvider without any code changes elsewhere.
 */
@Injectable()
export class SmtpEmailProvider implements EmailProviderInterface {
  private readonly logger = new Logger('Email');
  private transporter: Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
      });
    }
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('SMTP not configured — email not delivered.');
      return;
    }
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'FacilityFlow <no-reply@facilityflow.app>',
      to: message.to,
      subject: message.subject,
      text: message.body,
      html: message.html,
    });
    this.logger.log(`Sent email to ${message.to}`);
  }
}