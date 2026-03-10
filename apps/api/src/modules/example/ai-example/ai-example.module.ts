import { Module } from '@nestjs/common'
import { AiModule } from '../../ai/ai.module'
import { AiExampleController } from './ai-example.controller'
import { AiExampleUseCasesController } from './ai-example-use-cases.controller'

@Module({
  controllers: [AiExampleController, AiExampleUseCasesController],
  imports: [AiModule],
})
export class AiExampleModule {}
