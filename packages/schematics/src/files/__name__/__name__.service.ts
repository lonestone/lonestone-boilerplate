import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { <%= className %> } from './<%= name %>.entity';
import { FilterQuery } from '@mikro-orm/core';
import { <%= className %>Pagination, <%= className %>Sorting, <%= className %>Filtering } from './contracts/<%= name %>.contract';
import { Create<%= className %>Input, Update<%= className %>Input} from './contracts/<%= name %>.contract';

@Injectable()
export class <%= className %>Service {

  constructor(private readonly em: EntityManager) {}

  async create(data: Create<%= className %>Input) {
    const <%= name %> = new <%= className %>();
    <%= name %>.name = data.name;
    await this.em.persistAndFlush(<%= name %>);
    return <%= name %>;
  }

  async update(id: string, data: Update<%= className %>Input) {
    const <%= name %> = await this.em.findOneOrFail(<%= className %>, { id });
    this.em.assign(<%= name %>, data);
    await this.em.persistAndFlush(<%= name %>);
    return <%= name %>;
  }


  async gets(pagination: <%= className %>Pagination, sort?: <%= className %>Sorting, filter?: <%= className %>Filtering) {
    const where: FilterQuery<<%= className %>> = { };
    const orderBy: Record<string, "ASC" | "DESC"> = { };
    
    if (filter?.length) {
        filter.forEach((item) => {
        });
    }

    if (sort?.length) {
        sort.forEach((sortItem) => {
          if (sortItem.property !== "title") {
            orderBy[sortItem.property] = sortItem.direction.toUpperCase() as
              | "ASC"
              | "DESC";
          }
        });
    }

    const [<%= name %>s, total] = await this.em.findAndCount(<%= className %>, where, {
        orderBy,
        limit: pagination.pageSize,
        offset: pagination.offset,
      });
  
    
    return {
        data: <%= name %>s,
        meta: {
            itemCount: total,
            pageSize: pagination.pageSize,
            offset: pagination.offset,
            hasMore: pagination.offset + pagination.pageSize < total,
        }
    };

  }

  async findOne(id: string) {
    return this.em.findOneOrFail(<%= className %>, { id });
  }

  async remove(id: string) {
    const <%= name %> = await this.em.findOneOrFail(<%= className %>, { id });
    await this.em.removeAndFlush(<%= name %>);
    return { id };
  }
}