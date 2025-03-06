import { Dictionary, EntityManager } from "@mikro-orm/core";
import { Seeder } from "@mikro-orm/seeder";
import { Post, PostVersion } from "../modules/posts/posts.entity";
import { faker } from "@faker-js/faker";

export class PostSeeder extends Seeder {
  async run(em: EntityManager, context: Dictionary): Promise<void> {
    const posts = [];
    for (const user of context.users) {
      for (let i = 0; i < faker.number.int({ min: 5, max: 100 }); i++) {
        const post = new Post();
        post.user = user.id;
        await em.persistAndFlush(post);

        // Add post to the list
        posts.push(post);

        // Create post versions
        for (let i = 0; i < faker.number.int({ min: 5, max: 10 }); i++) {
          const postVersion = new PostVersion();
          postVersion.post = post;
          postVersion.title = faker.book.title();
          postVersion.content = [
            {
              type: "text",
              data: faker.lorem.paragraph(),
            },
          ];
          await em.persistAndFlush(postVersion);
        }
      }
    }
    for (const post of posts) {
      post.publishedAt =
        faker.number.int({ min: 0, max: 1 }) === 0
          ? undefined
          : faker.date.recent();
      if (post.publishedAt) {
        post.computeSlug();
      }
      await em.persistAndFlush(post);
    }
  }
}
