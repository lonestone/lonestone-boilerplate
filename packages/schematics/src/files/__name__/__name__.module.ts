import { Module } from '@nestjs/common';
import { <%= className %>Service } from './<%= name %>.service';
import { <%= className %>Controller } from './<%= name %>.controller';

@Module({
  controllers: [<%= className %>Controller],
  providers: [<%= className %>Service],
  exports: [<%= className %>Service],
})
export class <%= className %>Module {}