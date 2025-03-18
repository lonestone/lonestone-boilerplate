import { z } from "zod";
import { extendApi } from "@anatine/zod-openapi";
import {
  createPaginationQuerySchema,
  FilterQueryStringSchema,
  paginatedSchema,
  SortingQueryStringSchema,
} from "@lonestone/validations/server";
import { <%= classify(name) %> } from "../<%= name %>.entity";

// Schema for creating a <%= classify(name) %>
export const create<%= classify(name) %>Schema = extendApi(
  z.object({
    name: z.string()
  }),
  {
    title: "Create<%= classify(name) %>Schema",
    description: "Schema for creating a <%= classify(name) %>",
  }
);

export type Create<%= classify(name) %>Input = z.infer<typeof create<%= classify(name) %>Schema>;

export const update<%= classify(name) %>Schema = extendApi(
  z.object({
    name: z.string()
  }),
  {
    title: "Update<%= classify(name) %>Schema",
    description: "Schema for updating a <%= classify(name) %>",
  }
);

export type Update<%= classify(name) %>Input = z.infer<typeof update<%= classify(name) %>Schema>;

// Schema for <%= classify(name) %> response
// Using a simpler approach to avoid recursive type issues
export const <%= name %>Schema = extendApi(
  z.object({
    id: z.string().uuid(),
    createdAt: z.date(),
  }),
  {
    title: "<%= classify(name) %>Schema",
    description: "Schema for a <%= classify(name) %>",
  }
);

export type <%= classify(name) %>Response = z.infer<typeof <%= name %>Schema>;

// Schema for <%= classify(name) %>s list
export const <%= name %>sSchema = extendApi(
  paginatedSchema(<%= name %>Schema),
  {
    title: "<%= classify(name) %>sSchema",
    description: "Schema for a paginated list of <%= classify(name) %>s",
  }
);

export type <%= classify(name) %>sResponse = z.infer<typeof <%= name %>sSchema>;

// Sorting and filtering
export const enabled<%= classify(name) %>SortingKey: (keyof <%= classify(name) %>)[] = [
  "createdAt",
] as const;

export const <%= name %>SortingSchema = SortingQueryStringSchema(
  enabled<%= classify(name) %>SortingKey as string[]
);

export type <%= classify(name) %>Sorting = z.infer<typeof <%= name %>SortingSchema>;

export const enabled<%= classify(name) %>FilteringKeys = [
  "createdAt",
] as const;

export const <%= name %>FilteringSchema = FilterQueryStringSchema(
  enabled<%= classify(name) %>FilteringKeys
);

export type <%= classify(name) %>Filtering = z.infer<typeof <%= name %>FilteringSchema>;

export const <%= name %>PaginationSchema = createPaginationQuerySchema();

export type <%= classify(name) %>Pagination = z.infer<typeof <%= name %>PaginationSchema>; 