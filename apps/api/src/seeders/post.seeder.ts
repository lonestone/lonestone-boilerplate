import { Dictionary, EntityManager } from "@mikro-orm/core";
import { Seeder } from "@mikro-orm/seeder";
import { Post, PostVersion } from "../modules/posts/posts.entity";
import { faker } from "@faker-js/faker";
import { addDays } from "date-fns";

const generateDatePublished = (post: Post) => {
  if (post.versions.getItems().length === 1) {
    return addDays(post.versions.getItems()[0].createdAt, 1);
  }
  const secondToLastVersion = post.versions.getItems()[post.versions.getItems().length - 2];
  const lastVersion = post.versions.getItems()[post.versions.getItems().length - 1];
  return faker.date.between({
    from: secondToLastVersion.createdAt,
    to: addDays(lastVersion.createdAt, 2),
  });
}

export class PostSeeder extends Seeder {
  async run(em: EntityManager, context: Dictionary): Promise<void> {
    const posts = [];
    for (const user of context.users) {
      for (let i = 0; i < faker.number.int({ min: 5, max: 100 }); i++) {
        const createdAt = faker.date.between({
          from: new Date("2024-01-01"),
          to: new Date("2024-12-31"),
        });
        const post = new Post();
        post.user = user.id;
        post.createdAt = createdAt;
        await em.persistAndFlush(post);

        // Create post versions
        for (let i = 0; i < faker.number.int({ min: 5, max: 10 }); i++) {
          const postVersion = new PostVersion();
          postVersion.post = post;
          postVersion.createdAt =
            i === 0 ? post.createdAt : addDays(post.createdAt, i);
          postVersion.title = faker.book.title();
          postVersion.content = [
            {
              type: "text",
              data: faker.lorem.paragraph(),
            },
          ];
          await em.persistAndFlush(postVersion);
          post.versions.add(postVersion);
        }
        // Add post to the list
        posts.push(post);
      }
    }
    for (const post of posts) {
      post.publishedAt =
        faker.number.int({ min: 0, max: 1 }) === 0
          ? undefined
          : generateDatePublished(post);
      if (post.publishedAt) {
        post.computeSlug();
      }
      await em.persistAndFlush(post);
    }
    context.posts = posts;
  }
}
