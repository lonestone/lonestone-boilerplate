# AI Module

The AI module provides a clean, maintainable service for AI text generation using the Vercel AI SDK with Langfuse telemetry, model flexibility, cancellation support, optional Zod schema validation, and tool calling support.

## Features

- **Multiple Model Support**: Runtime model selection with pre-registered models
- **Multiple Provider Support**: OpenAI, Google (Gemini), Anthropic (Claude), and Mistral
- **Langfuse Integration**: Automatic telemetry and tracing with full prompt visibility
- **Cancellation Support**: Both AbortSignal parameter and returned AbortController
- **Schema Validation**: Optional Zod schema validation via prompt commands with discriminated union types
- **Tool Calling**: Support for AI tool/function calling with automatic result handling
- **Conversation History**: Support for multi-turn conversations using messages array following Vercel AI SDK patterns
- **Type Safety**: Full TypeScript support with inferred types and function overloads

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```env
# Langfuse (optional but recommended)
LANGFUSE_SECRET_KEY=your-secret-key
LANGFUSE_PUBLIC_KEY=your-public-key  # Optional
LANGFUSE_HOST=https://cloud.langfuse.com  # Optional, defaults to cloud

# Provider API Keys (set the ones you want to use)
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key  # If using Anthropic
GOOGLE_API_KEY=your-google-api-key  # If using Google
MISTRAL_API_KEY=your-mistral-api-key  # If using Mistral
```

### Pre-configured Models

Models are pre-configured in `ai.config.ts`. Available models:
- `OPENAI_GPT_5_NANO`: GPT-5 Nano
- `GOOGLE_GEMINI_3_FLASH`: Gemini 3 Flash
- `CLAUDE_HAIKU_3_5`: Claude 3.5 Haiku
- `MISTRAL_SMALL`: Mistral Small

**Note**: No default model is set. You must specify a model when calling `generate()`.

## Usage

### Basic Text Generation

```typescript
import { AiService } from '../modules/ai/ai.service'
import { GOOGLE_GEMINI_3_FLASH } from '../modules/ai/ai.config'

@Injectable()
export class MyService {
  constructor(private readonly aiService: AiService) {}

  async generateContent() {
    const result = await this.aiService.generate({
      prompt: 'Write a short story about a robot',
      model: GOOGLE_GEMINI_3_FLASH,
    })

    // TypeScript knows result.type === 'text'
    if (result.type === 'text') {
      console.log(result.result) // string
      console.log(result.usage) // Token usage information
    }
  }
}
```

### With Conversation History

The AI module supports multi-turn conversations using a `messages` array following Vercel AI SDK patterns. This allows the AI to maintain context across multiple interactions.

**Note**: The module does not store conversation history automatically. You are responsible for managing and persisting the messages array (e.g., in a database, Redis, or frontend state).

```typescript
import { AiService } from '../modules/ai/ai.service'
import { GOOGLE_GEMINI_3_FLASH } from '../modules/ai/ai.config'
import type { CoreMessage } from '../modules/ai/contracts/ai.contract'

@Injectable()
export class ChatService {
  constructor(private readonly aiService: AiService) {}

  async chat(userMessage: string, conversationHistory: CoreMessage[] = []) {
    // Build messages array with conversation history
    const messages: CoreMessage[] = [
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ]

    const result = await this.aiService.generate({
      messages,
      model: GOOGLE_GEMINI_3_FLASH,
    })

    // The response includes updated messages array with assistant's response
    if (result.type === 'text' && result.messages) {
      // result.messages includes the full conversation including the new assistant response
      const updatedHistory = result.messages
      
      // Store updatedHistory in your database/state for next turn
      return {
        response: result.result,
        messages: updatedHistory,
      }
    }
  }
}
```

**Example: Multi-turn Conversation**

```typescript
// First turn
let conversationHistory: CoreMessage[] = []

const firstResult = await this.aiService.generate({
  messages: [
    { role: 'user', content: 'What is the capital of France?' },
  ],
  model: GOOGLE_GEMINI_3_FLASH,
})

// Save the updated messages for next turn
if (firstResult.messages) {
  conversationHistory = firstResult.messages
}

// Second turn - AI remembers the previous conversation
const secondResult = await this.aiService.generate({
  messages: [
    ...conversationHistory,
    { role: 'user', content: 'What is its population?' },
  ],
  model: GOOGLE_GEMINI_3_FLASH,
})

// conversationHistory now includes both turns
```

**Message Format**

Each message follows the Vercel AI SDK `CoreMessage` format:

```typescript
type CoreMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
}
```

- `role`: The role of the message sender
  - `'user'`: User messages
  - `'assistant'`: AI assistant responses
  - `'system'`: System instructions (optional, typically at the start)
  - `'tool'`: Tool call results (used internally by the SDK)
- `content`: The message text content

**System Messages**

You can include a system message at the start of the conversation to set the AI's behavior:

```typescript
const messages: CoreMessage[] = [
  { role: 'system', content: 'You are a helpful assistant that speaks in a friendly, casual tone.' },
  { role: 'user', content: 'Hello!' },
]

const result = await this.aiService.generate({
  messages,
  model: GOOGLE_GEMINI_3_FLASH,
})
```

**Backward Compatibility**

The `prompt` parameter still works for single-turn conversations. If both `prompt` and `messages` are provided, `messages` takes precedence.

```typescript
// Single turn (backward compatible)
const result = await this.aiService.generate({
  prompt: 'Hello!',
  model: GOOGLE_GEMINI_3_FLASH,
})

// Multi-turn with messages
const result2 = await this.aiService.generate({
  messages: [
    { role: 'user', content: 'Hello!' },
  ],
  model: GOOGLE_GEMINI_3_FLASH,
})
```

### With Model Selection

```typescript
import { OPENAI_GPT_5_NANO, GOOGLE_GEMINI_3_FLASH, CLAUDE_HAIKU_3_5, MISTRAL_SMALL } from '../modules/ai/ai.config'

// Use a specific model
const result = await this.aiService.generate({
  prompt: 'Generate content',
  model: OPENAI_GPT_5_NANO,
})

// Or use Gemini
const geminiResult = await this.aiService.generate({
  prompt: 'Generate content',
  model: GOOGLE_GEMINI_3_FLASH,
})

// Or use Claude
const claudeResult = await this.aiService.generate({
  prompt: 'Generate content',
  model: CLAUDE_HAIKU_3_5,
})

// Or use Mistral
const mistralResult = await this.aiService.generate({
  prompt: 'Generate content',
  model: MISTRAL_SMALL,
})
```

### With Schema Validation

```typescript
import { z } from 'zod'
import { GOOGLE_GEMINI_3_FLASH } from '../modules/ai/ai.config'

const userProfileSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
})

async function generateUserProfile() {
  // TypeScript infers the return type based on the schema
  const result = await this.aiService.generate({
    prompt: 'Generate a user profile',
    model: GOOGLE_GEMINI_3_FLASH,
    schema: userProfileSchema,
  })

  // TypeScript knows result.type === 'object' and result.result is typed as the schema
  if (result.type === 'object') {
    // result.result is typed as { name: string; age: number; email: string }
    console.log(result.result.name)
    console.log(result.result.age)
    console.log(result.result.email)
  }
}
```

### Type-Safe Discriminated Union

The response uses a discriminated union based on the `type` field:

```typescript
const result = await this.aiService.generate({
  prompt: 'Generate content',
  model: GOOGLE_GEMINI_3_FLASH,
})

// TypeScript narrows the type based on the discriminated union
if (result.type === 'text') {
  // result.result is string
  console.log(result.result)
} else if (result.type === 'object') {
  // result.result matches the schema type
  console.log(result.result)
}
```

### With Cancellation (AbortSignal)

```typescript
import { GOOGLE_GEMINI_3_FLASH } from '../modules/ai/ai.config'

const abortController = new AbortController()

const promise = this.aiService.generate({
  prompt: 'Long running task',
  model: GOOGLE_GEMINI_3_FLASH,
  signal: abortController.signal,
})

// Cancel after 5 seconds
setTimeout(() => {
  abortController.abort()
}, 5000)

try {
  const result = await promise
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    console.log('Generation was cancelled')
  }
}
```

### With Cancellation (Returned Controller)

```typescript
import { GOOGLE_GEMINI_3_FLASH } from '../modules/ai/ai.config'

const result = await this.aiService.generate({
  prompt: 'Long running task',
  model: GOOGLE_GEMINI_3_FLASH,
})

// Cancel later if needed
if (result.abortController) {
  setTimeout(() => {
    result.abortController?.abort()
  }, 5000)
}
```

### With Generation Options

```typescript
import { GOOGLE_GEMINI_3_FLASH } from '../modules/ai/ai.config'

const result = await this.aiService.generate({
  prompt: 'Generate creative content',
  model: GOOGLE_GEMINI_3_FLASH,
  options: {
    temperature: 0.9, // Higher creativity
    maxTokens: 500,
    topP: 0.95,
    frequencyPenalty: 0.5,
    presencePenalty: 0.3,
  },
})
```

### With Tool Calling

Tools are created using the `tool()` function from the `ai` SDK. Each tool includes:
- `description`: What the tool does
- `inputSchema`: Zod schema for input parameters
- `outputSchema`: Zod schema for output (optional)
- `execute`: Async function that executes the tool

**Creating a Custom Tool:**

```typescript
import { GOOGLE_GEMINI_3_FLASH } from '../modules/ai/ai.config'
import { tool } from 'ai'
import { z } from 'zod'

const getWeatherTool = tool({
  description: 'Get the current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('The city and state, e.g. San Francisco, CA'),
    unit: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature unit'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    condition: z.string(),
    humidity: z.number(),
  }),
  execute: async ({ location, unit = 'celsius' }) => {
    // Your tool implementation
    const weather = await fetchWeatherAPI(location, unit)
    return {
      temperature: weather.temp,
      condition: weather.condition,
      humidity: weather.humidity,
    }
  },
})

const result = await this.aiService.generate({
  prompt: 'What is the weather in San Francisco?',
  model: GOOGLE_GEMINI_3_FLASH,
  tools: {
    getWeather: getWeatherTool,
  },
})

// Check for tool calls
if (result.toolCalls && result.toolCalls.length > 0) {
  console.log('Tool calls:', result.toolCalls)
  // Each tool call has: toolCallId, toolName, args
}

// Check for tool results
if (result.toolResults && result.toolResults.length > 0) {
  console.log('Tool results:', result.toolResults)
  // Each tool result has: toolCallId, toolName, result
}
```

**Using MCP (Model Context Protocol) Tools:**

You can also use tools from MCP servers. See the example in `tools/coingecko.tools.ts`:

```typescript
import { GOOGLE_GEMINI_3_FLASH } from '../modules/ai/ai.config'
import { createCoingeckoMCPClient, getCryptoPriceTool } from '../modules/ai/tools/coingecko.tools'

// Create MCP client
const coingeckoMCPClient = await createCoingeckoMCPClient()
const mcpTools = await coingeckoMCPClient.tools()

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

**Example Tool Implementation:**

See `tools/coingecko.tools.ts` for a complete example that includes both a custom tool and MCP client:

```typescript
import { createMCPClient } from '@ai-sdk/mcp'
import { tool } from 'ai'
import { z } from 'zod'

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3'

const cryptoPriceSchema = z.object({
  ids: z.string().describe('Comma-separated list of cryptocurrency IDs (e.g., "bitcoin,ethereum")'),
  vs_currencies: z.string().describe('Comma-separated list of fiat currencies (e.g., "usd,eur")'),
})

export const getCryptoPriceTool = tool({
  description: 'Get the current price of cryptocurrencies in various fiat currencies from CoinGecko',
  inputSchema: cryptoPriceSchema,
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
    timestamp: z.string(),
  }),
  execute: async ({ ids, vs_currencies }) => {
    const currencies = vs_currencies || 'usd'
    try {
      const url = `${COINGECKO_API_BASE}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(currencies)}`
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`)
      }

      const data = await response.json()
      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      }
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    }
  },
})

// MCP client for CoinGecko
export function createCoingeckoMCPClient() {
  return createMCPClient({
    transport: {
      type: 'http',
      url: 'https://mcp.api.coingecko.com/mcp',
    },
  })
}
```

## Adding Models

To add a new model, edit `apps/api/src/modules/ai/ai.config.ts`:

```typescript
export const modelConfigBase = {
  // ... existing models
  OPENAI_GPT_4_TURBO: {
    modelString: 'gpt-4-turbo',
    provider: 'openai' as ProviderName,
    isDefault: false,
  },
  GOOGLE_GEMINI_PRO: {
    modelString: 'gemini-pro',
    provider: 'google' as ProviderName,
    isDefault: false,
  },
} as const satisfies Record<string, ModelConfig>
```

**Steps:**
1. Add a new entry to `modelConfigBase` with:
   - A unique constant name (e.g., `OPENAI_GPT_4_TURBO`)
   - `modelString`: The actual model identifier used by the provider
   - `provider`: One of `'openai'`, `'google'`, `'anthropic'`, or `'mistral'`
   - `isDefault`: Set to `true` if this should be the default model
2. The model will be automatically registered when the module initializes
3. Use it by importing the constant: `import { OPENAI_GPT_4_TURBO } from '../modules/ai/ai.config'`

## Removing Models

To remove a model, simply delete its entry from `modelConfigBase` in `ai.config.ts`:

```typescript
export const modelConfigBase = {
  // Remove the model entry you don't want
  // OPENAI_GPT_5_NANO: { ... }, // Delete this
} as const
```

**Note:** Since no default model is configured, you must always specify a model when calling `generate()`.

## Creating Tools

Tools are created using the `tool()` function from the `ai` SDK. Create tools in the `tools/` directory.

### Basic Tool Structure

```typescript
// tools/my-tool.ts
import { tool } from 'ai'
import { z } from 'zod'

const myToolInputSchema = z.object({
  param1: z.string().describe('Description of param1'),
  param2: z.number().optional().describe('Description of param2'),
})

export const myTool = tool({
  description: 'What this tool does',
  inputSchema: myToolInputSchema,
  outputSchema: z.object({
    // Define your output schema
    result: z.string(),
  }),
  execute: async ({ param1, param2 }) => {
    // Your tool implementation
    // This function is called when the AI decides to use this tool
    return {
      result: 'Tool output',
    }
  },
})
```

### Using MCP Tools

You can also create MCP clients to get tools from MCP servers:

```typescript
// tools/my-mcp-tools.ts
import { createMCPClient } from '@ai-sdk/mcp'

export function createMyMCPClient() {
  return createMCPClient({
    transport: {
      type: 'http',
      url: 'https://your-mcp-server.com/mcp',
    },
  })
}

// Then in your controller or service:
const mcpClient = await createMyMCPClient()
const mcpTools = await mcpClient.tools()
// Use mcpTools in your tools object
```

### Example: CoinGecko Tool

See `tools/coingecko.tools.ts` for a complete example that includes:
- Custom tool creation with `tool()`
- MCP client creation
- Error handling
- Proper TypeScript typing

## Adding Providers

To add support for a new provider (e.g., Cohere, Mistral):

### 1. Install the Provider Package

```bash
cd apps/api
pnpm add @ai-sdk/cohere  # Example for Cohere
```

### 2. Add Provider Creation Function

Edit `apps/api/src/modules/ai/ai.providers.ts`:

```typescript
async function loadCohereProvider(apiKey: string): Promise<ProviderInstance> {
  if (!cohereProviderCache.has(apiKey)) {
    try {
      const { createCohere } = await import('@ai-sdk/cohere')
      const provider = createCohere({ apiKey })
      cohereProviderCache.set(apiKey, provider)
    }
    catch (error) {
      if (error instanceof Error && (error.message.includes('Cannot find module') || error.message.includes('Failed to resolve'))) {
        throw new Error('Cohere provider requires @ai-sdk/cohere package. Please install it: pnpm add @ai-sdk/cohere')
      }
      throw error
    }
  }
  return cohereProviderCache.get(apiKey)!
}

export async function createCohere({ apiKey }: { apiKey?: string }): Promise<ProviderInstance> {
  if (!apiKey) {
    throw new Error('COHERE_API_KEY is required for Cohere provider')
  }
  return loadCohereProvider(apiKey)
}
```

Don't forget to add the cache:
```typescript
const cohereProviderCache: Map<string, ProviderInstance> = new Map()
```

### 3. Add Environment Variable

Edit `apps/api/src/config/env.config.ts`:

```typescript
export const configValidationSchema = z.object({
  // ... existing variables
  COHERE_API_KEY: z.string().optional(),
})

export const config = {
  // ... existing config
  ai: {
    providers: {
      // ... existing providers
      cohere: {
        apiKey: configParsed.data.COHERE_API_KEY,
      },
    },
  },
}
```

### 4. Register Provider in Config

Edit `apps/api/src/modules/ai/ai.config.ts`:

```typescript
import { createCohere } from './ai.providers'

export const providers: {
  openai: ProviderInstance | null
  google: Promise<ProviderInstance> | null
  anthropic: Promise<ProviderInstance> | null
  cohere: Promise<ProviderInstance> | null  // Add new provider
} = {
  // ... existing providers
  cohere: config.ai.providers.cohere.apiKey ? createCohere({ apiKey: config.ai.providers.cohere.apiKey }) : null,
}
```

### 5. Update ProviderName Type

The `ProviderName` type is automatically inferred from the `providers` object, so no changes needed.

### 6. Add Models Using the New Provider

Now you can add models that use the new provider:

```typescript
export const modelConfigBase = {
  // ... existing models
  COHERE_COMMAND_R: {
    modelString: 'command-r',
    provider: 'cohere' as ProviderName,
    isDefault: false,
  },
} as const
```

## Removing Providers

To remove a provider:

1. **Remove from providers object** in `ai.config.ts`:
   ```typescript
   export const providers = {
     // Remove the provider entry
     // google: ...,
   }
   ```

2. **Remove environment variable** from `env.config.ts`:
   ```typescript
   // Remove GOOGLE_API_KEY from schema and config
   ```

3. **Remove provider creation function** from `ai.providers.ts` (optional, but recommended for cleanup)

4. **Remove any models** that use that provider from `modelConfigBase`

5. **Uninstall the package** (optional):
   ```bash
   pnpm remove @ai-sdk/google
   ```

## API Reference

### `generate<T>(options)`

Generates text or structured data using the configured AI model. Uses function overloads for type safety.

**Function Overloads:**
- `generate(input: AiGenerateInputWithoutSchema): Promise<AiGenerateResultText>` - Returns text result when no schema provided
- `generate<T>(input: AiGenerateInputWithSchema<T>): Promise<AiGenerateResultObject<T>>` - Returns typed object result when schema provided

**Parameters:**
- `prompt` (string, optional): The prompt to send to the model (for single-turn conversations). Either `prompt` or `messages` must be provided.
- `messages` (CoreMessage[], optional): Conversation history as an array of messages following Vercel AI SDK patterns. Either `prompt` or `messages` must be provided. If both are provided, `messages` takes precedence.
- `model` (ModelId, required): Model ID constant to use (e.g., `OPENAI_GPT_5_NANO`, `GOOGLE_GEMINI_3_FLASH`, `CLAUDE_HAIKU_3_5`, `MISTRAL_SMALL`)
- `options` (object, optional): Generation options
  - `temperature` (number, 0-2): Sampling temperature
  - `maxTokens` (number): Maximum tokens to generate
  - `topP` (number, 0-1): Nucleus sampling parameter
  - `frequencyPenalty` (number, -2 to 2): Frequency penalty
  - `presencePenalty` (number, -2 to 2): Presence penalty
  - `maxSteps` (number): Maximum tool calling steps
  - `stopWhen` (number): Stop condition for tool calling
- `schema` (ZodSchema, optional): Zod schema for response validation. When provided, response type is `'object'` with typed result
- `tools` (Record<string, Tool>, optional): Tools available for the AI to call. Tools are created using `tool()` from `ai` SDK or obtained from MCP clients. See "With Tool Calling" section for examples.
- `signal` (AbortSignal, optional): Signal for cancellation

**Returns:**

Discriminated union type based on whether schema is provided:

**When no schema (`type: 'text'`):**
- `type`: `'text'`
- `result`: `string` - Generated text
- `usage` (object, optional): Token usage information
  - `promptTokens` (number)
  - `completionTokens` (number)
  - `totalTokens` (number)
- `finishReason` (string, optional): Reason generation finished
- `messages` (CoreMessage[], optional): Updated conversation history including the assistant's response (only returned when `messages` was provided in input)
- `toolCalls` (array, optional): Tool calls made during generation
- `toolResults` (array, optional): Results from tool calls
- `abortController` (AbortController, optional): Controller for cancellation (only if no signal provided)

**When schema provided (`type: 'object'`):**
- `type`: `'object'`
- `result`: `T` - Parsed and validated result matching the schema type
- `usage` (object, optional): Token usage information
  - `promptTokens` (number)
  - `completionTokens` (number)
  - `totalTokens` (number)
- `finishReason` (string, optional): Reason generation finished
- `messages` (CoreMessage[], optional): Updated conversation history including the assistant's response (only returned when `messages` was provided in input)
- `toolCalls` (array, optional): Tool calls made during generation
- `toolResults` (array, optional): Results from tool calls
- `abortController` (AbortController, optional): Controller for cancellation (only if no signal provided)

## Langfuse Integration

All AI calls are automatically traced in Langfuse (if configured) with:
- Trace name: `ai.generate`
- **Full prompt/messages**: Both original and enhanced (with schema commands) prompts or messages are included
- Input: Complete enhanced prompt or messages array sent to the model
- Metadata: model ID, model name, prompt/message lengths, message count, schema presence, tool presence, options
- Token usage and costs
- Latency metrics
- Tool calls and results
- Error tracking

## Architecture

The module is organized into several files:

- **`ai.config.ts`**: Provider and model configuration
- **`ai.providers.ts`**: Provider creation functions using SDK `create*` methods
- **`ai.utils.ts`**: Helper functions for model retrieval and JSON sanitization
- **`ai.service.ts`**: Main service with `generate` method and function overloads
- **`contracts/ai.contract.ts`**: Zod schemas and discriminated union types for type safety
- **`ai.controller.ts`**: REST API controller for chat endpoint
- **`tools/`**: Tool definitions for AI function calling

## Error Handling

The service handles various error scenarios:
- **Model Provider Errors**: Thrown with clear error messages
- **Langfuse Connection Errors**: Logged but don't fail the request
- **Schema Validation Errors**: Thrown with detailed validation messages
- **Cancellation Errors**: Properly handled and logged in Langfuse

## Testing

When testing services that use `AiService`, you can mock it:

```typescript
// Mock for text generation
const mockAiService = {
  generate: jest.fn().mockResolvedValue({
    type: 'text' as const,
    result: 'Mocked response',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  }),
}

// Mock for object generation with schema
const mockAiServiceWithSchema = {
  generate: jest.fn().mockResolvedValue({
    type: 'object' as const,
    result: { name: 'John', age: 30 },
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  }),
}
```

## Troubleshooting

### Provider Not Available

If you get an error that a provider is not available:
1. Check that the API key is set in your `.env` file
2. Verify the API key is correct
3. Ensure the provider package is installed: `pnpm add @ai-sdk/[provider]`

### Model Not Found

If you get a "model is not registered" error:
1. Check that the model exists in `modelConfigBase`
2. Verify the model ID constant is imported correctly
3. Ensure the provider for that model has a configured API key

### Schema Validation Fails

If schema validation fails:
1. Check that the prompt includes clear instructions about JSON format
2. Verify the Zod schema matches the expected structure
3. Check Langfuse traces to see what the model actually returned
