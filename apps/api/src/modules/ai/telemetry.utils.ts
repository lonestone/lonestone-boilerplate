import type { AiGenerateOptions, TokenUsage } from './contracts/ai.contract'
import { randomUUID } from 'node:crypto'
import { LanguageModelUsage } from 'ai'
import { LangfuseService } from './langfuse.service'

// TODO private method should be static
export async function buildTraceId(
  options?: AiGenerateOptions,
  _defaultTraceName = 'ai.generate',
  defaultTraceMode: 'inherit' | 'split' = 'inherit',
): Promise<string | undefined> {
  const effectiveTraceMode = options?.telemetry?.traceMode ?? defaultTraceMode

  if (!options?.telemetry || effectiveTraceMode !== 'split') {
    return undefined
  }

  if (options.telemetry.traceId) {
    return options.telemetry.traceId
  }

  return LangfuseService.createTraceId(randomUUID())
}

export function buildTelemetryOptions(options?: AiGenerateOptions, defaultTraceName = 'ai.generate') {
  return {
    isEnabled: true,
    recordInputs: true,
    recordOutputs: true,
    ...(options?.telemetry && {
      functionId: options.telemetry.spanName || defaultTraceName,
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
