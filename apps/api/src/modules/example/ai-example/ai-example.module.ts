import { Module } from '@nestjs/common'
import { AiModule } from '../../ai/ai.module'
import { AiExampleUseCasesController } from './ai-example-use-cases.controller'
import { AiExampleController } from './ai-example.controller'

@Module({
  controllers: [AiExampleController, AiExampleUseCasesController],
  imports: [AiModule],
})
export class AiExampleModule {}
