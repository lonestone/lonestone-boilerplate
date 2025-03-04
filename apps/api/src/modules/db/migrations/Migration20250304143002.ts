import { Migration } from '@mikro-orm/migrations';

export class Migration20250304143002 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "post" ("id" uuid not null default gen_random_uuid(), "userId" uuid not null, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, "publishedAt" timestamptz null, constraint "post_pkey" primary key ("id"));`);
    this.addSql(`create index "post_userId_index" on "post" ("userId");`);
    this.addSql(`create index "post_publishedAt_index" on "post" ("publishedAt");`);

    this.addSql(`create table "postVersion" ("id" uuid not null default gen_random_uuid(), "postId" uuid not null, "title" varchar(255) not null, "content" jsonb null, "createdAt" timestamptz not null, constraint "postVersion_pkey" primary key ("id"));`);
    this.addSql(`create index "postVersion_title_index" on "postVersion" ("title");`);

    this.addSql(`alter table "post" add constraint "post_userId_foreign" foreign key ("userId") references "user" ("id") on update cascade;`);

    this.addSql(`alter table "postVersion" add constraint "postVersion_postId_foreign" foreign key ("postId") references "post" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "postVersion" drop constraint "postVersion_postId_foreign";`);

    this.addSql(`drop table if exists "post" cascade;`);

    this.addSql(`drop table if exists "postVersion" cascade;`);
  }

}
