import type { ArgumentMetadata, PipeTransform } from '@nestjs/common'
import type { ZodSchema } from 'zod'
import { Injectable } from '@nestjs/common'
import { ZodValidationException } from './validation.exception'

export function createZodValidationPipe(): new (schemaOrDto?: ZodSchema) => PipeTransform {
  @Injectable()
  class ZodValidationPipe implements PipeTransform {
    constructor(private readonly schema?: ZodSchema) {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public transform(value: unknown, _: ArgumentMetadata): unknown {
      if (!this.schema) {
        return value
      }

      const result = this.schema.safeParse(value)

      if (!result.success) {
        throw new ZodValidationException(result.error)
      }

      return result.data
    }
  }

  return ZodValidationPipe
}

export const ZodValidationPipe = createZodValidationPipe()
