import type { AiStreamEvent, GenerateTextResponse } from '@boilerstone/openapi-generator'
import { aiExampleControllerGenerateText, createSseClient } from '@boilerstone/openapi-generator'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Button } from '@boilerstone/ui/components/primitives/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@boilerstone/ui/components/primitives/card'
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
import { useTranslation } from 'react-i18next'

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
 * This component uses the API `generateText` endpoint to generate a text.
 * It can also use the API `streamText` endpoint to stream the response, in which case the text is streamed chunk by chunk
 * @returns JSX.Element
 */
export function AiGenerateText() {
  const { t } = useTranslation()
  const [prompt, setPrompt] = React.useState('')
  const [response, setResponse] = React.useState<GenerateTextResponse | null>(null)
  const [streamingState, setStreamingState] = React.useState<StreamingState | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [model, setModel] =
    React.useState<Parameters<typeof aiExampleControllerGenerateText>[0]['body']['model']>(
      'GOOGLE_GEMINI_3_FLASH',
    )
  const [useStreaming, setUseStreaming] = React.useState(false)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  // Core logic for streaming the response
  const handleStreamingSubmit = async (promptText: string) => {
    const controller = new AbortController()
    abortControllerRef.current = controller

    setStreamingState({ text: '', isStreaming: true })

    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const requestBody = {
        prompt: promptText,
        model,
      }

      const { stream } = createSseClient<AiStreamEvent>({
        url: `${apiUrl}/api/ai/stream-text`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        serializedBody: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      let hasReceivedDone = false

      for await (const event of stream as AsyncGenerator<AiStreamEvent>) {
        if (event.type === 'chunk') {
          setStreamingState((prev) => (prev ? { ...prev, text: prev.text + event.text } : null))
        } else if (event.type === 'done') {
          hasReceivedDone = true
          setStreamingState((prev) =>
            prev
              ? {
                  ...prev,
                  isStreaming: false,
                  usage: event.usage,
                  finishReason: event.finishReason,
                }
              : null,
          )
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      }

      if (!hasReceivedDone) {
        setStreamingState((prev) => (prev ? { ...prev, isStreaming: false } : null))
        setError(t('ai.generateText.streamEnded'))
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStreamingState(null)
      } else {
        setError(err instanceof Error ? err.message : t('ai.generateText.unknownError'))
        setStreamingState(null)
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  // Core logic for regular submission
  const handleRegularSubmit = async (promptText: string) => {
    try {
      const { data, error: apiError } = await aiExampleControllerGenerateText({
        body: {
          prompt: promptText,
          model,
        },
      })

      if (apiError) {
        throw new Error(t('ai.generateText.requestFailed'))
      }

      setResponse(data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ai.generateText.unknownError'))
    } finally {
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

    const promptText = prompt.trim()

    if (useStreaming) {
      await handleStreamingSubmit(promptText)
    } else {
      await handleRegularSubmit(promptText)
    }
  }

  const handleStop = () => {
    const controller = abortControllerRef.current
    if (controller) {
      controller.abort()
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setPrompt('')
    setResponse(null)
    setStreamingState(null)
    setError(null)
    const controller = abortControllerRef.current
    if (controller) {
      controller.abort()
      abortControllerRef.current = null
    }
  }

  const displayResult =
    streamingState?.text ?? (typeof response?.result === 'string' ? response.result : null)
  const displayUsage = streamingState?.usage ?? response?.usage
  const displayFinishReason = streamingState?.finishReason ?? response?.finishReason
  const hasResult = displayResult || streamingState?.isStreaming

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('ai.generateText.title')}</CardTitle>
            <CardDescription>{t('ai.generateText.description')}</CardDescription>
          </div>
          {(hasResult || error) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={isLoading && !streamingState?.isStreaming}
            >
              {t('ai.generateText.clear')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="model-select-text">{t('ai.generateText.model')}</Label>
              <Select
                value={model}
                onValueChange={(value) =>
                  setModel(
                    value as Parameters<typeof aiExampleControllerGenerateText>[0]['body']['model'],
                  )
                }
              >
                <SelectTrigger id="model-select-text" className="w-full">
                  <SelectValue placeholder={t('ai.generateText.modelPlaceholder')} />
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
                id="streaming-toggle-text"
                checked={useStreaming}
                onCheckedChange={setUseStreaming}
                disabled={isLoading}
              />
              <Label htmlFor="streaming-toggle-text" className="text-sm cursor-pointer">
                {t('ai.generateText.stream')}
              </Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('ai.generateText.promptPlaceholder')}
              disabled={isLoading}
              className="flex-1"
            />
            {streamingState?.isStreaming ? (
              <Button type="button" onClick={handleStop} variant="destructive">
                {t('ai.generateText.stop')}
              </Button>
            ) : (
              <Button type="submit" disabled={!prompt.trim() || isLoading}>
                {isLoading ? t('ai.generateText.generating') : t('ai.generateText.generate')}
              </Button>
            )}
          </div>
        </form>

        {error && (
          <div className="border rounded-lg p-4 bg-destructive/10 text-destructive">
            <p className="font-medium">{t('ai.generateText.error')}</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {hasResult && (
          <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{t('ai.generateText.response')}</Badge>
              {streamingState?.isStreaming && (
                <Badge variant="outline" className="animate-pulse">
                  {t('ai.generateText.streaming')}
                </Badge>
              )}
              {displayFinishReason && !streamingState?.isStreaming && (
                <Badge variant="outline">{displayFinishReason}</Badge>
              )}
            </div>
            <div className="text-sm whitespace-pre-wrap">
              {displayResult}
              {streamingState?.isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
              )}
            </div>
            {displayUsage && !streamingState?.isStreaming && (
              <div className="pt-2 border-t border-muted">
                <div className="text-xs text-muted-foreground flex gap-4">
                  <span>{t('ai.generateText.total', { count: displayUsage.totalTokens })}</span>
                  <span>
                    {t('ai.generateText.prompt')} {displayUsage.promptTokens}
                  </span>
                  <span>
                    {t('ai.generateText.completion')} {displayUsage.completionTokens}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
