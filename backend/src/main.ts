import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalGuards(new RateLimitGuard(new Reflector()));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowed = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
  });

  const port = Number(process.env.PORT || 3001);
  await app.listen(port, () => {
    const logger = new Logger('FacilityFlow');
    logger.log(`FacilityFlow backend listening on http://localhost:${port}`);
  });
}
bootstrap();
