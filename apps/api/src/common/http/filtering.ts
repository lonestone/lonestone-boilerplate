import { z } from 'zod'
import { queryItemsSchema } from './openapi'

export enum FilterRule {
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUALS = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUALS = 'lte',
  LIKE = 'like',
  NOT_LIKE = 'nlike',
  IN = 'in',
  NOT_IN = 'nin',
  IS_NULL = 'isnull',
  IS_NOT_NULL = 'isnotnull',
}

function createPropertySchema<T extends readonly [string, ...string[]]>(keys: T) {
  return z.enum(keys)
}

export function FilteringSchema<T extends readonly [string, ...string[]]>(
  availableFilteringKeys: T,
) {
  return z
    .object({
      property: createPropertySchema(availableFilteringKeys),
      rule: z.enum(FilterRule),
      value: z.string().optional(),
    })
    .meta({
      title: 'FilteringSchema',
      description: 'Schema for a single filtering item',
    })
}

export function FilteringStringItemSchema<T extends readonly [string, ...string[]]>(
  availableFilteringKeys: T,
) {
  return z
    .string()
    .superRefine((value, ctx) => {
      const [, rule] = value.split(':')
      if (!Object.values(FilterRule).includes(rule as FilterRule)) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid filter rule. Expected one of: ${Object.values(FilterRule).join(', ')}`,
        })
        return
      }

      const parts = value.split(':')

      if ([FilterRule.IS_NULL, FilterRule.IS_NOT_NULL].includes(rule as FilterRule)) {
        if (parts.length !== 2) {
          ctx.addIssue({
            code: 'custom',
            message: 'IS_NULL and IS_NOT_NULL rules should not have a value',
          })
        }
      } else if (parts.length !== 3) {
        ctx.addIssue({
          code: 'custom',
          message: 'Value is required for this filter rule',
        })
      }
    })
    .transform((value) => {
      const [property, rule, filterValue] = value.split(':')

      if ([FilterRule.IS_NULL, FilterRule.IS_NOT_NULL].includes(rule as FilterRule)) {
        return {
          property,
          rule: rule as FilterRule,
        }
      }

      return {
        property,
        rule: rule as FilterRule,
        value: filterValue,
      }
    })
    .pipe(FilteringSchema(availableFilteringKeys))
}

export function createFilterQueryStringSchema<T extends readonly [string, ...string[]]>(
  availableFilteringKeys: T,
) {
  const itemSchema = FilteringStringItemSchema(availableFilteringKeys)

  return z
    .string()
    .transform((val) =>
      val
        ?.split(';')
        .filter(Boolean)
        .map((s) => s.trim()),
    )
    .pipe(z.array(itemSchema))
    .optional()
    .meta({
      title: 'FilterQueryStringSchema',
      description: `Filtering query string, in the format of "property:rule[:value];property:rule[:value];..."
Available rules: ${Object.values(FilterRule).join(', ')} 
Available properties: ${availableFilteringKeys.join(', ')}`,
      example: 'name:eq:John;age:gt:30',
      // The generated client types `filter` as an array of items and joins it back into this string.
      override: {
        type: 'string',
        format: 'filter',
        items: queryItemsSchema(FilteringSchema(availableFilteringKeys)),
      },
    })
}
