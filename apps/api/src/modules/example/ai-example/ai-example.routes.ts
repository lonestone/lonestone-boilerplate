import { Elysia } from 'elysia'
import { aiModule } from '../../ai/ai.module'
import { AiStreamEvent } from '../../ai/contracts/ai.contract'
import { AuthMacro } from '../../auth/auth.macro'
import {
  ChatMessageWithSchemaType,
  chatRequestSchema,
  chatResponseSchema,
  chatSchemas,
  generateObjectRequestSchema,
  generateObjectResponseSchema,
  generateTextRequestSchema,
  generateTextResponseSchema,
  StreamChatRequest,
  streamChatRequestSchema,
  StreamObjectRequest,
  streamObjectRequestSchema,
  StreamTextRequest,
  streamTextRequestSchema,
} from './ai-example.contract'
import { getCryptoPriceTool } from './tools/coingecko.tools'

export const aiExampleRoutes = new Elysia({ prefix: '/ai' })
  .use(aiModule)
  .use(AuthMacro)
  .derive({ as: 'scoped' }, ({ aiService }) => {
    /**
     * Helper to create a streaming response using Server-Sent Events (SSE).
     */
    const createStreamResponse = (
      body: StreamChatRequest | StreamObjectRequest | StreamTextRequest,
      functionId: string,
    ) => {
      return new ReadableStream({
        async start(controller) {
          const tools = {
            getCryptoPrice: getCryptoPriceTool,
          }

          const abortController = new AbortController()

          const baseOptions = {
            model: body.model,
            tools,
            options: {
              ...body.options,
              telemetry: {
                langfuseTraceName: `${functionId}-at-time-${Date.now()}`,
                functionId,
              },
            },
          }

          const streamInput = 'messages' in body
            ? { ...baseOptions, messages: body.messages }
            : { ...baseOptions, prompt: body.prompt }

          try {
            for await (const event of aiService!.streamTextGenerator(streamInput, abortController.signal)) {
              controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
            }
            controller.close()
          }
          catch (error) {
            const errorEvent: AiStreamEvent = {
              type: 'error',
              message: error instanceof Error ? error.message : 'Unknown error',
            }
            controller.enqueue(`data: ${JSON.stringify(errorEvent)}\n\n`)
            controller.close()
          }
        },
      })
    }
    return {
      createStreamResponse,
    }
  })
  .guard({
    auth: true,
  }, app => app
  // ============================================================================
  // Synchronous Routes
  // ============================================================================

    /**
     * This endpoint uses the API `generateText` endpoint to generate a text.
     */
    .post('/generate-text', async ({ body, aiService, langfuseService }) => {
      if (!aiService || !langfuseService)
        throw new Error('AI Service not initialized')
      const prompt = await langfuseService.getLangfusePrompt('Boilerplate tests')

      const result = await aiService.generateText({
        prompt: body.prompt,
        model: body.model,
        options: {
          ...body.options,
          telemetry: {
            langfuseTraceName: `generate-text-at-time-${Date.now()}`,
            functionId: 'generate-text',
            langfuseOriginalPrompt: prompt.toJSON(),
          },
        },
      })

      return {
        result: result.result,
        usage: result.usage,
        finishReason: result.finishReason,
      }
    }, {
      body: generateTextRequestSchema,
      response: generateTextResponseSchema,
      detail: { tags: ['AI Example'], summary: 'Generate text' },
    })

    /**
     * This endpoint uses the API `generateObject` endpoint to generate a structured output.
     */
    .post('/generate-object', async ({ body, aiService, langfuseService }) => {
      if (!aiService || !langfuseService)
        throw new Error('AI Service not initialized')
      const schema = chatSchemas[body.schemaType]
      const prompt = await langfuseService.getLangfusePrompt('Boilerplate tests')

      const result = await aiService.generateObject({
        prompt: body.prompt,
        schema,
        model: body.model,
        options: {
          ...body.options,
          telemetry: {
            langfuseTraceName: `generate-object-at-time-${Date.now()}`,
            functionId: 'generate-object',
            langfuseOriginalPrompt: prompt.toJSON(),
          },
        },
      })

      return {
        result: result.result,
        usage: result.usage,
        finishReason: result.finishReason,
      }
    }, {
      body: generateObjectRequestSchema,
      response: generateObjectResponseSchema,
      detail: { tags: ['AI Example'], summary: 'Generate structured object' },
    })

    /**
     * This endpoint uses the API `chat` endpoint to handle multi-turn conversations.
     */
    .post('/chat', async ({ body, aiService, langfuseService }) => {
      if (!aiService || !langfuseService)
        throw new Error('AI Service not initialized')
      const schema = body.schemaType && body.schemaType !== 'none' ? chatSchemas[body.schemaType] : undefined

      const tools = {
        getCryptoPrice: getCryptoPriceTool,
      }

      const prompt = await langfuseService.getLangfusePrompt('Boilerplate tests')
      const traceName = `chat-at-time-${Date.now()}`
      const functionId = 'chat'

      const result = await aiService.chat({
        messages: body.messages,
        schema,
        tools,
        model: body.model,
        options: {
          ...body.options,
          telemetry: {
            langfuseTraceName: traceName,
            functionId,
            langfuseOriginalPrompt: prompt.toJSON(),
          },
        },
      })

      const schemaTypeValue = body.schemaType && body.schemaType !== 'none' ? body.schemaType : undefined
      const messagesWithSchemaType = result.messages.map((msg: ChatMessageWithSchemaType, idx: number) => {
        if (idx === result.messages.length - 1 && msg.role === 'assistant' && schemaTypeValue) {
          return { ...msg, metadata: { ...msg.metadata, schemaType: schemaTypeValue } }
        }
        return msg
      })

      return {
        result: result.result,
        messages: messagesWithSchemaType,
        usage: result.usage,
        finishReason: result.finishReason,
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
      }
    }, {
      body: chatRequestSchema,
      response: chatResponseSchema,
      detail: { tags: ['AI Example'], summary: 'Chat with AI' },
    })

  // ============================================================================
  // Streaming Routes
  // ============================================================================

    .post('/stream-text', ({ body, createStreamResponse }) => {
      return createStreamResponse(body, 'stream-text')
    }, {
      body: streamTextRequestSchema,
      detail: { tags: ['AI Example'], summary: 'Stream text generation' },
    })

    .post('/stream-object', ({ body, createStreamResponse }) => {
      return createStreamResponse(body, 'stream-object')
    }, {
      body: streamObjectRequestSchema,
      detail: { tags: ['AI Example'], summary: 'Stream structured object generation' },
    })

    .post('/stream-chat', ({ body, createStreamResponse }) => {
      return createStreamResponse(body, 'stream-chat')
    }, {
      body: streamChatRequestSchema,
      detail: { tags: ['AI Example'], summary: 'Stream chat conversation' },
    }))
