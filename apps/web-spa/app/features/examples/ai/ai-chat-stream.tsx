import type { AiCoreMessage, aiExampleControllerChat, AiStreamEvent, ChatSchemaType } from '@boilerstone/openapi-generator'
import type { ChatMessage } from './components/chat-bubble'
import { createSseClient } from '@boilerstone/openapi-generator'
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
import { ChatBubble } from './components/chat-bubble'

const CONVERSATION_STORAGE_KEY = 'ai-chat-stream-conversation'

/**
 * Convert our local messages to the format expected by the server.
 * Be careful not to strip too much data. But in the end it's up to you to choose how you merge frontend-only data with server-side data.
 * @param messages
 * @returns AiCoreMessage[]
 */
function convertMessagesForServer(messages: ChatMessage[]): AiCoreMessage[] {
  return messages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
    .map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      metadata: msg.metadata,
    }))
}

/**
 * Load the conversation from local storage.
 * @returns ChatMessage[]
 */
function loadConversationFromStorage(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(CONVERSATION_STORAGE_KEY)
    if (!stored) {
      return []
    }
    const parsed = JSON.parse(stored)
    return parsed.map((msg: ChatMessage & { timestamp?: string }) => ({
      ...msg,
    }))
  }
  catch {
    return []
  }
}

/**
 * Save the conversation to local storage.
 * Silently fail if storage is unavailable -> you should handle this in your own way.
 * @param messages
 */
function saveConversationToStorage(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(messages))
  }
  catch {
    // Silently fail if storage is unavailable
  }
}

/**
 * This components display a chat interface that uses the API chat streaming endpoint via SSE
 * Structured output for messages: this allows the user to choose a pre-defined schema type for the output, the schema type is passed to the server as a query parameter.
 * The server will pick it up and pass the correct zod schema to the LLM. It will also send back the schemaType in the last assistant message metadata, allowing us to customize the display via components.
 * This chat displays all messages (system, user and assistant), even those marked as metadata.isConsideredSystemMessage. You can adapt this to your own needs.
 * @returns JSX.Element
 */
export function AiChatStream() {
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => loadConversationFromStorage())
  const [input, setInput] = React.useState('')
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [abortController, setAbortController] = React.useState<AbortController | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const [model, setModel] = React.useState<Parameters<typeof aiExampleControllerChat>[0]['body']['model']>('GOOGLE_GEMINI_3_FLASH')
  const [schemaType, setSchemaType] = React.useState<ChatSchemaType>('none')

  const scrollToBottom = React.useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  React.useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Core logic for message streaming
  const handleStreamMessage = React.useCallback(async (messageText: string, conversationHistory: AiCoreMessage[]) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      metadata: {
        timestamp: new Date(),
      },
    }

    const assistantMessageId = `assistant-${Date.now()}`
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
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
        url: `${apiUrl}/api/ai/stream-chat`,
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
                    metadata: {
                      ...msg.metadata,
                      usage: event.usage,
                      finishReason: event.finishReason,
                    },
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

  // Core logic for user message handling
  const handleChatMessage = React.useCallback(async (messageText: string, conversationHistory: AiCoreMessage[], selectedSchemaType: ChatSchemaType) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      metadata: {
        timestamp: new Date(),
      },
    }

    const assistantMessageId = `assistant-${Date.now()}`
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
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
        schemaType: selectedSchemaType,
      }

      const response = await fetch(`${apiUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // The backend returns the full conversation history with metadata preserved.
      // usage and finishReason are now in each message's metadata (added by backend).
      setMessages(() => {
        const backendMessages: AiCoreMessage[] = data.messages || []

        const updated: ChatMessage[] = backendMessages.map((msg, idx) => ({
          ...msg,
          id: `msg-${Date.now()}-${idx}`,

        }))

        saveConversationToStorage(updated)
        return updated
      })
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
        const errorMessage = error instanceof Error ? error.message : 'Failed to get response'
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

    const conversationHistory = convertMessagesForServer(messages)

    if (schemaType !== 'none') {
      handleChatMessage(messageText, conversationHistory, schemaType)
    }
    else {
      handleStreamMessage(messageText, conversationHistory)
    }
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
          {messages.map(message => (
            <ChatBubble key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="model-select" className="text-xs">Model</Label>
              <Select value={model} onValueChange={value => setModel(value as Parameters<typeof aiExampleControllerChat>[0]['body']['model'])}>
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
            <div className="flex-1 space-y-1">
              <Label htmlFor="schema-select" className="text-xs">Structured Output</Label>
              <Select value={schemaType} onValueChange={value => setSchemaType(value as ChatSchemaType)}>
                <SelectTrigger id="schema-select" className="w-full">
                  <SelectValue placeholder="Select output format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No schema (streaming)</SelectItem>
                  <SelectItem value="userProfile">User Profile</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="recipe">Recipe</SelectItem>
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
