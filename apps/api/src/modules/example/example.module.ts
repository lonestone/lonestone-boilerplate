import { Module } from '@nestjs/common'
import { config } from '../../config/env.config'
import { AiExampleModule } from './ai-example/ai-example.module'
import { CommentsModule } from './comments/comments.module'
import { DocumentModule } from './documents/document.module'
import { PostModule } from './posts/posts.module'

const optionalExampleModules = config.storage.enabled ? [DocumentModule] : []

// Re-exporting modules for convenience, this allow to delete the single import in app.module.ts to get rid of all the example modules.
@Module({
  imports: [CommentsModule, PostModule, AiExampleModule, ...optionalExampleModules],
  exports: [CommentsModule, PostModule, AiExampleModule, ...optionalExampleModules],
})
export class ExampleModule {}
