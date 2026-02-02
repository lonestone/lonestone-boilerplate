# AI Module

A clean service for AI text generation using the [Vercel AI SDK](https://sdk.vercel.ai/) with multiple provider support, schema validation, tool calling, and streaming.

For tracing and Langfuse integration details, see the [AI explanation docs](../../../documentation/src/content/docs/explanations/core%20features/ai.mdx).

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
    const result = await this.aiService.generate({
      prompt: 'Write a haiku about TypeScript',
      model: OPENAI_GPT_4O,
    })

    if (result.type === 'text') {
      console.log(result.result) // string
    }
  }
}
```

## API Reference

### `generate(input)`

Generates AI completion. Supports single-turn prompts and multi-turn conversations.

**Parameters:**
- `prompt` - Single-turn prompt string (or use `messages` for conversations)
- `messages` - Conversation history as `CoreMessage[]`
- `model` - Model identifier
- `schema` - Optional Zod schema for structured JSON output (throws on validation failure)
- `tools` - Optional tools the model can call
- `options` - Generation options: `temperature`, `maxTokens`, `topP`, `frequencyPenalty`, `presencePenalty`, `telemetry`
- `signal` - Optional AbortSignal for cancellation

**Returns:** `AiGenerateResultText` (no schema) or `AiGenerateResultObject<T>` (with schema)

#### With Schema Validation

```typescript
import { z } from 'zod'

const userSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
})

const result = await this.aiService.generate({
  prompt: 'Generate a user profile for a software developer',
  model: OPENAI_GPT_4O,
  schema: userSchema,
})

console.log(result.result.name) // Typed as { name: string, age: number, email: string }
```

#### With Conversation History

```typescript
import type { CoreMessage } from './modules/ai/contracts/ai.contract'

const messages: CoreMessage[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is the capital of France?' },
]

const result = await this.aiService.generate({
  messages,
  model: OPENAI_GPT_4O,
})

// result.messages contains the updated conversation with assistant response
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

const result = await this.aiService.generate({
  prompt: 'What is the weather in Paris?',
  model: OPENAI_GPT_4O,
  tools: { weather: weatherTool },
})
```

### Using MCP (Model Context Protocol) Tools

You can also use tools from MCP servers.

```typescript
import { GOOGLE_GEMINI_3_FLASH } from '../modules/ai/ai.config'
import { createMCPClient, getCryptoPriceTool } from '../modules/ai/tools/your-mcp-server.tools'

// Create MCP client
const yourMCPClient = await createMCPClient()
const mcpTools = await createMCPClient.tools()

// Combine MCP tools with custom tools
const tools = {
  ...mcpTools, // Spread MCP tools
  getCryptoPrice: getCryptoPriceTool, // Add custom tool
}

const result = await this.aiService.generate({
  prompt: 'What is the current price of Bitcoin?',
  model: GOOGLE_GEMINI_3_FLASH,
  tools,
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

