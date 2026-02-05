import { LangfuseClient } from '@langfuse/client'
import { createTraceId, observe, startActiveObservation, updateActiveObservation, updateActiveTrace } from '@langfuse/tracing'
import { Injectable, Logger } from '@nestjs/common'
import { trace } from '@opentelemetry/api'
import { generateText, streamText, StreamTextOnErrorCallback, StreamTextOnFinishCallback, ToolSet } from 'ai'
import { config } from '../../config/env.config'
import { AiGenerateOptions } from './contracts/ai.contract'

@Injectable()
export class LangfuseService {
  private readonly logger = new Logger(LangfuseService.name)
  private readonly langfuseClient: LangfuseClient | null = null

  constructor() {
    if (config.langfuse.secretKey) {
      this.langfuseClient = new LangfuseClient({
        secretKey: config.langfuse.secretKey,
        publicKey: config.langfuse.publicKey,
        baseUrl: config.langfuse.host,
      })
      this.logger.log('Langfuse client initialized')
    }
    else {
      this.logger.warn('Langfuse secret key not configured. All Langfuse services will be disabled')
    }
  }

  static async createTraceId(seed: string): Promise<string> {
    return createTraceId(seed)
  }

  async getLangfusePrompt(promptName: string, promptLabel?: string, version?: number) {
    if (!this.langfuseClient) {
      throw new Error('Langfuse client not initialized')
    }

    const isProduction = config.env === 'production'
    const promptLabelToUse = promptLabel || (isProduction ? 'production' : 'latest')

    return this.langfuseClient.prompt.get(promptName, {
      version,
      label: promptLabelToUse,
    })
  }

  async executeTracedGeneration(generateOptions: Parameters<typeof generateText>[0], options?: AiGenerateOptions): Promise<ReturnType<typeof generateText>> {
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

  executeTracedStreaming(streamOptions: Parameters<typeof streamText>[0], options?: AiGenerateOptions): ReturnType<typeof streamText> {
    const traceName = options?.telemetry?.langfuseTraceName ?? 'ai.streamText'
    const logger = this.logger

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
}
