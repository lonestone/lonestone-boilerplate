import { Module } from '@nestjs/common'
import { AiExampleModule } from './ai-example/ai-example.module'
import { CommentsModule } from './comments/comments.module'
import { PostModule } from './posts/posts.module'

// Re-exporting modules for convenience, this allow to delete the single import in app.module.ts to get rid of all the example modules.
@Module({
  imports: [CommentsModule, PostModule, AiExampleModule],
  exports: [CommentsModule, PostModule, AiExampleModule],
})
export class ExampleModule {}
