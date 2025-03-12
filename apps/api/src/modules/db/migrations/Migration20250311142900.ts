import { Migration } from '@mikro-orm/migrations';

export class Migration20250311142900 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "comment" ("id" uuid not null default gen_random_uuid(), "postId" uuid not null, "userId" uuid null, "content" varchar(255) not null, "author_name" varchar(255) null, "createdAt" timestamptz not null, "parentId" uuid null, constraint "comment_pkey" primary key ("id"));`);
    this.addSql(`create index "comment_postId_index" on "comment" ("postId");`);
    this.addSql(`create index "comment_userId_index" on "comment" ("userId");`);
    this.addSql(`create index "comment_parentId_index" on "comment" ("parentId");`);

    this.addSql(`alter table "comment" add constraint "comment_postId_foreign" foreign key ("postId") references "post" ("id") on update cascade;`);
    this.addSql(`alter table "comment" add constraint "comment_userId_foreign" foreign key ("userId") references "user" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "comment" add constraint "comment_parentId_foreign" foreign key ("parentId") references "comment" ("id") on update cascade on delete set null;`);

    this.addSql(`create index "post_slug_index" on "post" ("slug");`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "comment" drop constraint "comment_parentId_foreign";`);

    this.addSql(`drop table if exists "comment" cascade;`);

    this.addSql(`drop index "post_slug_index";`);
  }

}
