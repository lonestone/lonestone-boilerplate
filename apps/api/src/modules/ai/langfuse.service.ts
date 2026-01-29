import { LangfuseClient } from '@langfuse/client'
import { createTraceId, getActiveSpanId, getActiveTraceId, startActiveObservation, updateActiveTrace } from '@langfuse/tracing'
import { Injectable, Logger } from '@nestjs/common'
import { generateText, streamText } from 'ai'
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
      this.logger.warn('Langfuse secret key not configured. Telemetry will be disabled.')
    }
  }

  static async createTraceId(seed: string): Promise<string> {
    return createTraceId(seed)
  }

  async getLangfusePrompt(promptName: string, promptLabel?: string, version?: number) {
    const isProduction = config.env === 'production'
    const promptLabelToUse = promptLabel || (isProduction ? 'production' : 'latest')

    return this.langfuseClient?.prompt.get(promptName, {
      version,
      label: promptLabelToUse,
    })
  }

  async executeTracedGeneration(generateOptions: Parameters<typeof generateText>[0], options?: AiGenerateOptions): Promise<ReturnType<typeof generateText>> {
    const traceName = options?.telemetry?.traceName ?? 'ai.generate'

    return startActiveObservation(
      options?.telemetry?.functionId ?? traceName,
      async () => {
        updateActiveTrace({
          name: traceName,
        })

        const result = await generateText(generateOptions)

        // Extract usage information from result
        const usage = result.usage

        const inputTokens = usage?.inputTokens ?? 0
        const outputTokens = usage?.outputTokens ?? 0
        const totalTokens = usage?.totalTokens ?? (inputTokens + outputTokens)

        // /!\ Updates the root with the latest AI call metadata
        updateActiveTrace({
          input: generateOptions.prompt || generateOptions.messages,
          output: result.text,
          ...(usage && {
            usage: {
              input: inputTokens ?? 0,
              output: outputTokens ?? 0,
              total: totalTokens ?? 0,
            },
          }),
          ...(generateOptions.model && { model: generateOptions.model }),
        })

        return result
      },
      {
        parentSpanContext: {
          traceId: getActiveTraceId() ?? '',
          spanId: getActiveSpanId() ?? '',
          traceFlags: 1,
        },
      },
    )
  }

  async executeTracedStreaming(streamOptions: Parameters<typeof streamText>[0], options?: AiGenerateOptions): Promise<ReturnType<typeof streamText>> {
    const traceName = options?.telemetry?.traceName ?? 'ai.streamText'

    return startActiveObservation(
      options?.telemetry?.functionId ?? traceName,
      async (generation) => {
        updateActiveTrace({
          name: traceName,
          ...(streamOptions.model && { model: streamOptions.model }),
        })

        const result = streamText(streamOptions)

        // Update trace asynchronously when stream completes
        // Use promise-based properties that resolve when streaming finishes
        Promise.all([
          result.text,
          result.usage,
          result.finishReason,
        ]).then(([fullText, usage]) => {
          const inputTokens = usage?.inputTokens ?? 0
          const outputTokens = usage?.outputTokens ?? 0
          const totalTokens = usage?.totalTokens ?? (inputTokens + outputTokens)

          updateActiveTrace({
            input: streamOptions.prompt || streamOptions.messages,
            output: fullText,
            ...(usage && {
              usage: {
                input: inputTokens ?? 0,
                output: outputTokens ?? 0,
                total: totalTokens ?? 0,
              },
            }),
          })
          generation.end()
        }).catch((error) => {
          this.logger.error('Error updating trace for streaming', error)
        })
        return result
      },
      {
        parentSpanContext: {
          traceId: getActiveTraceId() ?? '',
          spanId: getActiveSpanId() ?? '',
          traceFlags: 1,
        },
      },
    )
  }
}
