import { createOpenAI, OpenAIProvider } from '@ai-sdk/openai'
import { HttpException, HttpStatus, Injectable, OnApplicationShutdown } from '@nestjs/common'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { generateObject } from 'ai'
import Langfuse from 'langfuse'
import { LangfuseExporter } from 'langfuse-vercel'
import { z } from 'zod'
import { config } from '../../config/env.config'

export interface GenerateObjectOptions<OBJECT> {
  schema: z.ZodSchema<OBJECT>
  compiledPrompt: string
  telemetry?: {
    originalPrompt: string
    functionId: string
    traceId: string
    // eslint-disable-next-line ts/no-explicit-any
    otherMetadata: Record<string, any>
  }
}

@Injectable()
export class AiService implements OnApplicationShutdown {
  public readonly langfuse: Langfuse
  private readonly otlSDK: NodeSDK
  private readonly openai: OpenAIProvider

  constructor() {
    this.langfuse = new Langfuse({
      publicKey: config.ai.langfusePublicKey,
      secretKey: config.ai.langfuseSecretKey,
      baseUrl: 'https://cloud.langfuse.com',
      environment: config.env,
    })

    this.otlSDK = new NodeSDK({
      traceExporter: new LangfuseExporter({
        publicKey: config.ai.langfusePublicKey,
        secretKey: config.ai.langfuseSecretKey,
        baseUrl: 'https://cloud.langfuse.com',
        environment: config.env,
        // debug: true,
      }),
      instrumentations: [getNodeAutoInstrumentations()],
    })

    // Start the Opentelemetry SDK
    this.otlSDK.start()

    this.openai = createOpenAI({
      apiKey: config.ai.openAiApiKey,
    })
  }

  async onApplicationShutdown() {
    await this.otlSDK.shutdown()
  }

  /**
   * Generate an object using the OpenAI API
   * @param options - The options for the generation
   * @returns The generated object
   *
   * You will need to get the prompt from langfuse before calling this function.
   *
   * Example usage:
   * ```ts
   * const traceName = `your-trace-${variable}`
   * const traceId = `${traceName}-${Date.now()}`
   *
   * const prompt = await this.aiService.langfuse.getPrompt('your-prompt')
   * const compiledPrompt = prompt.compile({
   *   variable1: JSON.stringify(data.toJSON()),
   *   variable2: '...',
   *   ...
   * })
   *
   * const object = await this.aiService.generateObject({
   *   schema: z.object({
   *     resultProperty: z.string(),
   *     ...
   *   }),
   *   compiledPrompt,
   * })
   * ```
   */
  async generateObject<OBJECT>(options: GenerateObjectOptions<OBJECT>): Promise<OBJECT> {
    try {
      const { object } = await generateObject({
        model: this.openai('gpt-4o-2024-08-06'),
        mode: 'json',
        schema: options.schema,
        temperature: 0,
        prompt: options.compiledPrompt,
        experimental_telemetry: options.telemetry
          ? {
              isEnabled: true,
              functionId: options.telemetry.functionId,
              metadata: {
                langfusePrompt: options.telemetry.originalPrompt,
                langfuseTraceId: options.telemetry.traceId,
                ...options.telemetry.otherMetadata,
              },
            }
          : undefined,
      })

      return object
    }
    catch (error) {
      console.error(error)
      throw new HttpException(`Failed to generate object ${options.telemetry?.traceId}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    finally {
      // Patch the langfuse trace name
      this.langfuse.trace({
        id: options.telemetry?.traceId,
        name: options.telemetry?.traceId,
      })

      await this.langfuse.flushAsync()
    }
  }
}
