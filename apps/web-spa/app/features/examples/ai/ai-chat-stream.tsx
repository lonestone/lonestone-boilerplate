import type { aiExampleControllerChat, ChatSchemaType } from '@boilerstone/openapi-generator'
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
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChatBubble } from './components/chat-bubble'
import { useChatConversation } from './use-chat-conversation'

/**
 * This components display a chat interface that uses the API chat streaming endpoint via SSE
 * Structured output for messages: this allows the user to choose a pre-defined schema type for the output, the schema type is passed to the server as a query parameter.
 * The server will pick it up and pass the correct zod schema to the LLM. It will also send back the schemaType in the last assistant message metadata, allowing us to customize the display via components.
 * This chat displays all messages (system, user and assistant), even those marked as metadata.isConsideredSystemMessage. You can adapt this to your own needs.
 * @returns JSX.Element
 */
export function AiChatStream() {
  const { t } = useTranslation()
  const [input, setInput] = React.useState('')
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const { messages, model, setModel, schemaType, setSchemaType, isStreaming, send, stop, clear } =
    useChatConversation()

  const scrollToBottom = React.useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  React.useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) {
      return
    }

    const messageText = input.trim()
    setInput('')
    send(messageText)
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('ai.chatStream.title')}</CardTitle>
            <CardDescription>{t('ai.chatStream.description')}</CardDescription>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={clear} disabled={isStreaming}>
              {t('ai.chatStream.clear')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[700px] overflow-y-auto border rounded-lg p-4 space-y-4 bg-muted/50">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              {t('ai.chatStream.emptyState')}
            </div>
          )}
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="model-select" className="text-xs">
                {t('ai.chatStream.model')}
              </Label>
              <Select
                value={model}
                onValueChange={(value) =>
                  setModel(value as Parameters<typeof aiExampleControllerChat>[0]['body']['model'])
                }
              >
                <SelectTrigger id="model-select" className="w-full">
                  <SelectValue placeholder={t('ai.chatStream.modelPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPENAI_GPT_5_NANO">OpenAI GPT-5 Nano</SelectItem>
                  <SelectItem value="GOOGLE_GEMINI_3_FLASH">Google Gemini 3 Flash</SelectItem>
                  <SelectItem value="CLAUDE_HAIKU_3_5">Claude Haiku 3.5</SelectItem>
                  <SelectItem value="CLAUDE_OPUS_4_5">Claude Opus 4.5</SelectItem>
                  <SelectItem value="MISTRAL_SMALL">Mistral Small</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="schema-select" className="text-xs">
                {t('ai.chatStream.structuredOutput')}
              </Label>
              <Select
                value={schemaType}
                onValueChange={(value) => setSchemaType(value as ChatSchemaType)}
              >
                <SelectTrigger id="schema-select" className="w-full">
                  <SelectValue placeholder={t('ai.chatStream.schemaPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('ai.chatStream.noSchema')}</SelectItem>
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
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('ai.chatStream.inputPlaceholder')}
              disabled={isStreaming}
              className="flex-1"
            />
            {isStreaming ? (
              <Button type="button" onClick={stop} variant="destructive">
                {t('ai.chatStream.stop')}
              </Button>
            ) : (
              <Button type="submit" disabled={!input.trim()}>
                {t('ai.chatStream.send')}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
