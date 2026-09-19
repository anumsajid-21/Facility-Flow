import { Module } from "@nestjs/common";
import { RecurringController } from "./recurring.controller";
import { RecurringService } from "./recurring.service";
import { SlaModule } from "../sla/sla.module";

@Module({
  imports: [SlaModule],
  controllers: [RecurringController],
  providers: [RecurringService],
  exports: [RecurringService],
})
export class RecurringModule {}
