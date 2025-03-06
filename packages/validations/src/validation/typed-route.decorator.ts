import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import type {
  ReferenceObject,
  SchemaObject,
} from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import type { ZodSchema } from "zod";
import { generateSchema } from "@anatine/zod-openapi";
import {
  applyDecorators,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  UseInterceptors,
} from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";
import { map } from "rxjs/operators";
import { ZodSerializationException } from "./validation.exception";
import { type OpenAPIObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
/**
 * Interceptor that validates response data against a Zod schema
 */
class TypedRouteInterceptor implements NestInterceptor {
  constructor(private readonly schema: ZodSchema) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((value) => {
        const result = this.schema.safeParse(value);
        if (!result.success) {
          throw new ZodSerializationException(result.error);
        }
        return result.data;
      })
    );
  }
}

const SCHEMA_STORAGE = new Map<string, SchemaObject>();

export function registerSchema(
  name: string,
  schema: SchemaObject
): ReferenceObject {
  // Clean up the schema by removing any nested definitions that should be references
  function cleanupSchema(obj: SchemaObject): SchemaObject {
    const cleaned = { ...obj };
    
    if (obj.title && obj.title !== name) {
      // If this is a named schema that isn't the root schema,
      // register it separately and return a reference
      SCHEMA_STORAGE.set(obj.title, obj);
      return {
        $ref: `#/components/schemas/${obj.title}`,
      } as SchemaObject;
    }

    if (obj.properties) {
      cleaned.properties = Object.entries(obj.properties).reduce((acc, [key, value]) => {
        if (typeof value === 'object' && !('$ref' in value)) {
          acc[key] = cleanupSchema(value as SchemaObject);
        } else {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);
    }

    if (obj.items && typeof obj.items === 'object' && !('$ref' in obj.items)) {
      cleaned.items = cleanupSchema(obj.items as SchemaObject);
    }

    return cleaned;
  }

  const cleanedSchema = cleanupSchema(schema);
  SCHEMA_STORAGE.set(name, cleanedSchema);

  return {
    $ref: `#/components/schemas/${name}`,
  } as ReferenceObject;
}

export function addSchemasToSwagger(document: OpenAPIObject) {
  document.components = document.components || {};
  document.components.schemas = document.components.schemas || {};

  for (const [name, schema] of SCHEMA_STORAGE.entries()) {
    document.components.schemas[name] = schema;
  }
}


const ROUTERS = {
  Get,
  Post,
  Put,
  Patch,
  Delete,
} as const;

/**
 * Type-safe route decorators that validate response data using Zod schemas.
 * Automatically generates OpenAPI documentation from the schema.
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({
 *   id: z.string().uuid(),
 *   name: z.string(),
 *   email: z.string().email(),
 * })
 *
 * @Controller('users')
 * class UserController {
 *   @TypedRoute.Get(undefined, UserSchema)
 *   findAll(): Promise<z.infer<typeof UserSchema>[]> {
 *     return this.userService.findAll()
 *   }
 *
 *   // You can override the generated OpenAPI documentation by using @ApiResponse before the method
 *   @ApiResponse({
 *     status: 200,
 *     description: 'Custom description',
 *     content: {
 *       'application/json': {
 *         examples: {
 *           user: { value: { id: '123', name: 'John', email: 'john@example.com' } }
 *         }
 *       }
 *     }
 *   })
 *   @TypedRoute.Get(':id', UserSchema)
 *   findOne(@TypedParam('id', 'uuid') id: string): Promise<z.infer<typeof UserSchema>> {
 *     return this.userService.findOne(id)
 *   }
 * }
 */


function createRouteDecorator(method: keyof typeof ROUTERS) {
  return function route<T extends ZodSchema>(
    path?: string | string[],
    schema?: T
  ): MethodDecorator {
    if (!schema) {
      return ROUTERS[method](path);
    }

    // Generate schema and register all nested schemas
    const openApiSchema = generateSchema(schema) as SchemaObject;
    
    // Format Name
    const schemaName = openApiSchema.title || `${method}_${(path || "default")
      .toString()
      .replace(/[:/]/g, "_")}`;

    // Register all nested schemas recursively
    function registerNestedSchemas(schema: SchemaObject) {
      if (schema.title) {
        registerSchema(schema.title, schema);
      }
      
      // Handle nested objects
      if (schema.properties) {
        Object.values(schema.properties).forEach((prop) => {
          if (typeof prop === 'object' && !('$ref' in prop)) {
            registerNestedSchemas(prop as SchemaObject);
          }
        });
      }
      
      // Handle arrays
      if (schema.items && typeof schema.items === 'object' && !('$ref' in schema.items)) {
        registerNestedSchemas(schema.items as SchemaObject);
      }
    }

    registerNestedSchemas(openApiSchema);

    // Register the main schema and get the reference
    const refSchema = registerSchema(schemaName, openApiSchema);

    // Generate OpenAPI schema
    const baseDecorator = ApiResponse({
      status: 200,
      description: openApiSchema.description || "Successful response",
      schema: refSchema,
    });

    // Apply the base decorator first, to ensure manually applied decorators will take precedence
    // Then apply the route method and interceptor
    return applyDecorators(
      baseDecorator,
      ROUTERS[method](path),
      UseInterceptors(new TypedRouteInterceptor(schema))
    );
  };
}

export const TypedRoute = {
  Get: createRouteDecorator("Get"),
  Post: createRouteDecorator("Post"),
  Put: createRouteDecorator("Put"),
  Patch: createRouteDecorator("Patch"),
  Delete: createRouteDecorator("Delete"),
} as const;
