import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditService } from './audit.service';

/**
 * @Global: any module can inject AuditService without importing this module.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}