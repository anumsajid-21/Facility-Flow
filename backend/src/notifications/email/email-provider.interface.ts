/**
 * Abstraction for sending transactional emails.
 *
 * Implementations are swappable (console log, SMTP, future provider).
 * Email failures must never break core business flows — callers always
 * wrap email delivery in a try/catch.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface EmailProviderInterface {
  send(message: EmailMessage): Promise<void>;
}