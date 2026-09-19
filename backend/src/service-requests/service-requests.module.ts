import { Module } from '@nestjs/common';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';
import { AiAssistService } from './ai-assist.service';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [MatchingModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService, AiAssistService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}