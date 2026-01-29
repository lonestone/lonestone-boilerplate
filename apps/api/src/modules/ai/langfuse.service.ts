import { LangfuseClient } from '@langfuse/client'
import { getActiveSpanId, getActiveTraceId, startActiveObservation, updateActiveTrace } from '@langfuse/tracing'
import { Injectable, Logger } from '@nestjs/common'
import { generateText } from 'ai'
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
    const { createTraceId } = await import('@langfuse/tracing')
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
}
