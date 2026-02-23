import { Elysia } from 'elysia'
import { aiService } from './ai.service'
import { langfuseService } from './langfuse.service'

export const aiModule = new Elysia({ name: 'ai' })
  .use(langfuseService)
  .use(aiService)
  .derive({ as: 'global' }, (context) => {
    return {
      aiService: context.aiService,
      langfuseService: context.langfuseService,
    }
  })
