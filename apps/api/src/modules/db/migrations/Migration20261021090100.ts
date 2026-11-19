import { Migration } from '@mikro-orm/migrations'

export class Migration20261021090100 extends Migration {
  override up(): void | Promise<void> {
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
  }
}
