# AI Module

A clean service for AI text generation using the [Vercel AI SDK](https://sdk.vercel.ai/) with multiple provider support, schema validation, tool calling, and streaming.

For tracing and Langfuse integration details, see the [AI explanation docs](../../../../documentation/src/content/docs/core-features/4_ai.mdx).

## Configuration

### Available Providers

| Provider | Package | Env Variable |
|----------|---------|--------------|
| OpenAI | `@ai-sdk/openai` | `OPENAI_API_KEY` |
| Google | `@ai-sdk/google` | `GOOGLE_API_KEY` |
| Anthropic | `@ai-sdk/anthropic` | `ANTHROPIC_API_KEY` |
| Mistral | `@ai-sdk/mistral` | `MISTRAL_API_KEY` |

### Adding Models

Edit `ai.config.ts`:

```typescript
export const modelConfigBase = {
  // Add your model
  OPENAI_GPT_4O: {
    modelString: 'gpt-4o',
    provider: 'openai' as const satisfies ProviderName,
    isDefault: false,
  },
  CLAUDE_SONNET: {
    modelString: 'claude-3-5-sonnet-latest',
    provider: 'anthropic' as const satisfies ProviderName,
    isDefault: true, // Set as default
  },
} as const satisfies Record<string, ModelConfig>
```

### Adding a New Provider

1. Install the provider package: `pnpm add @ai-sdk/[provider]`
2. Add creation function in `ai.providers.ts`
3. Add env variable in `env.config.ts`
4. Register provider in `ai.config.ts`

See existing providers in `ai.providers.ts` for reference.

## Quick Start

```typescript
import { Injectable } from '@nestjs/common'
import { AiService } from './modules/ai/ai.service'
import { OPENAI_GPT_4O } from './modules/ai/ai.config'

@Injectable()
export class MyService {
  constructor(private readonly aiService: AiService) {}

  async generateContent() {
    // Simple text generation
    const result = await this.aiService.generateText({
      prompt: 'Write a haiku about TypeScript',
      model: OPENAI_GPT_4O,
    })
    console.log(result.result) // string
  }
}
```

## API Reference

The AI service provides three specialized methods for different use cases:

### `generateText(input)`

Simple text generation from a prompt.

**Parameters:**
- `prompt` - The prompt string to generate text from
- `model` - Optional model identifier (falls back to default)
- `options` - Generation options: `temperature`, `maxTokens`, `topP`, `frequencyPenalty`, `presencePenalty`, `telemetry`
- `signal` - Optional AbortSignal for cancellation

**Returns:** `GenerateTextResult` with `result` (string), `usage`, and `finishReason`

```typescript
const result = await this.aiService.generateText({
  prompt: 'Write a haiku about TypeScript',
  model: OPENAI_GPT_4O,
})

console.log(result.result) // string
console.log(result.usage)  // { promptTokens, completionTokens, totalTokens }
```

### `generateObject<T>(input)`

Generates structured output validated against a Zod schema.

**Parameters:**
- `prompt` - The prompt describing what to generate
- `schema` - Zod schema for structured JSON output validation
- `model` - Optional model identifier
- `options` - Generation options
- `signal` - Optional AbortSignal for cancellation

**Returns:** `GenerateObjectResult<T>` with typed `result`, `usage`, and `finishReason`

**Throws:** Error if schema validation fails

```typescript
import { z } from 'zod'

const userSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
})

const result = await this.aiService.generateObject({
  prompt: 'Generate a user profile for a software developer',
  schema: userSchema,
  model: OPENAI_GPT_4O,
})

console.log(result.result.name)  // Typed as string
console.log(result.result.age)   // Typed as number
console.log(result.result.email) // Typed as string
```

### `chat(input)`

Handles multi-turn conversations with optional tool support.

**Parameters:**
- `messages` - Conversation history as `AiCoreMessage[]`
- `tools` - Optional tools the model can call
- `model` - Optional model identifier
- `options` - Generation options
- `signal` - Optional AbortSignal for cancellation

**Returns:** `ChatResult` with `result` (string), `messages` (updated conversation), `usage`, `finishReason`, `toolCalls`, and `toolResults`

```typescript
import type { AiCoreMessage } from './modules/ai/contracts/ai.contract'

const messages: AiCoreMessage[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is the capital of France?' },
]

const result = await this.aiService.chat({
  messages,
  model: OPENAI_GPT_4O,
})

console.log(result.result)   // Assistant's response
console.log(result.messages) // Updated conversation with assistant response
```

#### With Tools

```typescript
import { tool } from 'ai'
import { z } from 'zod'

const weatherTool = tool({
  description: 'Get current weather for a location',
  parameters: z.object({
    location: z.string().describe('City name'),
  }),
  execute: async ({ location }) => {
    // Your implementation
    return { temperature: 22, condition: 'sunny' }
  },
})

const result = await this.aiService.chat({
  messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
  tools: { weather: weatherTool },
  model: OPENAI_GPT_4O,
})

console.log(result.toolCalls)   // Tools called by the model
console.log(result.toolResults) // Results from tool executions
```

### Using MCP (Model Context Protocol) Tools

You can use tools from MCP servers with the `chat()` method.

```typescript
import { GOOGLE_GEMINI_3_FLASH } from '../modules/ai/ai.config'
import { createMCPClient, getCryptoPriceTool } from '../modules/ai/tools/your-mcp-server.tools'

// Create MCP client
const yourMCPClient = await createMCPClient()
const mcpTools = await yourMCPClient.tools()

// Combine MCP tools with custom tools
const tools = {
  ...mcpTools,
  getCryptoPrice: getCryptoPriceTool,
}

const result = await this.aiService.chat({
  messages: [{ role: 'user', content: 'What is the current price of Bitcoin?' }],
  tools,
  model: GOOGLE_GEMINI_3_FLASH,
})
```

### `streamTextGenerator(input, signal?)`

Streams AI text generation. Yields events: `chunk`, `tool-call`, `tool-result`, `done`, `error`.

```typescript
for await (const event of this.aiService.streamTextGenerator({
  prompt: 'Tell me a story',
  model: OPENAI_GPT_4O,
})) {
  if (event.type === 'chunk') {
    process.stdout.write(event.text)
  }
  if (event.type === 'done') {
    console.log('\n--- Usage:', event.usage)
  }
}
```

## Method Selection Guide

| Use Case | Method |
|----------|--------|
| Simple text generation | `generateText()` |
| Structured/typed output | `generateObject()` |
| Multi-turn conversation | `chat()` |
| Conversation with tools | `chat()` with `tools` |
| Real-time streaming | `streamTextGenerator()` |
