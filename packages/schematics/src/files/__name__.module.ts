import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { <%= className %> } from './<%= name %>.entity';
import { <%= className %>Service } from './<%= name %>.service';
import { <%= className %>Controller } from './<%= name %>.controller';

@Module({
  imports: [
    MikroOrmModule.forFeature([<%= className %>]),
  ],
  controllers: [<%= className %>Controller],
  providers: [<%= className %>Service],
  exports: [<%= className %>Service],
})
export class <%= className %>Module {}