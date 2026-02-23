import { LangfuseClient } from '@langfuse/client'
import { createTraceId, observe, startActiveObservation, updateActiveObservation, updateActiveTrace } from '@langfuse/tracing'
import { trace } from '@opentelemetry/api'
import { generateText, streamText, StreamTextOnErrorCallback, StreamTextOnFinishCallback, ToolSet } from 'ai'
import { Elysia } from 'elysia'
import { config } from '../../config/env.config'
import { AiGenerateOptions } from './contracts/ai.contract'

export const langfuseService = new Elysia({ name: 'Langfuse.Service' })
  .derive({ as: 'scoped' }, () => {
    const logger = console
    let langfuseClient: LangfuseClient | null = null

    if (config.langfuse.secretKey) {
      langfuseClient = new LangfuseClient({
        secretKey: config.langfuse.secretKey,
        publicKey: config.langfuse.publicKey,
        baseUrl: config.langfuse.host,
      })
      logger.log('Langfuse client initialized')
    }
    else {
      logger.warn('Langfuse secret key not configured. All Langfuse services will be disabled')
    }

    const getLangfusePrompt = async (promptName: string, promptLabel?: string, version?: number) => {
      if (!langfuseClient) {
        throw new Error('Langfuse client not initialized')
      }

      const isProduction = config.env === 'production'
      const promptLabelToUse = promptLabel || (isProduction ? 'production' : 'latest')

      return langfuseClient.prompt.get(promptName, {
        version,
        label: promptLabelToUse,
      })
    }

    const executeTracedGeneration = async (generateOptions: Parameters<typeof generateText>[0], options?: AiGenerateOptions): Promise<ReturnType<typeof generateText>> => {
      const traceName = options?.telemetry?.langfuseTraceName ?? 'ai.generate'

      return startActiveObservation(
        options?.telemetry?.functionId ?? traceName,
        async () => {
          updateActiveTrace({
            name: traceName,
            environment: config.env,
            input: generateOptions.prompt || generateOptions.messages,
          })

          const result = await generateText(generateOptions)

          updateActiveTrace({
            output: result.text,
          })

          return result
        },
      )
    }

    const executeTracedStreaming = (streamOptions: Parameters<typeof streamText>[0], options?: AiGenerateOptions): ReturnType<typeof streamText> => {
      const traceName = options?.telemetry?.langfuseTraceName ?? 'ai.streamText'

      const handleOnFinish: StreamTextOnFinishCallback<ToolSet> = async (event) => {
        updateActiveTrace({
          output: event.text,
        })

        trace.getActiveSpan()?.end()

        await streamOptions.onFinish?.(event)
      }

      const handleOnError: StreamTextOnErrorCallback = async (event) => {
        logger.error('Error in streaming', event.error)

        updateActiveObservation({
          output: event.error,
          level: 'ERROR',
        })
      }

      return observe(
        () => {
          updateActiveTrace({
            name: traceName,
            input: streamOptions.prompt || streamOptions.messages,
            environment: config.env,
          })

          return streamText({
            ...streamOptions,
            onFinish: handleOnFinish,
            onError: handleOnError,
          })
        },
        {
          name: options?.telemetry?.functionId ?? traceName,
          endOnExit: false, // Keep observation open until stream completes
        },
      )()
    }

    return {
      langfuseService: {
        getLangfusePrompt,
        executeTracedGeneration,
        executeTracedStreaming,

      },
    }
  })
