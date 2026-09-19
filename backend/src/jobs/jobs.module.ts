import { Module } from "@nestjs/common";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { SlaModule } from "../sla/sla.module";

@Module({
  controllers: [JobsController],
  imports: [SlaModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
