import { LangfuseSpanProcessor } from '@langfuse/otel'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import * as Sentry from '@sentry/bun'
import {
  SentryPropagator,
  SentrySampler,
  SentrySpanProcessor,
} from '@sentry/opentelemetry'
import { config } from './config/env.config'

// Step 1: Initialize Sentry WITHOUT automatic OTEL setup, to be compatible with Langfuse (Option A described below)
// REASONNING:
// Option A: Shared TracerProvider (Recommended by Langfuse) - This gives distributed tracing across both Sentry and Langfuse, but it means Langfuse traces will appear in Sentry.
// Option B: Add the Tracer to Langfuse manually. On paper, it is simpler, but we could not get it to work reliably.
// See: https://langfuse.com/faq/all/existing-sentry-setup and https://langfuse.com/faq/all/existing-otel-setup#no-traces-in-langfuse
// ⚠️ This means Langfuse traces will appear in Sentry.
const sentryClient = Sentry.init({
  // Uncomment this to enable debug mode (which is REALLY verbose)
  // debug: config.env !== 'production',
  environment: config.env,
  release: config.version,

  dsn: config.sentry.dsn,

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,

  // Add Tracing by setting tracesSampleRate
  tracesSampleRate: 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Critical: prevents Sentry from claiming global provider
  skipOpenTelemetrySetup: true,
})

console.warn('Sentry initialized')

// Step 2 & 3: Create shared TracerProvider with both processors (async due to ESM-only packages in CJS)
function initSharedTracerProvider(): void {
  if (!config.sentry.dsn) {
    console.warn('Sentry DSN not configured. Tracing will be disabled.')
    return
  }

  if (!config.langfuse.publicKey || !config.langfuse.secretKey || !config.langfuse.host) {
    console.warn('Langfuse not configured. Tracing will be disabled.')
    return
  }

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
  })

  console.warn('Shared TracerProvider initialized (Langfuse + Sentry)')
}

export { initSharedTracerProvider }
