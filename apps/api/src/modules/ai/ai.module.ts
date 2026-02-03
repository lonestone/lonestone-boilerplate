import { Module } from '@nestjs/common'
import { AiService } from './ai.service'
import { LangfuseService } from './langfuse.service'

@Module({
  controllers: [],
  providers: [LangfuseService, AiService],
  exports: [AiService, LangfuseService],
})
export class AiModule {}
