import type { LanguageModel, LanguageModelUsage } from 'ai'
import type { ModelId } from './ai.config'
import type { AiGenerateInput, AiGenerateInputWithoutSchema, AiGenerateInputWithSchema, AiGenerateOutputObject, AiGenerateOutputText } from './contracts/ai.contract'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { generateText, stepCountIs } from 'ai'
import { Langfuse } from 'langfuse'
import z from 'zod'
import { config } from '../../config/env.config'
import { modelConfigBase, modelRegistry } from './ai.config'
import { getDefaultModel, getModel, sanitizeAiJson } from './ai.utils'

const defaultStopWhen = 10

export type AiGenerateResultText = AiGenerateOutputText & {
  abortController?: AbortController
}

export type AiGenerateResultObject<T> = AiGenerateOutputObject<T> & {
  abortController?: AbortController
}

export type AiGenerateResult<T = string> = AiGenerateResultText | AiGenerateResultObject<T>

function createSchemaPromptCommand(schema: z.ZodType): string {
  return `
  
  IMPORTANT: You must respond with valid JSON that matches the expected schema structure.
  Your response must be valid JSON only, with no additional text, markdown formatting, or explanation before or after the JSON. Return only the JSON object or array.
  
  The schema is:
  ${JSON.stringify(schema.toJSONSchema(), null, 2)}
  `
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name)
  private langfuseClient: Langfuse | null = null

  constructor() {
    if (config.langfuse.secretKey) {
      this.langfuseClient = new Langfuse({
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

  onModuleInit() {
    this.registerDefaultModels()
  }

  private registerDefaultModels() {
    for (const [modelId, modelConfig] of Object.entries(modelConfigBase)) {
      modelRegistry.register(modelId as ModelId, modelConfig)
      this.logger.log(`Registered model: ${modelId}`)
    }
  }

  private async getModelInstance(modelId?: ModelId): Promise<LanguageModel> {
    if (modelId) {
      return getModel(modelId)
    }
    const defaultModel = await getDefaultModel()
    if (!defaultModel) {
      throw new Error('No default model configured. Please specify a model or configure a default model.')
    }
    return defaultModel
  }

  private getModelName(modelId?: ModelId): string {
    if (modelId) {
      const modelConfig = modelRegistry.get(modelId)
      if (modelConfig) {
        return `${modelConfig.provider}:${modelConfig.modelString}`
      }
    }
    const defaultModelId = modelRegistry.getDefault()
    if (defaultModelId) {
      const modelConfig = modelRegistry.get(defaultModelId)
      if (modelConfig) {
        return `${modelConfig.provider}:${modelConfig.modelString}`
      }
    }
    return 'unknown'
  }

  private createSchemaPrompt(schema: z.ZodType): string {
    return createSchemaPromptCommand(schema)
  }

  private validateAndParse<T>(text: string, schema: z.ZodType<T>): T {
    const parsed = sanitizeAiJson(text)
    return schema.parse(parsed)
  }

  async generate(input: AiGenerateInputWithoutSchema): Promise<AiGenerateResultText>
  async generate<T>(input: AiGenerateInputWithSchema<T>): Promise<AiGenerateResultObject<T>>
  async generate<T>(input: AiGenerateInput<T>): Promise<AiGenerateResult<T>>
  async generate<T>({
    prompt,
    model,
    options,
    schema,
    tools,
    signal,
  }: AiGenerateInput<T>): Promise<AiGenerateResult<T>> {
    const abortController = signal ? undefined : new AbortController()
    const abortSignal = signal || abortController!.signal

    const modelInstance = await this.getModelInstance(model)
    const modelName = this.getModelName(model)

    let enhancedPrompt = prompt
    if (schema) {
      enhancedPrompt = prompt + this.createSchemaPrompt(schema)
    }

    const startTime = Date.now()
    const trace = this.langfuseClient?.trace({
      name: 'ai.generate',
      input: {
        prompt: enhancedPrompt,
        originalPrompt: prompt,
        hasSchema: !!schema,
        hasTools: !!tools,
        toolNames: tools ? Object.keys(tools) : [],
      },
      metadata: {
        model: modelName,
        modelId: model,
        promptLength: prompt.length,
        enhancedPromptLength: enhancedPrompt.length,
        hasSchema: !!schema,
        hasTools: !!tools,
        toolCount: tools ? Object.keys(tools).length : 0,
        options,
      },
    })

    const generation = trace?.generation({
      name: schema ? 'object-generation' : 'text-generation',
      model: modelName,
      input: enhancedPrompt,
      metadata: {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      },
    })

    try {
      const generateOptions: Parameters<typeof generateText>[0] = {
        model: modelInstance,
        prompt: enhancedPrompt,
        abortSignal,
        ...(options?.temperature !== undefined && { temperature: options.temperature }),
        ...(options?.topP !== undefined && { topP: options.topP }),
        ...(options?.frequencyPenalty !== undefined && { frequencyPenalty: options.frequencyPenalty }),
        ...(options?.presencePenalty !== undefined && { presencePenalty: options.presencePenalty }),
        ...(options?.maxTokens !== undefined && { maxTokens: options.maxTokens }),
        ...(tools && { tools }),
        ...(options?.maxSteps !== undefined && { maxSteps: options.maxSteps }),
        stopWhen: stepCountIs(options?.stopWhen ?? defaultStopWhen),
      }

      const result = await generateText(generateOptions)

      const duration = Date.now() - startTime

      generation?.end({
        output: result.text,
        usage: result.usage,
        metadata: {
          finishReason: result.finishReason,
          duration,
          toolCalls: result.steps?.flatMap(step => step.toolCalls || []).length ?? 0,
          toolResults: result.steps?.flatMap(step => step.toolResults || []).length ?? 0,
        },
      })

      trace?.update({
        output: {
          text: result.text,
          usage: result.usage,
          finishReason: result.finishReason,
          toolCalls: result.steps?.flatMap(step => step.toolCalls || []),
          toolResults: result.steps?.flatMap(step => step.toolResults || []),
        },
        metadata: {
          duration,
          steps: result.steps?.length ?? 0,
        },
      })

      let parsed: T | undefined
      if (schema) {
        try {
          parsed = this.validateAndParse(result.text, schema)
        }
        catch (error) {
          this.logger.error('Schema validation failed', error)
          generation?.update({
            statusMessage: `Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
          throw new Error(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      let usage: { promptTokens: number, completionTokens: number, totalTokens: number } | undefined
      if (result.usage) {
        const usageAny = result.usage as LanguageModelUsage
        usage = {
          promptTokens: usageAny.inputTokens ?? 0,
          completionTokens: usageAny.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? (usageAny.inputTokens ?? 0) + (usageAny.outputTokens ?? 0),
        }
      }

      const toolCalls = result.steps?.flatMap(step =>
        (step.toolCalls || []).map((tc) => {
          const toolCall = tc
          return {
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: toolCall.input,
          }
        }),
      )
      const toolResults = result.steps?.flatMap(step =>
        (step.toolResults || []).map((tr) => {
          const toolResult = tr
          return {
            toolCallId: toolResult.toolCallId,
            toolName: toolResult.toolName,
            result: toolResult.output,
          }
        }),
      )

      const baseResponse = {
        usage,
        finishReason: result.finishReason,
        abortController,
        ...(toolCalls && toolCalls.length > 0 && { toolCalls }),
        ...(toolResults && toolResults.length > 0 && { toolResults }),
      }

      if (parsed !== undefined) {
        const response: AiGenerateResultObject<T> = {
          ...baseResponse,
          type: 'object' as const,
          result: parsed,
        }
        return response as AiGenerateResult<T>
      }
      else {
        const response: AiGenerateResultText = {
          ...baseResponse,
          type: 'text' as const,
          result: result.text,
        }
        return response as AiGenerateResult<T>
      }
    }
    catch (error) {
      const duration = Date.now() - startTime

      if (error instanceof Error && error.name === 'AbortError') {
        generation?.update({
          statusMessage: 'Generation was cancelled',
          metadata: { duration },
        })
        trace?.update({
          metadata: { cancelled: true, duration },
        })
        throw error
      }

      generation?.end({
        statusMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { duration },
      })

      trace?.update({
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration,
        },
      })

      this.logger.error('Text generation failed', error)
      throw error
    }
  }
}
