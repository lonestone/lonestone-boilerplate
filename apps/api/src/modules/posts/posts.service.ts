import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, FilterQuery } from '@mikro-orm/core';
import { Post, PostVersion } from './posts.entity';
import { User } from '../auth/auth.entity';
import { CreatePostInput, PostFiltering, PublicPosts, UpdatePostInput, UserPost, UserPosts } from 'src/modules/posts/contracts/posts.contract';
import { PostSorting, PostPagination } from 'src/modules/posts/contracts/posts.contract';
import { PublicPost } from './contracts/posts.contract';
import { CommentsService } from '../comments/comments.service';

@Injectable()
export class PostService {
  constructor(
    private readonly em: EntityManager,
    private readonly commentsService: CommentsService
  ) {}

  async createPost(userId: string, data: CreatePostInput): Promise<UserPost> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) throw new Error('User not found');

    const post = new Post();
    post.user = user;

    const version = new PostVersion();
    version.post = post;
    version.title = data.title;
    version.content = data.content;

    await this.em.persistAndFlush([post, version]);
    return {
      id: post.id,
      title: version.title,
      content: version.content,
      type: "draft",
      publishedAt: post.publishedAt,
      versions: [
        {
          id: version.id,
          title: version.title,
          createdAt: version.createdAt,
        },
      ],
    } satisfies UserPost;
  }

  async updatePost(postId: string, userId: string, data: UpdatePostInput): Promise<UserPost> {
    const post = await this.em.findOne(Post, { id: postId, user: userId }, { populate: ['versions'] });
    if (!post) throw new Error('Post not found');

    const latestVersion = await this.em.findOne(PostVersion, { post: post.id }, {
      orderBy: { createdAt: 'DESC' }
    });
    if (!latestVersion) throw new Error('No version found');

    // On crée une nouvelle version seulement si le post est publié et que la dernière version
    // a été créée avant la publication
    const shouldCreateNewVersion = post.publishedAt && post.publishedAt < latestVersion.createdAt;

    if (shouldCreateNewVersion) {
      const version = new PostVersion();
      version.post = post;
      version.title = data.title ?? latestVersion.title;
      version.content = data.content ?? latestVersion.content;
      await this.em.persistAndFlush(version);
    } else {
      // Sinon on met à jour la dernière version
      if (data.title) latestVersion.title = data.title;
      if (data.content) latestVersion.content = data.content;
      await this.em.flush();
    }

    return {
      id: post.id,
      title: latestVersion.title,
      content: latestVersion.content ?? [],
      type: post.publishedAt && post.publishedAt < latestVersion.createdAt ? "published" : "draft",
      publishedAt: post.publishedAt,
      versions: [
        {
          id: latestVersion.id,
          title: latestVersion.title,
          createdAt: latestVersion.createdAt,
        },
      ],
    } satisfies UserPost;
  }

  async publishPost(userId: string, postId: string) {
    const post = await this.em.findOne(Post, { id: postId, user: userId });
    if (!post) throw new Error('Post not found');

    const latestVersion = await this.em.findOne(PostVersion, { post: post.id }, {
      orderBy: { createdAt: 'DESC' }
    });
    if (!latestVersion) throw new Error('No version found');

    const now = new Date();
    // On vérifie que la dernière version est antérieure à la date de publication
    if (latestVersion.createdAt > now) {
      throw new Error('Cannot publish: latest version is newer than publication date');
    }

    post.publishedAt = now;
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

  async getUserPost(postId: string, userId: string): Promise<UserPost> {
    const post = await this.em.findOne(Post, { id: postId, user: userId }, {
      populate: ['versions', 'user']
    });
    if (!post) throw new Error('Post not found');

    return {
      id: post.id,
      title: post.versions.getItems()[post.versions.getItems().length - 1].title,
      content: post.versions.getItems()[post.versions.getItems().length - 1].content ?? [],
      type: post.publishedAt && post.publishedAt < post.versions.getItems()[post.versions.getItems().length - 1].createdAt ? "published" : "draft",
      publishedAt: post.publishedAt,
      versions: post.versions.getItems().map(version => ({
        id: version.id,
        title: version.title,
        createdAt: version.createdAt,
      })),
    } satisfies UserPost;
  }

  async getUserPosts(userId: string, pagination: PostPagination, sort?: PostSorting, filter?: PostFiltering): Promise<UserPosts> {
    const where: FilterQuery<Post> = { user: userId };
    const orderBy: Record<string, 'ASC' | 'DESC'> = { createdAt: 'DESC' };

    if (filter?.length) {
      filter.forEach((item) => {
        if (item.property === 'title') {
          where['versions'] = { title: { $like: `%${item.value}%` } };
        }
      });
    }

    if (sort?.length) {
      sort.forEach((sortItem) => {
        if (sortItem.property !== 'title') {
          orderBy[sortItem.property] = sortItem.direction.toUpperCase() as 'ASC' | 'DESC';
        }
      });
    }

    const [posts, total] = await this.em.findAndCount(Post, where, {
      populate: ['versions'],
      orderBy,
      limit: pagination.pageSize,
      offset: pagination.offset,
      fields: [
        'id', 'slug', 'publishedAt',
        'versions.id', 'versions.title', 'versions.createdAt'
      ]
    });

    const data = await Promise.all(posts.map(async post => {
      const latestVersionId = post.versions.getItems()[post.versions.getItems().length - 1].id;
      if (!latestVersionId) throw new Error(`No version found for post ${post.id}`);

      // Trouver le premier contenu de type text pour l'aperçu
      const latestVersion = await this.em.findOne(PostVersion, { id: latestVersionId, }, {
        orderBy: { createdAt: 'ASC' },
      });
      
      if (!latestVersion) throw new Error(`No version found for post ${post.id}`);

      const contentPreview = latestVersion.content?.find(c => c.type === 'text') ?? {
        type: 'text' as const,
        data: ''
      };


      return {
        publishedAt: post.publishedAt,
        title: latestVersion.title,
        slug: post.slug,
        id: post.id,
        versions: post.versions.getItems().map(version => ({
          id: version.id,
          title: version.title,
          createdAt: version.createdAt,
        })),
        type: post.publishedAt && post.publishedAt < latestVersion.createdAt ? "published" : "draft",
        contentPreview
      } satisfies UserPosts['data'][number];
    }));

    return {
      data,
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    };
  }

  async getPublicPost(slug: string): Promise<PublicPost> {
    // Récupérer le post publié avec son auteur
    const post = await this.em.findOne(Post, 
      { slug, publishedAt: { $ne: null } },
      {
        populate: ['user'],
      }
    );

    if (!post) throw new Error('Post not found');

    // Récupérer la dernière version antérieure à la date de publication
    const latestVersion = await this.em.findOne(PostVersion, 
      { 
        post: post.id,
        createdAt: { $lte: post.publishedAt! }
      }, 
      {
        orderBy: { createdAt: 'DESC' }
      }
    );

    if (!latestVersion) throw new Error('No valid version found');

    // Get comment count
    const commentCount = post.slug ? await this.commentsService.getCommentCount(post.slug) : 0;

    // Retourner le format public
    return {
      publishedAt: post.publishedAt!,
      title: latestVersion.title,
      content: latestVersion.content || [],
      author: {
        name: post.user.name,
      },
      slug: post.slug,
      commentCount,
    };
  }

  async getRandomPublicPost(): Promise<PublicPost> {
    const postsCount = await this.em.count(Post, { publishedAt: { $ne: null } });
    const randomIndex = Math.floor(Math.random() * postsCount);
    const postSlug = await this.em.find(Post, { publishedAt: { $ne: null } }, {
      populate: ['user'],
      orderBy: { createdAt: 'DESC' },
      offset: randomIndex,
      limit: 1
    });

    if (!postSlug[0].slug) throw new NotFoundException('No post found');
    return this.getPublicPost(postSlug[0].slug);
  }

  async getPublicPosts(
    pagination: PostPagination,
    sort?: PostSorting,
    filter?: PostFiltering
  ): Promise<PublicPosts> {
    // Construire la requête de base pour les posts publiés
    const where: FilterQuery<Post> = { publishedAt: { $ne: null } };
    const orderBy: Record<string, 'ASC' | 'DESC'> = { publishedAt: 'DESC' };

    // Appliquer les filtres si présents
    if (filter?.length) {
      filter.forEach((item) => {
        if (item.property === 'title') {
          // Pour le filtre sur le titre, on doit passer par les versions
          where['versions'] = { title: { $like: `%${item.value}%` } };
        }
      });
    }

    // Appliquer le tri
    if (sort?.length) {
      sort.forEach((sortItem) => {
        if (sortItem.property !== 'title') {
          orderBy[sortItem.property] = sortItem.direction.toUpperCase() as 'ASC' | 'DESC';
        }
      });
    }

    // Récupérer les posts avec pagination
    const [posts, total] = await this.em.findAndCount(Post, where, {
      populate: ['user'],
      orderBy,
      limit: pagination.pageSize,
      offset: pagination.offset,
    });

    // Récupérer les dernières versions valides pour tous les posts en une seule requête
    const postIds = posts.map(p => p.id);
    
    // D'abord, récupérer toutes les versions pour ces posts
    const allVersions = await this.em.find(PostVersion, { post: { $in: postIds } }, {
      orderBy: { createdAt: 'DESC' }
    });

    // Organiser les versions par post
    const versionsByPost = new Map<string, PostVersion[]>();
    allVersions.forEach(version => {
      const postId = version.post.id;
      if (!versionsByPost.has(postId)) {
        versionsByPost.set(postId, []);
      }
      versionsByPost.get(postId)!.push(version);
    });

    // Get comment counts for all posts
    const commentCountsPromises = posts.map(post => 
      post.slug ? this.commentsService.getCommentCount(post.slug) : 0
    );
    const commentCounts = await Promise.all(commentCountsPromises);
    const commentCountByPostId = new Map<string, number>();
    posts.forEach((post, index) => {
      commentCountByPostId.set(post.id, commentCounts[index]);
    });

    // Construire la réponse
    const data = posts.map(post => {
      // Trouver la dernière version valide pour ce post
      const versions = versionsByPost.get(post.id) || [];
      const validVersions = versions.filter(v => v.createdAt <= post.publishedAt!);
      const latestVersion = validVersions[0]; // Déjà triées par date décroissante
      
      if (!latestVersion) {
        throw new Error(`No valid version found for post ${post.id}`);
      }

      // Trouver un aperçu du contenu (premier élément de type texte)
      const contentPreview = latestVersion.content?.find(c => c.type === 'text') || {
        type: 'text',
        data: '',
      };

      return {
        title: latestVersion.title,
        publishedAt: post.publishedAt!,
        slug: post.slug,
        author: {
          name: post.user.name,
        },
        contentPreview,
        commentCount: commentCountByPostId.get(post.id) || 0,
      };
    });

    return {
      data,
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    };
  }
} 