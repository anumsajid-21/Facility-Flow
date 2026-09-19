import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Sanitizes every error before it reaches the client.
 *
 * - Known HTTP exceptions keep their status and a safe message.
 * - Validation errors are reworded into a readable message.
 * - Everything else is logged server-side and returned as a generic
 *   500 response so no stack traces, SQL or internals ever leak.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong. Please try again.';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, any>;
        message = Array.isArray(b.message) ? b.message.join(', ') : b.message || message;
        error = b.error || exception.name;
      }
    } else if (exception && typeof exception === 'object') {
      const e = exception as { name?: string };
      const prismaName = (exception as { code?: string })?.code;
      if (prismaName) {
        status = HttpStatus.BAD_REQUEST;
        message = this.prismaMessage(prismaName);
        error = 'Conflict / Invalid Input';
      } else if (e.name === 'PayloadTooLargeError') {
        status = HttpStatus.PAYLOAD_TOO_LARGE;
        message = 'The upload is too large.';
        error = 'Payload Too Large';
      }
      // Log detailed error server-side only — never send it to the client.
      this.logger.error(JSON.stringify({ type: 'request_error', method: request.method, path: request.url, name: e.name, message: (exception as Error).message, timestamp: new Date().toISOString() }), (exception as Error).stack);
    }

    // 401 for unauthenticated requests
    if (status === HttpStatus.UNAUTHORIZED) {
      if (request.url?.includes('/auth/login') || (typeof exception === 'object' && exception !== null && (exception as any).response?.message === 'Incorrect password or username')) {
        message = 'Incorrect password or username';
      } else {
        message = 'Your session is invalid or has expired. Please sign in again.';
      }
      error = 'Unauthorized';
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private prismaMessage(code: string): string {
    switch (code) {
      case 'P2002':
        return 'This record already exists and cannot be duplicated.';
      case 'P2025':
        return 'The requested record was not found or you do not have access to it.';
      case 'P2003':
        return 'The record is linked to other data and cannot be changed.';
      default:
        return 'The request could not be processed.';
    }
  }
}