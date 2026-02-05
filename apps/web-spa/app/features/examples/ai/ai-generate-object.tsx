import type { AiStreamEvent, GenerateObjectResponse, Recipe } from '@boilerstone/openapi-generator'
import { aiExampleControllerGenerateObject, createSseClient } from '@boilerstone/openapi-generator'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Button } from '@boilerstone/ui/components/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@boilerstone/ui/components/primitives/card'
import { Input } from '@boilerstone/ui/components/primitives/input'
import { Label } from '@boilerstone/ui/components/primitives/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@boilerstone/ui/components/primitives/select'
import { Switch } from '@boilerstone/ui/components/primitives/switch'
import * as React from 'react'

interface StreamingState {
  text: string
  isStreaming: boolean
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason?: string
}

/**
 * This component uses the API `generateObject` endpoint to generate a recipe.
 * It can also use the API `streamObject` endpoint to stream the response, in which case the json is streamed chunk by chunk
 * @returns JSX.Element
 */
export function AiGenerateObject() {
  const [prompt, setPrompt] = React.useState('')
  const [response, setResponse] = React.useState<GenerateObjectResponse | null>(null)
  const [streamingState, setStreamingState] = React.useState<StreamingState | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [model, setModel] = React.useState<Parameters<typeof aiExampleControllerGenerateObject>[0]['body']['model']>('GOOGLE_GEMINI_3_FLASH')
  const [useStreaming, setUseStreaming] = React.useState(false)
  const [showJson, setShowJson] = React.useState(false)
  const [abortController, setAbortController] = React.useState<AbortController | null>(null)

  // Core logic for streaming the response
  const handleStreamingSubmit = async (promptText: string) => {
    const controller = new AbortController()
    setAbortController(controller)

    setStreamingState({ text: '', isStreaming: true })

    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const requestBody = {
        prompt: `Generate a cooking recipe in JSON format with the following structure: { name, description, prepTime, cookTime, servings, difficulty (easy/medium/hard), ingredients (array of {name, quantity}), instructions (array of strings), tips (optional array of strings) }. Request: ${promptText}`,
        model,
      }

      // Note that the OpenAPI generator won't generate methods for each SSE endpoints, so we need to create the client manually via the exposed createSseClient
      const { stream } = createSseClient<AiStreamEvent>({
        url: `${apiUrl}/api/ai/stream-object`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        serializedBody: JSON.stringify({ ...requestBody, schemaType: 'recipe' }),
        signal: controller.signal,
      })

      for await (const event of stream as AsyncGenerator<AiStreamEvent>) {
        if (event.type === 'chunk') {
          setStreamingState(prev => prev ? { ...prev, text: prev.text + event.text } : null)
        }
        else if (event.type === 'done') {
          setStreamingState(prev => prev
            ? {
                ...prev,
                isStreaming: false,
                usage: event.usage,
                finishReason: event.finishReason,
              }
            : null)
        }
        else if (event.type === 'error') {
          throw new Error(event.message)
        }
      }
    }
    catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStreamingState(null)
      }
      else {
        setError(err instanceof Error ? err.message : 'An error occurred')
        setStreamingState(null)
      }
    }
    finally {
      setIsLoading(false)
      setAbortController(null)
    }
  }

  // Core logic for regular submission
  const handleRegularSubmit = async (promptText: string) => {
    try {
      const { data, error: apiError } = await aiExampleControllerGenerateObject({
        body: {
          prompt: promptText,
          model,
          schemaType: 'recipe',
        },
      })

      if (apiError) {
        throw new Error('Request failed')
      }

      setResponse(data ?? null)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
    finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isLoading) {
      return
    }

    setIsLoading(true)
    setError(null)
    setResponse(null)
    setStreamingState(null)
    setShowJson(false)

    const promptText = prompt.trim()

    if (useStreaming) {
      await handleStreamingSubmit(promptText)
    }
    else {
      await handleRegularSubmit(promptText)
    }
  }

  const handleStop = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setPrompt('')
    setResponse(null)
    setStreamingState(null)
    setError(null)
    setShowJson(false)
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
  }

  const parseStreamingResult = (): Recipe | null => {
    if (!streamingState?.text)
      return null
    try {
      // eslint-disable-next-line regexp/no-super-linear-backtracking
      const jsonMatch = streamingState.text.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonText = jsonMatch ? jsonMatch[1] : streamingState.text
      return JSON.parse(jsonText)
    }
    catch {
      return null
    }
  }

  const recipe = useStreaming
    ? (streamingState && !streamingState.isStreaming ? parseStreamingResult() : null)
    : (response?.result as Recipe | undefined)

  const displayUsage = streamingState?.usage ?? response?.usage
  const displayFinishReason = streamingState?.finishReason ?? response?.finishReason
  const hasResult = recipe || streamingState?.isStreaming

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Generate Object (Recipe)</CardTitle>
            <CardDescription>Structured output generation with a predefined schema</CardDescription>
          </div>
          {(hasResult || error) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={isLoading && !streamingState?.isStreaming}
            >
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="model-select-object">Model</Label>
              <Select value={model} onValueChange={value => setModel(value as Parameters<typeof aiExampleControllerGenerateObject>[0]['body']['model'])}>
                <SelectTrigger id="model-select-object" className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPENAI_GPT_5_NANO">OpenAI GPT-5 Nano</SelectItem>
                  <SelectItem value="GOOGLE_GEMINI_3_FLASH">Google Gemini 3 Flash</SelectItem>
                  <SelectItem value="CLAUDE_HAIKU_3_5">Claude Haiku 3.5</SelectItem>
                  <SelectItem value="MISTRAL_SMALL">Mistral Small</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Switch
                id="streaming-toggle-object"
                checked={useStreaming}
                onCheckedChange={setUseStreaming}
                disabled={isLoading}
              />
              <Label htmlFor="streaming-toggle-object" className="text-sm cursor-pointer">
                Stream
              </Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Give me a recipe for chocolate chip cookies..."
              disabled={isLoading}
              className="flex-1"
            />
            {streamingState?.isStreaming
              ? (
                  <Button type="button" onClick={handleStop} variant="destructive">
                    Stop
                  </Button>
                )
              : (
                  <Button type="submit" disabled={!prompt.trim() || isLoading}>
                    {isLoading ? 'Generating...' : 'Generate'}
                  </Button>
                )}
          </div>
        </form>

        {error && (
          <div className="border rounded-lg p-4 bg-destructive/10 text-destructive">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {streamingState?.isStreaming && (
          <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Streaming</Badge>
              <Badge variant="outline" className="animate-pulse">Generating recipe...</Badge>
            </div>
            <div className="text-sm whitespace-pre-wrap font-mono text-xs max-h-[300px] overflow-y-auto">
              {streamingState.text}
              <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
            </div>
          </div>
        )}

        {recipe && !streamingState?.isStreaming && (
          <div className="border rounded-lg p-4 bg-muted/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{recipe.name}</h3>
                <Badge variant={recipe.difficulty === 'easy' ? 'secondary' : recipe.difficulty === 'medium' ? 'default' : 'destructive'}>
                  {recipe.difficulty}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowJson(!showJson)}
                className="text-xs"
              >
                {showJson ? 'Hide JSON' : 'Show JSON'}
              </Button>
            </div>

            {showJson
              ? (
                  <pre className="text-xs bg-background border rounded p-3 overflow-x-auto max-h-[400px] overflow-y-auto">
                    {JSON.stringify(recipe, null, 2)}
                  </pre>
                )
              : (
                  <>
                    <p className="text-sm text-muted-foreground">{recipe.description}</p>

                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Prep:</span>
                        {recipe.prepTime}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Cook:</span>
                        {recipe.cookTime}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Servings:</span>
                        {recipe.servings}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">Ingredients</h4>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {recipe.ingredients.map((ing, idx) => (
                          <li key={idx}>
                            {ing.quantity}
                            {' '}
                            {ing.name}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">Instructions</h4>
                      <ol className="list-decimal list-inside text-sm space-y-2">
                        {recipe.instructions.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    {recipe.tips && recipe.tips.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Tips</h4>
                        <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                          {recipe.tips.map((tip, idx) => (
                            <li key={idx}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

            {displayUsage && (
              <div className="pt-2 border-t border-muted">
                <div className="text-xs text-muted-foreground flex gap-4">
                  <span>
                    Total:
                    {' '}
                    {displayUsage.totalTokens}
                    {' '}
                    tokens
                  </span>
                  <span>
                    Prompt:
                    {' '}
                    {displayUsage.promptTokens}
                  </span>
                  <span>
                    Completion:
                    {' '}
                    {displayUsage.completionTokens}
                  </span>
                  {displayFinishReason && (
                    <span>
                      Finish:
                      {' '}
                      {displayFinishReason}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
