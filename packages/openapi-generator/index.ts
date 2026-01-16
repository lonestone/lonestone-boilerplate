import type { RequestOptions } from './client/client'
import { client } from './client/client.gen'

export function SortingToString(
  sorting: {
    property: string
    direction: string
  }[],
): string {
  return sorting.map(el => `${el.property}:${el.direction}`).join(',')
}

export function FiltersToString(filters: {
  property: string
  rule: string
  value: string
}[]): string {
  return filters
    .map((filter) => {
      if (filter.value === undefined) {
        return `${filter.property}:${filter.rule}`
      }
      return `${filter.property}:${filter.rule}:${filter.value}`
    })
    .join(';')
}

client.setConfig({
  requestValidator: async (data) => {
    const request = data as RequestOptions
    request.query = {
      ...request.query,
      filter: request.query?.filter && Array.isArray(request.query.filter) ? FiltersToString(request.query.filter) : undefined,
      sort: request.query?.sort && Array.isArray(request.query.sort) ? SortingToString(request.query.sort) : undefined,
    }
    return data
  },
})

export { client }

export * from './client/sdk.gen'
export * from './client/types.gen'
export * from './client/zod.gen'
