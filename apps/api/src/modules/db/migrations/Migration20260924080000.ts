import { Migration } from '@mikro-orm/migrations'

export class Migration20260924080000 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "media" ("id" uuid not null default gen_random_uuid(), "storageKey" varchar(255) not null, "filename" varchar(255) not null, "mimeType" varchar(255) not null, "size" int not null, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(
      `alter table "media" add constraint "media_storageKey_unique" unique ("storageKey");`,
    )

    this.addSql(`alter table "post" drop column "coverImage";`)
    this.addSql(`alter table "post" add "coverImageId" uuid null;`)
    this.addSql(
      `alter table "post" add constraint "post_coverImageId_foreign" foreign key ("coverImageId") references "media" ("id") on delete set null;`,
    )
    this.addSql(
      `alter table "post" add constraint "post_coverImageId_unique" unique ("coverImageId");`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "post" drop constraint "post_coverImageId_foreign";`)
    this.addSql(`alter table "post" drop constraint "post_coverImageId_unique";`)
    this.addSql(`alter table "post" drop column "coverImageId";`)
    this.addSql(`alter table "post" add "coverImage" varchar(255) null;`)

    this.addSql(`drop table if exists "media" cascade;`)
  }
}
