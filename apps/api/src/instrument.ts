import { LangfuseSpanProcessor } from '@langfuse/otel'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import * as Sentry from '@sentry/nestjs'
import {
  SentryPropagator,
  SentrySampler,
  SentrySpanProcessor,
} from '@sentry/opentelemetry'
import { config } from './config/env.config'

const sentryConfig: Sentry.NodeOptions = {
  // Uncomment this to enable debug mode (which is REALLY verbose)
  // debug: config.env !== 'production',

  environment: config.env,
  release: config.version,
  dsn: config.sentry.dsn,

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  tracesSampleRate: 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,
  integrations: [Sentry.pinoIntegration()],
}

// 3 cases :
// Sentry alone - We let Sentry handles OTEL
// Langfuse alone - We need to handle OTEL ourselves
// Sentry and Langfuse - We use a shared TracerProvider
function initialiazeTelemetry() {
  if (config.sentry.dsn && !config.langfuse.secretKey) {
    // Initialize Sentry alone
    Sentry.init({
      ...sentryConfig,
    })

    console.warn('Sentry initialized')
    console.warn('Langfuse not configured. AI tracing will be disabled.')
  }
  else if (!config.sentry.dsn && config.langfuse.secretKey) {
    console.warn('Sentry DSN not configured. Base tracing, logging and error reporting will be disabled.')

    // Initialize Langfuse alone
    const sdk = new NodeSDK({
      spanProcessors: [new LangfuseSpanProcessor()],
    })

    sdk.start()

    console.warn('Langfuse initialized')
  }
  else if (config.sentry.dsn && config.langfuse.secretKey) {
    // REASONNING:
    // Option A: Shared TracerProvider (Recommended by Langfuse) - This gives distributed tracing across both Sentry and Langfuse, but it means Langfuse traces will appear in Sentry.
    // Option B: Add the Tracer to Langfuse manually. On paper, it is simpler, but we could not get it to work reliably.
    // See: https://langfuse.com/faq/all/existing-sentry-setup and https://langfuse.com/faq/all/existing-otel-setup#no-traces-in-langfuse
    // ⚠️ This means Langfuse traces will appear in Sentry.

    // Step 1: Initialize Sentry WITHOUT automatic OTEL setup, to be compatible with Langfuse (Option A described below)
    const sentryClient = Sentry.init({
      ...sentryConfig,
      // We don't want Sentry to handle OTEL, we want to use the shared TracerProvider
      skipOpenTelemetrySetup: true,
    })

    console.warn('Sentry initialized')

    // Step 2 & 3: Create shared TracerProvider with both processors (async due to ESM-only packages in CJS)
    const provider = new NodeTracerProvider({
      sampler: sentryClient ? new SentrySampler(sentryClient) : undefined,
      spanProcessors: [
        // Langfuse processor - filters to only export LLM-related spans
        new LangfuseSpanProcessor({
          publicKey: config.langfuse.publicKey,
          secretKey: config.langfuse.secretKey,
          baseUrl: config.langfuse.host,
          environment: config.env,
          shouldExportSpan: ({ otelSpan }) =>
            ['langfuse-sdk', 'ai'].includes(otelSpan.instrumentationScope.name),
        }),
        // Sentry processor - receives all spans
        new SentrySpanProcessor(),
      ],
    })

    // Register with Sentry's propagator and context manager
    provider.register({
      propagator: new SentryPropagator(),
      contextManager: new Sentry.SentryContextManager(),
    })

    console.warn('Shared TracerProvider initialized (Langfuse + Sentry)')
  }
}

export { initialiazeTelemetry }
