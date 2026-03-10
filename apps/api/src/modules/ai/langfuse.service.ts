import { LangfuseClient } from '@langfuse/client'
import {
  createTraceId,
  observe,
  propagateAttributes,
  startActiveObservation,
  updateActiveObservation,
  updateActiveTrace,
} from '@langfuse/tracing'
import { Injectable, Logger } from '@nestjs/common'
import { SpanContext, trace } from '@opentelemetry/api'
import { generateText, streamText, StreamTextOnErrorCallback, StreamTextOnFinishCallback, ToolSet } from 'ai'
import { config } from '../../config/env.config'
import { AiGenerateOptions } from './contracts/ai.contract'

/** Attributes for the active (root) trace. Call this when you want to set name/output after the fact (e.g. single generation or after a group of LLM calls). */
export interface FinalizeTraceInput {
  name?: string
  input?: unknown
  output?: unknown
  metadata?: Record<string, unknown>
  sessionId?: string
}

function toPropagateMetadata(metadata: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!metadata || Object.keys(metadata).length === 0) return undefined
  return Object.fromEntries(
    Object.entries(metadata).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
  )
}

@Injectable()
export class LangfuseService {
  private static readonly SPLIT_PARENT_SPAN_ID = '0123456789abcdef'
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

  /**
   * Set root-trace attributes (name, input, output, metadata, sessionId) on the currently active trace.
   * Call this when you want to name the trace or set input/output after the fact (e.g. single REST call with one generation, or after a group of LLM calls).
   */
  finalizeTrace({ name, input, output, metadata, sessionId }: FinalizeTraceInput): void {
    updateActiveTrace({
      ...(name && { name }),
      ...(input !== undefined && { input }),
      ...(output !== undefined && { output }),
      ...(metadata && { metadata }),
      ...(sessionId && { sessionId }),
      environment: config.env,
    })
  }

  /** @deprecated Use finalizeTrace instead. */
  updateRootTrace(attrs: FinalizeTraceInput): void {
    this.finalizeTrace(attrs)
  }

  private getParentSpanContext(traceId?: string): SpanContext | undefined {
    if (!traceId) {
      return undefined
    }

    return {
      traceId,
      spanId: LangfuseService.SPLIT_PARENT_SPAN_ID,
      traceFlags: 1,
    }
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

  async executeTracedGeneration(
    generateOptions: Parameters<typeof generateText>[0],
    options?: AiGenerateOptions,
    traceId?: string,
  ): Promise<ReturnType<typeof generateText>> {
    const traceName = options?.telemetry?.traceName ?? 'ai.generate'
    const spanName = options?.telemetry?.spanName ?? traceName
    const metadata = {
      ...(options?.metadata ?? {}),
      ...(options?.telemetry?.metadata ?? {}),
    }
    const propagateMeta = toPropagateMetadata(Object.keys(metadata).length > 0 ? metadata : undefined)

    return propagateAttributes(
      {
        traceName,
        sessionId: options?.telemetry?.sessionId,
        metadata: propagateMeta,
      },
      async () =>
        startActiveObservation(
          spanName,
          async () => {
            this.finalizeTrace({
              name: traceName,
              input: generateOptions.prompt || generateOptions.messages,
              metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
              sessionId: options?.telemetry?.sessionId,
            })
            const result = await generateText(generateOptions)
            this.finalizeTrace({ output: result.text })
            return result
          },
          {
            parentSpanContext: this.getParentSpanContext(traceId),
          },
        ),
    )
  }

  executeTracedStreaming(
    streamOptions: Parameters<typeof streamText>[0],
    options?: AiGenerateOptions,
    traceId?: string,
  ): ReturnType<typeof streamText> {
    const traceName = options?.telemetry?.traceName ?? 'ai.streamText'
    const spanName = options?.telemetry?.spanName ?? traceName
    const metadata = {
      ...(options?.metadata ?? {}),
      ...(options?.telemetry?.metadata ?? {}),
    }
    const logger = this.logger

    const handleOnFinish: StreamTextOnFinishCallback<ToolSet> = async (event) => {
      this.finalizeTrace({ output: event.text })

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

    const propagateMeta = toPropagateMetadata(Object.keys(metadata).length > 0 ? metadata : undefined)

    return propagateAttributes(
      {
        traceName,
        sessionId: options?.telemetry?.sessionId,
        metadata: propagateMeta,
      },
      () =>
        observe(
          () => {
            this.finalizeTrace({
              name: traceName,
              input: streamOptions.prompt || streamOptions.messages,
              metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
              sessionId: options?.telemetry?.sessionId,
            })

            return streamText({
              ...streamOptions,
              onFinish: handleOnFinish,
              onError: handleOnError,
            })
          },
          {
            name: spanName,
            endOnExit: false, // Keep observation open until stream completes
            parentSpanContext: this.getParentSpanContext(traceId),
          },
        )(),
    )
  }
}
