import type { ChatSchemaType } from '@boilerstone/openapi-generator'
import { zProduct, zRecipe } from '@boilerstone/openapi-generator/client/zod.gen'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import * as React from 'react'
import { ProductDisplay } from './product-display'
import { RecipeDisplay } from './recipe-display'

const schemaTypeLabels: Record<ChatSchemaType, string> = {
  none: 'No schema (text)',
  userProfile: 'User Profile',
  task: 'Task',
  product: 'Product',
  recipe: 'Recipe',
}

interface StructuredOutputDisplayProps {
  content: string
  schemaType: string
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

function FallbackDisplay({ content, schemaType }: StructuredOutputDisplayProps) {
  return (
    <div className="text-sm">
      <Badge variant="outline" className="mb-2">
        {schemaTypeLabels[schemaType as ChatSchemaType] || schemaType}
      </Badge>
      <pre className="whitespace-pre-wrap wrap-break-word bg-muted/50 rounded p-2 text-xs overflow-auto max-h-60">
        {content}
      </pre>
    </div>
  )
}

export function StructuredOutputDisplay({ content, schemaType }: StructuredOutputDisplayProps) {
  const parsedContent = React.useMemo(() => parseJson(content), [content])

  if (!parsedContent) {
    return <FallbackDisplay content={content} schemaType={schemaType} />
  }

  switch (schemaType) {
    case 'recipe': {
      const result = zRecipe.safeParse(parsedContent)
      return result.success ? (
        <RecipeDisplay recipe={result.data} />
      ) : (
        <FallbackDisplay content={content} schemaType={schemaType} />
      )
    }

    case 'product': {
      const result = zProduct.safeParse(parsedContent)
      return result.success ? (
        <ProductDisplay product={result.data} />
      ) : (
        <FallbackDisplay content={content} schemaType={schemaType} />
      )
    }

    case 'userProfile':
    case 'task':
    default:
      return <FallbackDisplay content={content} schemaType={schemaType} />
  }
}
