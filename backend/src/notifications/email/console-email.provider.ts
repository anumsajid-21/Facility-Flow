import { Injectable, Logger } from '@nestjs/common';
import { EmailMessage, EmailProviderInterface } from './email-provider.interface';

/**
 * Development default: writes emails to the application log.
 * Core functionality never depends on an actual email server.
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProviderInterface {
  private readonly logger = new Logger('Email');

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(
      `\n===== EMAIL TO ${message.to} =====\nSubject: ${message.subject}\n----\n${message.body}\n===== END EMAIL =====`,
    );
  }
}