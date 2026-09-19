import { Module } from "@nestjs/common";
import { ProofOfWorkController } from "./proof-of-work.controller";
import { ProofOfWorkService } from "./proof-of-work.service";

@Module({
  controllers: [ProofOfWorkController],
  providers: [ProofOfWorkService],
  exports: [ProofOfWorkService],
})
export class ProofOfWorkModule {}
