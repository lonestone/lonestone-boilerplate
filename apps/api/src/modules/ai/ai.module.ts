import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { LangfuseService } from './langfuse.service'

@Module({
  controllers: [AiController],
  providers: [LangfuseService, AiService],
  exports: [AiService],
})
export class AiModule {}
