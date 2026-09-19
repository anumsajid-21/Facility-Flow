import { Module } from '@nestjs/common';
import { ProvidersController, ProviderPublicController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { SlaModule } from '../sla/sla.module';

@Module({
  imports: [SlaModule],
  controllers: [ProvidersController, ProviderPublicController],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}