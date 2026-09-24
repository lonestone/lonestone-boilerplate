import { Migration } from '@mikro-orm/migrations'

export class Migration20260924080000 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "post" drop column "coverImage";`)
    this.addSql(
      `alter table "post" add "coverImageStorageKey" varchar(255) null, add "coverImageFilename" varchar(255) null, add "coverImageMimeType" varchar(255) null, add "coverImageSize" int null;`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "post" drop column "coverImageStorageKey", drop column "coverImageFilename", drop column "coverImageMimeType", drop column "coverImageSize";`,
    )
    this.addSql(`alter table "post" add "coverImage" varchar(255) null;`)
  }
}
