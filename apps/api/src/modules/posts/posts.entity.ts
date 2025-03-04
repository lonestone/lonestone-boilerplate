import {
  Entity,
  PrimaryKey,
  Property,
  OneToMany,
  Collection,
  ManyToOne,
  Index,
  Unique,
  BeforeUpdate,
  EntityManager,
  BeforeCreate,
} from "@mikro-orm/core";
import slugify from "slugify";
import { User } from "../auth/auth.entity";

async function ensureUniqueSlug(post: Post, em: EntityManager) {
  const baseSlug = post.slug;
  let uniqueSlug = baseSlug;
  let counter = 1;

  while (await em.findOne(Post, { slug: uniqueSlug })) {
    uniqueSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  post.slug = uniqueSlug;
}


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
  slug?: string;

  async computeSlug() {
    if (this.versions.length === 0) return;

    // Trier par date pour trouver la dernière version publiée
    const latestVersion = this.versions
      .getItems()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (!latestVersion) return;

    const baseSlug = slugify(latestVersion.title, { lower: true, strict: true });
    const shortId = this.id.substring(0, 8);
    this.slug = `${baseSlug}-${shortId}`;
  }

  @BeforeCreate()
  @BeforeUpdate()
  async updateSlug(em: EntityManager) {
    await this.computeSlug();
    await ensureUniqueSlug(this, em);
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
