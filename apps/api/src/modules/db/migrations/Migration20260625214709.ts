import { Migration } from '@mikro-orm/migrations'

export class Migration20260625214709 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "tag" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "slug" varchar(255) not null, primary key ("id"));`,
    )
    this.addSql(`create index "tag_name_index" on "tag" ("name");`)
    this.addSql(`alter table "tag" add constraint "tag_name_unique" unique ("name");`)
    this.addSql(`create index "tag_slug_index" on "tag" ("slug");`)
    this.addSql(`alter table "tag" add constraint "tag_slug_unique" unique ("slug");`)

    this.addSql(
      `create table "post_tag" ("post" uuid not null, "tag" uuid not null, primary key ("post", "tag"));`,
    )
    this.addSql(
      `alter table "post_tag" add constraint "post_tag_post_foreign" foreign key ("post") references "post" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "post_tag" add constraint "post_tag_tag_foreign" foreign key ("tag") references "tag" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table "post" add "coverImage" varchar(255) null, add "likesCount" int not null default 0;`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "post_tag" cascade;`)
    this.addSql(`drop table if exists "tag" cascade;`)

    this.addSql(`alter table "post" drop column "coverImage", drop column "likesCount";`)
  }
}
