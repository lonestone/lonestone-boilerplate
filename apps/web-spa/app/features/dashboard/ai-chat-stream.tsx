import type { aiControllerChat, AiStreamEvent, CoreMessage } from '@boilerstone/openapi-generator'
import { createSseClient } from '@boilerstone/openapi-generator'
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
import * as React from 'react'

const CONVERSATION_STORAGE_KEY = 'ai-chat-stream-conversation'

interface ToolUsage {
  toolCallId: string
  toolName: string
  args?: Record<string, unknown>
  result?: unknown
}

interface Message extends CoreMessage {
  id: string
  timestamp: Date
  isStreaming?: boolean
  isUsingTool?: string
  toolUsages?: ToolUsage[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason?: string
}

function convertMessagesToCoreMessages(messages: Message[]): CoreMessage[] {
  return messages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))
}

function loadConversationFromStorage(): Message[] {
  try {
    const stored = localStorage.getItem(CONVERSATION_STORAGE_KEY)
    if (!stored) {
      return []
    }
    const parsed = JSON.parse(stored)
    return parsed.map((msg: Omit<Message, 'timestamp'> & { timestamp: string }) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }))
  }
  catch {
    return []
  }
}

function saveConversationToStorage(messages: Message[]): void {
  try {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(messages))
  }
  catch {
    // Silently fail if storage is unavailable
  }
}

export function AiChatStream() {
  const [messages, setMessages] = React.useState<Message[]>(() => loadConversationFromStorage())
  const [input, setInput] = React.useState('')
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [abortController, setAbortController] = React.useState<AbortController | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const [model, setModel] = React.useState<Parameters<typeof aiControllerChat>[0]['body']['model']>('GOOGLE_GEMINI_3_FLASH')

  const scrollToBottom = React.useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  React.useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleStreamMessage = React.useCallback(async (messageText: string, conversationHistory: CoreMessage[]) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    }

    const assistantMessageId = `assistant-${Date.now()}`
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }

    setMessages((prev) => {
      const updated = [...prev, userMessage, assistantMessage]
      saveConversationToStorage(updated.filter(msg => !msg.isStreaming))
      return updated
    })

    const controller = new AbortController()
    setAbortController(controller)
    setIsStreaming(true)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const requestBody = {
        messages: [...conversationHistory, { role: 'user' as const, content: messageText }],
        model,
      }

      const { stream } = createSseClient<AiStreamEvent>({
        url: `${apiUrl}/api/ai/stream`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        serializedBody: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      for await (const event of stream as AsyncGenerator<AiStreamEvent>) {
        if (event.type === 'chunk') {
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + event.text, isUsingTool: undefined }
              : msg,
          ))
        }
        else if (event.type === 'tool-call') {
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  isUsingTool: event.toolName,
                  toolUsages: [
                    ...(msg.toolUsages || []),
                    { toolCallId: event.toolCallId, toolName: event.toolName, args: event.args },
                  ],
                }
              : msg,
          ))
        }
        else if (event.type === 'tool-result') {
          setMessages(prev => prev.map((msg) => {
            if (msg.id !== assistantMessageId)
              return msg
            const toolUsages = msg.toolUsages?.map(tu =>
              tu.toolCallId === event.toolCallId
                ? { ...tu, result: event.result }
                : tu,
            )
            return { ...msg, isUsingTool: undefined, toolUsages }
          }))
        }
        else if (event.type === 'done') {
          setMessages((prev) => {
            const updated = prev.map(msg =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    isStreaming: false,
                    isUsingTool: undefined,
                    usage: event.usage,
                    finishReason: event.finishReason,
                  }
                : msg,
            )
            saveConversationToStorage(updated)
            return updated
          })
        }
        else if (event.type === 'error') {
          setMessages((prev) => {
            const updated = prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: `Error: ${event.message}`, isStreaming: false, isUsingTool: undefined }
                : msg,
            )
            saveConversationToStorage(updated)
            return updated
          })
        }
      }
    }
    catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setMessages((prev) => {
          const updated = prev.filter(msg => msg.id !== assistantMessageId)
          saveConversationToStorage(updated)
          return updated
        })
      }
      else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to stream response'
        setMessages((prev) => {
          const updated = prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: `Error: ${errorMessage}`, isStreaming: false }
              : msg,
          )
          saveConversationToStorage(updated)
          return updated
        })
      }
    }
    finally {
      setIsStreaming(false)
      setAbortController(null)
    }
  }, [model])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) {
      return
    }

    const messageText = input.trim()
    setInput('')

    const conversationHistory = convertMessagesToCoreMessages(messages)
    handleStreamMessage(messageText, conversationHistory)
  }

  const handleStop = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      setIsStreaming(false)
    }
  }

  const handleClearConversation = () => {
    setMessages([])
    localStorage.removeItem(CONVERSATION_STORAGE_KEY)
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      setIsStreaming(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AI Chat (Streaming)</CardTitle>
            <CardDescription>Real-time streaming AI responses</CardDescription>
          </div>
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearConversation}
              disabled={isStreaming}
            >
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[700px] overflow-y-auto border rounded-lg p-4 space-y-4 bg-muted/50">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              Start a conversation by sending a message
            </div>
          )}
          {messages
            .filter(message => message.role === 'user' || message.role === 'assistant')
            .map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background border'
                  }`}
                >
                  {message.role === 'assistant' && message.isStreaming && (
                    <div className="mb-2 flex gap-2">
                      <Badge variant="secondary" className="animate-pulse">
                        Streaming...
                      </Badge>
                      {message.isUsingTool && (
                        <Badge variant="outline" className="animate-pulse">
                          Using
                          {' '}
                          {message.isUsingTool}
                          ...
                        </Badge>
                      )}
                    </div>
                  )}
                  {message.toolUsages && message.toolUsages.length > 0 && (
                    <div className="mb-2 text-xs text-muted-foreground border rounded p-2 bg-muted/30">
                      <div className="font-medium mb-1">Tools used:</div>
                      {message.toolUsages.map(tu => (
                        <div key={tu.toolCallId} className="ml-2">
                          •
                          {' '}
                          {tu.toolName}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap wrap-break-word">
                    {message.content || (message.isStreaming ? '...' : '')}
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                    )}
                  </div>
                  {message.usage && (
                    <div className="mt-2 pt-2 border-t border-muted">
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex gap-4">
                          <span>
                            Tokens:
                            {message.usage.totalTokens}
                          </span>
                          <span>
                            Prompt:
                            {message.usage.promptTokens}
                          </span>
                          <span>
                            Completion:
                            {message.usage.completionTokens}
                          </span>
                        </div>
                        {message.finishReason && (
                          <div>
                            Finish reason:
                            {message.finishReason}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="model-select" className="text-xs">Model</Label>
              <Select value={model} onValueChange={value => setModel(value as Parameters<typeof aiControllerChat>[0]['body']['model'])}>
                <SelectTrigger id="model-select" className="w-full">
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
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isStreaming}
              className="flex-1"
            />
            {isStreaming
              ? (
                  <Button type="button" onClick={handleStop} variant="destructive">
                    Stop
                  </Button>
                )
              : (
                  <Button type="submit" disabled={!input.trim()}>
                    Send
                  </Button>
                )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
