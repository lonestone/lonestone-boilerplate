import { Dictionary, EntityManager } from "@mikro-orm/core";

import { faker } from "@faker-js/faker";
import { Comment } from "../modules/comments/comments.entity";
import { Post } from "src/modules/posts/posts.entity";
import { User } from "better-auth";
import { Seeder } from "@mikro-orm/seeder";

const generateNumberOfComments = (max: number) => {
  return faker.number.int({ min: 0, max });
}

const generateBoolean = () => {
  return faker.number.int({ min: 0, max: 1 }) === 0;
}

const createComment = async (
  post: Post, 
  users: User[], 
  em: EntityManager, 
  parentComment?: Comment, 
  depth: number = 0, 
  maxDepth: number = 3
): Promise<Comment> => {
  const comment = new Comment();
  comment.post = post;
  
  // Fix the type issue by ensuring the user object is compatible
  const randomUser = faker.helpers.arrayElement(users);
  comment.user = generateBoolean() ? randomUser.id as any : undefined;
  
  comment.content = faker.lorem.paragraph();
  
  if (parentComment) {
    comment.parent = parentComment;
  }
  
  await em.persistAndFlush(comment);
  
  // Generate child comments with decreasing probability based on depth
  if (depth < maxDepth) {
    const maxChildComments = Math.max(5 - depth * 2, 0); // Decrease max comments as depth increases
    const numberOfChildComments = generateNumberOfComments(maxChildComments);
    
    for (let i = 0; i < numberOfChildComments; i++) {
      await createComment(post, users, em, comment, depth + 1, maxDepth);
    }
  }
  
  return comment;
}

export class CommentSeeder extends Seeder {
  async run(em: EntityManager, context: Dictionary): Promise<void> {
    const posts = context.posts;
    const users = context.users;

    for (const post of posts) {
      const numberOfComments = generateNumberOfComments(10);
      for (let i = 0; i < numberOfComments; i++) {
        // Create top-level comments only, child comments will be created recursively
        await createComment(post, users, em);
      }
    }
  }
}
