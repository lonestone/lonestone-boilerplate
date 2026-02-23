import type { AiGenerateOptions, TokenUsage } from './contracts/ai.contract'
import { createTraceId } from '@langfuse/tracing'
import { LanguageModelUsage } from 'ai'

// TODO private method should be static
export async function buildTraceId(options?: AiGenerateOptions): Promise<string | undefined> {
  if (!options?.telemetry) {
    return undefined
  }
  return createTraceId(options.telemetry.langfuseTraceName)
}

export function buildTelemetryOptions(options?: AiGenerateOptions, traceId?: string, defaultTraceName = 'ai.generate') {
  return {
    isEnabled: true,
    recordInputs: true,
    recordOutputs: true,
    ...(options?.telemetry && {
      langfuseTraceName: options.telemetry.langfuseTraceName || defaultTraceName,
      traceId,
      functionId: options.telemetry.functionId || '',
      langfuseOriginalPrompt: options.telemetry.langfuseOriginalPrompt || '',
    }),
  }
}

export function buildUsageStats(usage: LanguageModelUsage | undefined): TokenUsage | undefined {
  if (!usage) {
    return undefined
  }
  return {
    promptTokens: usage.inputTokens ?? 0,
    completionTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
  }
}
