import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Bot, MessageSquare, Sparkles, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AiChatStream } from './ai-chat-stream'
import { AiGenerateObject } from './ai-generate-object'
import { AiGenerateText } from './ai-generate-text'

function SectionHeading({ eyebrow, title, description, icon: Icon }: {
  eyebrow: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="mb-0.5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h2 className="font-sans text-xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export default function AiPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-12">
      {/* Hero / page header */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-card p-8">
        {/* Background accent */}
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/8 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {t('ai.subtitle')}
            </span>
          </div>

          <h1 className="mb-3 font-sans text-4xl font-black tracking-tight text-foreground md:text-5xl">
            {t('ai.title')}
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            {t('ai.description')}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Zap className="h-3 w-3" />
              Live API calls
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Bot className="h-3 w-3" />
              Multiple models
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Sparkles className="h-3 w-3" />
              SSE streaming
            </Badge>
          </div>
        </div>
      </div>

      {/* Text generation + Structured output side by side */}
      <section>
        <SectionHeading
          eyebrow="01"
          title={t('ai.sections.textGeneration')}
          description="Generate text with a single prompt. Toggle streaming to see real-time token output."
          icon={Zap}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <AiGenerateText />
          <AiGenerateObject />
        </div>
      </section>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t border-border" />
        <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase px-2">
          02
        </span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Chat */}
      <section>
        <SectionHeading
          eyebrow="02"
          title={t('ai.sections.chatStream')}
          description="Full conversation with streaming. Supports structured output schemas — pick one to see typed responses."
          icon={MessageSquare}
        />
        <div className="flex justify-center">
          <AiChatStream />
        </div>
      </section>
    </div>
  )
}
