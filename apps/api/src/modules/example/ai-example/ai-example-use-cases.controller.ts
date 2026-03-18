import type {
  GenerateTextResponse,
  UseCase1SingleGenerationRequest,
  UseCase2GroupedCallsRequest,
  UseCase2GroupedCallsResponse,
  UseCase3LogicalUnitsRequest,
  UseCase3LogicalUnitsResponse,
  UseCase4ChatSessionRequest,
} from './ai-example.contract'
import { TypedBody, TypedController, TypedRoute } from '@lonestone/nzoth/server'
import { Logger } from '@nestjs/common'
import { AiService } from '../../ai/ai.service'
import { LangfuseService } from '../../ai/langfuse.service'
import {
  generateTextResponseSchema,
  useCase1SingleGenerationRequestSchema,
  useCase2GroupedCallsRequestSchema,
  useCase2GroupedCallsResponseSchema,
  useCase3LogicalUnitsRequestSchema,
  useCase3LogicalUnitsResponseSchema,
  useCase4ChatSessionRequestSchema,
} from './ai-example.contract'

/**
 * Trace use-case examples — no auth required.
 * See docs: Organizing Traces (4_ai.mdx).
 */
@TypedController('ai/examples')
export class AiExampleUseCasesController {
  private readonly logger = new Logger(AiExampleUseCasesController.name)

  constructor(
    private readonly aiService: AiService,
    private readonly langfuseService: LangfuseService,
  ) {}

  /**
   * Use case 1: Single REST call, one generation.
   * The trace is orphaned by default; we call finalizeTrace so Langfuse shows name and output.
   * In the Langfuse UI, we should see 1 line with the name/output of the trace and the result of the LLM call.
   */
  @TypedRoute.Post('use-case-1-single-generation', generateTextResponseSchema)
  async useCase1SingleGeneration(
    @TypedBody(useCase1SingleGenerationRequestSchema) body: UseCase1SingleGenerationRequest,
  ): Promise<GenerateTextResponse> {
    const prompt = await this.langfuseService.getLangfusePrompt('Boilerplate tests')

    const result = await this.aiService.generateText({
      prompt: body.prompt,
      model: body.model,
      options: {
        ...body.options,
        telemetry: {
          traceMode: 'inherit',
          traceName: 'api.single-generation',
          spanName: 'ai.generate-text',
          langfuseOriginalPrompt: prompt.toJSON(),
        },
      },
    })

    this.langfuseService.finalizeTrace({
      input: body.prompt,
      output: result.result,
    })

    return {
      result: result.result,
      usage: result.usage,
      finishReason: result.finishReason,
    }
  }

  /**
   * Use case 2: One REST call, several LLM calls grouped in one trace.
   * All calls use inherit; we finalize the trace at the end with a single name/output.
   * In the Langfuse UI, we should see 1 line with the name/output of the trace and the results of the LLM calls.
   */
  @TypedRoute.Post('use-case-2-grouped-calls', useCase2GroupedCallsResponseSchema)
  async useCase2GroupedCalls(
    @TypedBody(useCase2GroupedCallsRequestSchema) body: UseCase2GroupedCallsRequest,
  ): Promise<UseCase2GroupedCallsResponse> {
    const results: string[] = []
    let lastUsage: UseCase2GroupedCallsResponse['usage']

    const traceName = `api.grouped-calls-${Date.now()}`

    for (let i = 0; i < body.prompts.length; i++) {
      const step = await this.aiService.generateText({
        prompt: body.prompts[i],
        model: body.model,
        options: {
          telemetry: {
            traceMode: 'inherit',
            spanName: `ai.step-${i + 1}`,
          },
        },
      })
      results.push(step.result)
      lastUsage = step.usage
    }

    this.langfuseService.finalizeTrace({
      name: traceName,
      input: { prompts: body.prompts },
      output: { results, status: 'done' },
    })

    return {
      traceName,
      results,
      usage: lastUsage,
    }
  }

  /**
   * Use case 3: One REST call, logical units — each unit gets its own trace (split per workflow).
   * In the Langfuse UI, we should see X lines (X being the nb of provided prompts)
   * Note that this technique could be used for "workflow" like units, called in a CRON job, etc.
   * The idea is to "detach" the traces from the OTEL main trace
   */
  @TypedRoute.Post('use-case-3-logical-units', useCase3LogicalUnitsResponseSchema)
  async useCase3LogicalUnits(
    @TypedBody(useCase3LogicalUnitsRequestSchema) body: UseCase3LogicalUnitsRequest,
  ): Promise<UseCase3LogicalUnitsResponse> {
    const workflows: UseCase3LogicalUnitsResponse['workflows'] = []

    // We loop on workflows -> 1 workflow = 1 line in Langfuse UI
    for (let i = 0; i < body.workflowPrompts.length; i++) {
      const traceName = `workflow-${i}-${Date.now()}`

      // We create a traceId for the workflow, we will use it to group all the LLM calls in the same workflow in the same trace.
      const traceId = await LangfuseService.createTraceId(traceName)

      const result = await this.aiService.generateText({
        prompt: body.workflowPrompts[i],
        model: body.model,
        options: {
          telemetry: {
            // We don't provide a traceName here, as it will be set by the first LLM call.
            // We use `split` to detach the trace from the OTEL main trace.
            traceMode: 'split',
            traceId,
            spanName: `ai.workflow-${i}-1`,
            metadata: { workflowIndex: i },
          },
        },
      })

      // We can have several LLM calls in the same trace, each with its own span
      const result2 = await this.aiService.generateText({
        prompt: 'This is a second LLM call in the same trace',
        model: body.model,
        options: {
          telemetry:
          {
            // We also use split for the second LLM call (else it would be in the original OTEL trace), but we reuse the same traceId to group the two LLM calls in the same Langfuse trace.
            traceMode: 'split',
            traceId,
            spanName: `ai.workflow-${i}-2`,
            // Last LLM call for this trace : time to set the traceName. If we have done it before, it would be overridden now.
            traceName,
          },
        },
      })

      workflows.push({
        index: i,
        result: result.result,
        usage: {
          promptTokens: (result.usage?.promptTokens ?? 0) + (result2.usage?.promptTokens ?? 0),
          completionTokens: (result.usage?.completionTokens ?? 0) + (result2.usage?.completionTokens ?? 0),
          totalTokens: (result.usage?.totalTokens ?? 0) + (result2.usage?.totalTokens ?? 0),
        },
      })
    }

    return { workflows }
  }

  /**
   * Use case 4: Simple generation with sessionId — one Langfuse trace per session (across requests).
   * Same sessionId => same traceId (deterministic) => multiple lines in the "tracing" list view, but merged in one session in the "sessions" view on Langfuse UI.
   */
  @TypedRoute.Post('use-case-4-chat-session', generateTextResponseSchema)
  async useCase4ChatSession(
    @TypedBody(useCase4ChatSessionRequestSchema) body: UseCase4ChatSessionRequest,
  ): Promise<GenerateTextResponse> {
    const result = await this.aiService.generateText({
      prompt: body.prompt,
      model: body.model,
      options: {
        telemetry: {
          traceMode: 'split',
          traceName: `session:${body.sessionId}`,
          spanName: 'ai.chat.turn',
          sessionId: body.sessionId,
          metadata: { sessionId: body.sessionId },
        },
      },
    })

    return {
      result: result.result,
      usage: result.usage,
      finishReason: result.finishReason,
    }
  }

  /**
   * Use case 5: Chat session with turns merged into a single trace.
   * Same as use case 4, but with turns merged into a single trace.
   */
  @TypedRoute.Post('use-case-5-chat-session-with-turns-merged', generateTextResponseSchema)
  async useCase5ChatSessionWithTurnsMerged(
    @TypedBody(useCase4ChatSessionRequestSchema) body: UseCase4ChatSessionRequest,
  ): Promise<GenerateTextResponse> {
    const traceId = await LangfuseService.createTraceId(`chat.session:${body.sessionId}`)

    const result = await this.aiService.generateText({
      prompt: body.prompt,
      model: body.model,
      options: {
        telemetry: {
          traceMode: 'split',
          traceId,
          traceName: `chat.session:${body.sessionId}`,
          spanName: 'ai.chat.turn',
          sessionId: body.sessionId,
          metadata: { sessionId: body.sessionId },
        },
      },
    })

    return {
      result: result.result,
      usage: result.usage,
      finishReason: result.finishReason,
    }
  }
}
