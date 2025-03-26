import {
Controller,
Param,
UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { Session } from "../auth/auth.decorator";
import {
FilteringParams,
PaginationParams,
SortingParams,
TypedRoute,
TypedParam,
TypedBody,
} from "@lonestone/nzoth/server";
import { <%= className %>Service } from "./<%= name %>.service";
import { <%= name %>Schema, <%= name %>sSchema, create<%= className %>Schema, update<%= className %>Schema, <%= name %>PaginationSchema, <%= name %>SortingSchema, <%= name %>FilteringSchema } from "./contracts/<%= name %>.contract";
import type { <%= className %>Response, <%= className %>sResponse, Create<%= className %>Input, Update<%= className %>Input, <%= className %>Pagination, <%= className %>Sorting, <%= className %>Filtering } from "./contracts/<%= name %>.contract";

@Controller("<%= name %>")
@UseGuards(AuthGuard)
export class <%= className %>Controller {
    constructor(private readonly <%= name %>Service: <%= className %>Service) {}

    @TypedRoute.Post("", <%= name %>Schema)
    async create<%= className %>(
        @Session() session: { user: { id: string } },
        @TypedBody(create<%= className %>Schema) body: Create<%= className %>Input
    ): Promise<<%= className %>Response> {
        return await this.<%= name %>Service.create(
        body
        );
    }

    @TypedRoute.Put(":id", <%= name %>Schema)
    async update<%= className %>(
        @Session() session: { user: { id: string } },
        @TypedParam("id") id: string,
        @TypedBody(update<%= className %>Schema) body: Update<%= className %>Input
    ): Promise<<%= className %>Response> {
        return await this.<%= name %>Service.update(
        id,
        body,
        );
    }

    @TypedRoute.Get("", <%= name %>sSchema)
    async get<%= className %>s(
        @Session() session: { user: { id: string } },
        @PaginationParams(<%= name %>PaginationSchema) pagination: <%= className %>Pagination,
        @SortingParams(<%= name %>SortingSchema) sort?: <%= className %>Sorting,
        @FilteringParams(<%= name %>FilteringSchema) filter?: <%= className %>Filtering,
    ): Promise<<%= className %>sResponse>{
        return await this.<%= name %>Service.gets(pagination, sort, filter);
    }

    @TypedRoute.Get(":id", <%= name %>Schema)
    async get<%= className %>(
        @Session() session: { user: { id: string } },
        @Param("id") id: string
    ): Promise<<%= className %>Response> {
        return await this.<%= name %>Service.findOne(id);
    }
}
