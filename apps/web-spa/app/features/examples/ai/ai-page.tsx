import { AiChatStream } from './ai-chat-stream'
import { AiGenerateObject } from './ai-generate-object'
import { AiGenerateText } from './ai-generate-text'

export default function AiPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">AI Examples</h1>
        <p className="text-muted-foreground">
          Explore different AI generation capabilities with these interactive examples.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <AiGenerateText />
        <AiGenerateObject />
      </div>

      <div className="flex justify-center">
        <AiChatStream />
      </div>
    </div>
  )
}
