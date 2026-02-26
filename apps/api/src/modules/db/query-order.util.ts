export type SortDirection = 'ASC' | 'DESC'

type SortDirectionInput = SortDirection | 'asc' | 'desc'

export interface SortingItem<TSortProperty extends string> {
  property: TSortProperty
  direction: SortDirectionInput
}

interface BuildOrderByParams<TSortProperty extends string> {
  sort?: ReadonlyArray<SortingItem<TSortProperty>>
  allowedProperties: ReadonlyArray<string>
  defaultProperty: string
  defaultDirection?: SortDirection
  stableProperty?: string
  stableDirection?: SortDirection
}

function normalizeDirection(direction: SortDirectionInput): SortDirection {
  return direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
}

export function buildOrderBy<
  TSortProperty extends string,
>({
  sort,
  allowedProperties,
  defaultProperty,
  defaultDirection = 'DESC',
  stableProperty = defaultProperty,
  stableDirection = defaultDirection,
}: BuildOrderByParams<TSortProperty>): Record<string, SortDirection> {
  const orderBy: Record<string, SortDirection> = {}
  const allowedPropertiesSet = new Set<string>(allowedProperties)

  if (sort?.length) {
    sort.forEach((sortItem) => {
      if (!allowedPropertiesSet.has(sortItem.property))
        return

      orderBy[sortItem.property] = normalizeDirection(sortItem.direction)
    })
  }

  if (!Object.keys(orderBy).length) {
    orderBy[defaultProperty] = defaultDirection
  }

  if (!Object.prototype.hasOwnProperty.call(orderBy, stableProperty)) {
    orderBy[stableProperty] = stableDirection
  }

  return orderBy
}
