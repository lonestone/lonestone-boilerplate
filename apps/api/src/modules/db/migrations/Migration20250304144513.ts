import { Migration } from '@mikro-orm/migrations'

export class Migration20250304144513 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "post" add column "slug" varchar(255) null;`)
    this.addSql(`alter table "post" add constraint "post_slug_unique" unique ("slug");`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "post" drop constraint "post_slug_unique";`)
    this.addSql(`alter table "post" drop column "slug";`)
  }
}
