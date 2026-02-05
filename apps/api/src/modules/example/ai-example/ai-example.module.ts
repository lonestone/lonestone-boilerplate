import { Module } from '@nestjs/common'
import { AiModule } from '../../ai/ai.module'
import { AiExampleController } from './ai-example.controller'

@Module({
  controllers: [AiExampleController],
  imports: [AiModule],
})
export class AiExampleModule {}
