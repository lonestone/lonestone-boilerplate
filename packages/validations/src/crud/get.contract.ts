import type { ZodSchema } from 'zod'
import type { FilteringQuery } from '../filtering/filtering.js'
import type { PaginationQuery } from '../pagination/pagination.js'
import type { SortingQuery } from '../sorting/sorting.js'

export interface GetContract {
  paginationSchema: PaginationQuery
  sortingSchema: SortingQuery
  filteringSchema: FilteringQuery
  searchSchema: ZodSchema // a custom schema for searching
}
