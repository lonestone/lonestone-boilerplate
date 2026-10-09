import type {
  AiCoreMessage,
  aiExampleControllerChat,
  AiStreamEvent,
  ChatSchemaType,
} from '@boilerstone/openapi-generator'
import type { ChatMessage } from './components/chat-bubble'
import { createSseClient } from '@boilerstone/openapi-generator'
import * as React from 'react'

type ChatModel = Parameters<typeof aiExampleControllerChat>[0]['body']['model']

export interface UseChatConversationResult {
  messages: ChatMessage[]
  model: ChatModel
  setModel: (model: ChatModel) => void
  schemaType: ChatSchemaType
  setSchemaType: (schemaType: ChatSchemaType) => void
  isStreaming: boolean
  send: (messageText: string) => void
  stop: () => void
  clear: () => void
}

/**
 * Holds the chat state: messages, streaming status, model and schema type.
 * Sends go through SSE streaming, or through plain JSON when a schema type is picked.
 * @returns UseChatConversationResult
 */
export function useChatConversation(): UseChatConversationResult {
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => loadConversationFromStorage())
  const [abortController, setAbortController] = React.useState<AbortController | null>(null)
  const isStreaming = abortController !== null
  const [model, setModel] = React.useState<ChatModel>('GOOGLE_GEMINI_3_FLASH')
  const [schemaType, setSchemaType] = React.useState<ChatSchemaType>('none')

  // Core logic for message streaming
  const handleStreamMessage = React.useCallback(
    async (messageText: string, conversationHistory: AiCoreMessage[]) => {
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
        saveConversationToStorage(updated.filter((msg) => !msg.isStreaming))
        return updated
      })

      const controller = new AbortController()
      setAbortController(controller)

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
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + event.text, isUsingTool: undefined }
                  : msg,
              ),
            )
          } else if (event.type === 'tool-call') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      isUsingTool: event.toolName,
                      toolUsages: [
                        ...(msg.toolUsages || []),
                        {
                          toolCallId: event.toolCallId,
                          toolName: event.toolName,
                          args: event.args,
                        },
                      ],
                    }
                  : msg,
              ),
            )
          } else if (event.type === 'tool-result') {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== assistantMessageId) return msg
                const toolUsages = msg.toolUsages?.map((tu) =>
                  tu.toolCallId === event.toolCallId ? { ...tu, result: event.result } : tu,
                )
                return { ...msg, isUsingTool: undefined, toolUsages }
              }),
            )
          } else if (event.type === 'done') {
            setMessages((prev) => {
              const updated = prev.map((msg) =>
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
          } else if (event.type === 'error') {
            setMessages((prev) => {
              const updated = prev.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      content: `Error: ${event.message}`,
                      isStreaming: false,
                      isUsingTool: undefined,
                    }
                  : msg,
              )
              saveConversationToStorage(updated)
              return updated
            })
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setMessages((prev) => {
            const updated = prev.filter((msg) => msg.id !== assistantMessageId)
            saveConversationToStorage(updated)
            return updated
          })
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Failed to stream response'
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: `Error: ${errorMessage}`, isStreaming: false }
                : msg,
            )
            saveConversationToStorage(updated)
            return updated
          })
        }
      } finally {
        setAbortController((current) => (current === controller ? null : current))
      }
    },
    [model],
  )

  // Core logic for user message handling
  const handleChatMessage = React.useCallback(
    async (
      messageText: string,
      conversationHistory: AiCoreMessage[],
      selectedSchemaType: ChatSchemaType,
    ) => {
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
        saveConversationToStorage(updated.filter((msg) => !msg.isStreaming))
        return updated
      })

      const controller = new AbortController()
      setAbortController(controller)

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
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setMessages((prev) => {
            const updated = prev.filter((msg) => msg.id !== assistantMessageId)
            saveConversationToStorage(updated)
            return updated
          })
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Failed to get response'
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: `Error: ${errorMessage}`, isStreaming: false }
                : msg,
            )
            saveConversationToStorage(updated)
            return updated
          })
        }
      } finally {
        setAbortController((current) => (current === controller ? null : current))
      }
    },
    [model],
  )

  const send = (messageText: string): void => {
    const conversationHistory = convertMessagesForServer(messages)

    if (schemaType !== 'none') {
      handleChatMessage(messageText, conversationHistory, schemaType)
    } else {
      handleStreamMessage(messageText, conversationHistory)
    }
  }

  const stop = (): void => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
  }

  const clear = (): void => {
    setMessages([])
    localStorage.removeItem(CONVERSATION_STORAGE_KEY)
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
  }

  return {
    messages,
    model,
    setModel,
    schemaType,
    setSchemaType,
    isStreaming,
    send,
    stop,
    clear,
  }
}

/**
 * Convert our local messages to the format expected by the server.
 * Be careful not to strip too much data. But in the end it's up to you to choose how you merge frontend-only data with server-side data.
 * @param messages
 * @returns AiCoreMessage[]
 */
function convertMessagesForServer(messages: ChatMessage[]): AiCoreMessage[] {
  return messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
    .map((msg) => ({
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
  } catch {
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
  } catch {
    // Silently fail if storage is unavailable
  }
}

const CONVERSATION_STORAGE_KEY = 'ai-chat-stream-conversation'
