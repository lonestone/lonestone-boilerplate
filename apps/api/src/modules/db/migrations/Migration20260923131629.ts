import { Migration } from '@mikro-orm/migrations'

export class Migration20260923131629 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      'create table "document" ("id" uuid not null default gen_random_uuid(), "ownerId" uuid not null, "storageKey" varchar(255) not null, "filename" varchar(255) not null, "mimeType" varchar(255) not null, "size" int not null, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));',
    )
    this.addSql('create index "document_ownerId_index" on "document" ("ownerId");')
    this.addSql(
      'alter table "document" add constraint "document_ownerId_foreign" foreign key ("ownerId") references "user" ("id");',
    )
  }

  override down(): void | Promise<void> {
    this.addSql('drop table if exists "document" cascade;')
  }
}
