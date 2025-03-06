import {
  Entity,
  PrimaryKey,
  Property,
  OneToMany,
  Collection,
  ManyToOne,
  Index,
  Unique,
  EntityManager,
  BeforeUpdate,
  BeforeCreate,
} from "@mikro-orm/core";
import slugify from "slugify";
import { User } from "../auth/auth.entity";


export type Content = {
  type: "text" | "image" | "video";
  data: string;
};

@Entity({ tableName: "post" })
export class Post {
  @PrimaryKey({ type: "uuid", defaultRaw: "gen_random_uuid()" })
  id!: string;

  @ManyToOne(() => User, { fieldName: "userId" })
  @Index()
  user!: User;

  @Property({ fieldName: "createdAt" })
  createdAt: Date = new Date();

  @Property({ fieldName: "updatedAt", onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ fieldName: "publishedAt", nullable: true })
  @Index()
  publishedAt?: Date;

  @OneToMany(() => PostVersion, version => version.post)
  versions = new Collection<PostVersion>(this);

  @Unique()
  @Property({ fieldName: "slug", nullable: true })
  @Index()
  slug?: string;

  async computeSlug() {
    if (this.versions.length === 0) return;

    const baseSlug = slugify(this.versions.getItems()[0].title, { lower: true, strict: true });
    const shortId = this.id.substring(0, 8);
    this.slug = `${baseSlug}-${shortId}`;
  }
}

@Entity({ tableName: "postVersion" })
export class PostVersion {
  @PrimaryKey({ type: "uuid", defaultRaw: "gen_random_uuid()" })
  id!: string;

  @ManyToOne(() => Post, { fieldName: "postId" })
  post!: Post;

  @Property()
  @Index()
  title!: string;

  @Property({ type: "json" })
  content?: Content[];

  @Property({ fieldName: "createdAt" })
  createdAt: Date = new Date();
}
