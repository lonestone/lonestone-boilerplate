import type { ChatMessageWithSchemaType } from '@boilerstone/openapi-generator'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Button } from '@boilerstone/ui/components/primitives/button'
import * as React from 'react'
import { StructuredOutputDisplay } from './structured-output-display'

interface ToolUsage {
  toolCallId: string
  toolName: string
  args?: Record<string, unknown>
  result?: unknown
}

export interface ChatMessage extends ChatMessageWithSchemaType {
  id: string
  isStreaming?: boolean
  isUsingTool?: string
  toolUsages?: ToolUsage[]
}

interface ChatBubbleProps {
  message: ChatMessage
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const [showMetadata, setShowMetadata] = React.useState(false)
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system' || message.metadata?.isConsideredSystemMessage
  const schemaType = message.metadata?.schemaType

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : isSystem
              ? 'bg-muted/70 text-muted-foreground border border-dashed text-xs'
              : 'bg-background border'
        }`}
      >
        {isSystem && (
          <Badge variant="secondary" className="mb-2 text-[10px]">
            System
          </Badge>
        )}

        {message.role === 'assistant' && message.isStreaming && (
          <StreamingIndicator isUsingTool={message.isUsingTool} />
        )}

        {message.toolUsages && message.toolUsages.length > 0 && (
          <ToolUsageDisplay toolUsages={message.toolUsages} />
        )}

        {schemaType
          ? (
              <StructuredOutputDisplay
                content={message.content}
                schemaType={schemaType}
              />
            )
          : (
              <MessageContent message={message} />
            )}

        {message.metadata?.usage && (
          <UsageStats
            usage={message.metadata.usage}
            finishReason={message.metadata.finishReason}
          />
        )}

        <div className="mt-2 pt-2 border-t border-muted/50">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowMetadata(!showMetadata)}
          >
            {showMetadata ? 'Hide metadata' : 'Show metadata'}
          </Button>
          {showMetadata && <MetadataDisplay message={message} />}
        </div>
      </div>
    </div>
  )
}

interface StreamingIndicatorProps {
  isUsingTool?: string
}

function StreamingIndicator({ isUsingTool }: StreamingIndicatorProps) {
  return (
    <div className="mb-2 flex gap-2">
      <Badge variant="secondary" className="animate-pulse">
        Streaming...
      </Badge>
      {isUsingTool && (
        <Badge variant="outline" className="animate-pulse">
          Using
          {' '}
          {isUsingTool}
          ...
        </Badge>
      )}
    </div>
  )
}

interface ToolUsageDisplayProps {
  toolUsages: ToolUsage[]
}

function ToolUsageDisplay({ toolUsages }: ToolUsageDisplayProps) {
  return (
    <div className="mb-2 text-xs text-muted-foreground border rounded p-2 bg-muted/30">
      <div className="font-medium mb-1">Tools used:</div>
      {toolUsages.map(tu => (
        <div key={tu.toolCallId} className="ml-2">
          •
          {' '}
          {tu.toolName}
        </div>
      ))}
    </div>
  )
}

interface MessageContentProps {
  message: ChatMessage
}

function MessageContent({ message }: MessageContentProps) {
  return (
    <div className="text-sm whitespace-pre-wrap wrap-break-word">
      {message.content || (message.isStreaming ? '...' : '')}
      {message.isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
      )}
    </div>
  )
}

interface UsageStatsProps {
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason?: string
}

function UsageStats({ usage, finishReason }: UsageStatsProps) {
  return (
    <div className="mt-2 pt-2 border-t border-muted">
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex gap-4">
          <span>
            Tokens:
            {usage.totalTokens}
          </span>
          <span>
            Prompt:
            {usage.promptTokens}
          </span>
          <span>
            Completion:
            {usage.completionTokens}
          </span>
        </div>
        {finishReason && (
          <div>
            Finish reason:
            {finishReason}
          </div>
        )}
      </div>
    </div>
  )
}

interface MetadataDisplayProps {
  message: ChatMessage
}

function MetadataDisplay({ message }: MetadataDisplayProps) {
  const displayObj = {
    id: message.id,
    role: message.role,
    content: message.content,
    ...(message.metadata && { metadata: message.metadata }),
    ...(message.isStreaming !== undefined && { isStreaming: message.isStreaming }),
    ...(message.isUsingTool && { isUsingTool: message.isUsingTool }),
    ...(message.toolUsages && message.toolUsages.length > 0 && { toolUsages: message.toolUsages }),
  }

  return (
    <div className="mt-2">
      <pre className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap break-all">
        {JSON.stringify(displayObj, null, 2)}
      </pre>
    </div>
  )
}
