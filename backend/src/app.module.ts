import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FilesModule } from './files/files.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { AssetsModule } from './assets/assets.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { ProvidersModule } from './providers/providers.module';
import { ServiceRequestsModule } from './service-requests/service-requests.module';
import { MatchingModule } from './matching/matching.module';
import { QuotationsModule } from './quotations/quotations.module';
import { ContractsModule } from './contracts/contracts.module';
import { JobsModule } from './jobs/jobs.module';
import { WorkersModule } from './workers/workers.module';
import { ProofOfWorkModule } from './proof-of-work/proof-of-work.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminModule } from './admin/admin.module';
import { SettingsModule } from './settings/settings.module';
import { MessagingModule } from './messaging/messaging.module';
import { SlaModule } from './sla/sla.module';
import { RecurringModule } from './recurring/recurring.module';

@Global()
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  exports: [PassportModule],
})
export class GlobalPassportModule {}

@Module({
  imports: [
    GlobalPassportModule,
    PrismaModule,
    AuditModule,
    NotificationsModule,
    FilesModule,
    AuthModule,
    OrganizationsModule,
    SettingsModule,
    FacilitiesModule,
    AssetsModule,
    ChecklistsModule,
    ProvidersModule,
    ServiceRequestsModule,
    MatchingModule,
    QuotationsModule,
    ContractsModule,
    JobsModule,
    WorkersModule,
    ProofOfWorkModule,
    ApprovalsModule,
    InvoicesModule,
    ReviewsModule,
    AnalyticsModule,
    AdminModule,
    MessagingModule,
    SlaModule,
    RecurringModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
