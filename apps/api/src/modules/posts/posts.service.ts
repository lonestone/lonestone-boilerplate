import { Injectable } from '@nestjs/common';
import { EntityManager, FilterQuery } from '@mikro-orm/core';
import { Post, PostVersion } from './posts.entity';
import { User } from '../auth/auth.entity';
import type { Content } from './posts.entity';

@Injectable()
export class PostService {
  constructor(private readonly em: EntityManager) {}

  async createPost(userId: string, title: string, content: Content[]) {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) throw new Error('User not found');

    const post = new Post();
    post.user = user;

    const version = new PostVersion();
    version.post = post;
    version.title = title;
    version.content = content;

    await this.em.persistAndFlush([post, version]);
    return post;
  }

  async updatePost(userId: string, postId: string, title: string, content: Content[]) {
    const post = await this.em.findOne(Post, { id: postId, user: userId }, { populate: ['versions'] });
    if (!post) throw new Error('Post not found');

    const version = new PostVersion();
    version.post = post;
    version.title = title;
    version.content = content;

    await this.em.persistAndFlush(version);
    return post;
  }

  async publishPost(userId: string, postId: string) {
    const post = await this.em.findOne(Post, { id: postId, user: userId });
    if (!post) throw new Error('Post not found');

    post.publishedAt = new Date();
    await this.em.flush();
    return post;
  }

  async unpublishPost(userId: string, postId: string) {
    const post = await this.em.findOne(Post, { id: postId, user: userId });
    if (!post) throw new Error('Post not found');

    post.publishedAt = undefined;
    await this.em.flush();
    return post;
  }

  async getPost(postId: string, userId: string) {
    return await this.em.findOne(Post, { id: postId, user: userId }, {
      populate: ['versions', 'user']
    });
  }

  async getUserPosts(userId: string) {
    return await this.em.find(Post, { user: userId }, {
      populate: ['versions'],
      orderBy: { createdAt: 'DESC' }
    });
  }

  async getPosts() {
    const filter: FilterQuery<Post> = { publishedAt: { $ne: null } };
    return await this.em.find(Post, filter, {
      populate: ["versions", "user"],
      orderBy: { publishedAt: 'DESC' }
    });
  }

  async getPublicPost(postId: string) {
    return await this.em.findOne(Post, { id: postId, publishedAt: { $ne: null } }, {
      populate: ['versions']
    });
  }

  async getPublicPosts() {
    return await this.em.find(Post, { publishedAt: { $ne: null } }, {
      populate: ["versions", "user"],
      orderBy: { publishedAt: 'DESC' }
    });
  }
} 