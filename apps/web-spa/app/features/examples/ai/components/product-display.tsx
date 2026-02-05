import type { Product } from '@boilerstone/openapi-generator'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@boilerstone/ui/components/primitives/card'

interface ProductDisplayProps {
  product: Product
}

export function ProductDisplay({ product }: ProductDisplayProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              🛒
              {' '}
              {product.name}
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {product.category}
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold">
              $
              {product.price.toFixed(2)}
            </div>
            <Badge
              variant={product.inStock ? 'default' : 'destructive'}
              className="text-xs"
            >
              {product.inStock ? 'In Stock' : 'Out of Stock'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{product.description}</p>

        {product.features && product.features.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Features</h4>
            <ul className="space-y-1 text-sm">
              {product.features.map((feature, idx) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
