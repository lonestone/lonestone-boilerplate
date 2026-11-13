import { Migration } from '@mikro-orm/migrations'

export class Migration20261021090000 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "media" ("id" uuid not null default gen_random_uuid(), "storageKey" varchar(255) not null, "filename" varchar(255) not null, "mimeType" varchar(255) not null, "size" int not null, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(
      `alter table "media" add constraint "media_storageKey_unique" unique ("storageKey");`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "media" cascade;`)
  }
}
