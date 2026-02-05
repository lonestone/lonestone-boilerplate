import type { Recipe } from '@boilerstone/openapi-generator'
import { Badge } from '@boilerstone/ui/components/primitives/badge'

import { Card, CardContent, CardHeader, CardTitle } from '@boilerstone/ui/components/primitives/card'

interface RecipeDisplayProps {
  recipe: Recipe
}

const difficultyColors: Record<Recipe['difficulty'], string> = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800',
}

export function RecipeDisplay({ recipe }: RecipeDisplayProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">
            🥘
            {' '}
            {recipe.name}
          </CardTitle>
          <Badge className={difficultyColors[recipe.difficulty]}>
            {recipe.difficulty}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{recipe.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Prep:</span>
            <span className="font-medium">{recipe.prepTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Cook:</span>
            <span className="font-medium">{recipe.cookTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Servings:</span>
            <span className="font-medium">{recipe.servings}</span>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-2">Ingredients</h4>
          <ul className="space-y-1 text-sm">
            {recipe.ingredients.map(ingredient => (
              <li key={`${ingredient.name}-${ingredient.quantity}`} className="flex gap-2">
                <span className="text-muted-foreground">{ingredient.quantity}</span>
                <span>{ingredient.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-2">Instructions</h4>
          <ol className="space-y-2 text-sm list-decimal list-inside">
            {recipe.instructions.map(step => (
              <li key={step} className="text-muted-foreground">
                <span className="text-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {recipe.tips && recipe.tips.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3">
            <h4 className="font-semibold text-sm mb-2">Tips</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {recipe.tips.map(tip => (
                <li key={tip}>
                  •
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
