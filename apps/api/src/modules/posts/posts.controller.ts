import {
  Controller,
  Param,
  UseGuards,
} from "@nestjs/common";
import { PostService } from "./posts.service";
import { AuthGuard } from "../auth/auth.guard";
import { Session } from "../auth/auth.decorator";
import {
  FilteringParams,
  PaginationParams,
  SortingParams,
  TypedRoute,
  TypedParam,
  TypedBody,
} from "@lonestone/validations/server";
import {
  CreatePostInput,
  createPostSchema,
  PostFiltering,
  postFilteringSchema,
  PostPagination,
  postPaginationSchema,
  PostSorting,
  postSortingSchema,
  publicPostSchema,
  publicPostsSchema,
  updatePostSchema,
  UpdatePostInput,
  userPostSchema,
  userPostsSchema,
  UserPost,
} from "src/modules/posts/contracts/posts.contract";

@Controller("admin/posts")
@UseGuards(AuthGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

  @TypedRoute.Post("", userPostSchema)
  async createPost(
    @Session() session: { user: { id: string } },
    @TypedBody(createPostSchema) body: CreatePostInput
  ): Promise<UserPost> {
    return await this.postService.createPost(
      session.user.id,
      body
    );
  }

  @TypedRoute.Put(":id", userPostSchema)
  async updatePost(
    @Session() session: { user: { id: string } },
    @TypedParam("id") id: string,
    @TypedBody(updatePostSchema) body: UpdatePostInput
  ) {
    return await this.postService.updatePost(
      id,
      session.user.id,
      body,
    );
  }

  @TypedRoute.Patch(":id/publish")
  async publishPost(
    @Session() session: { user: { id: string } },
    @Param("id") id: string
  ) {
    return await this.postService.publishPost(session.user.id, id);
  }

  @TypedRoute.Patch(":id/unpublish")
  async unpublishPost(
    @Session() session: { user: { id: string } },
    @Param("id") id: string
  ) {
    return await this.postService.unpublishPost(session.user.id, id);
  }

  @TypedRoute.Get("", userPostsSchema)
  async getUserPosts(
    @Session() session: { user: { id: string } },
    @PaginationParams(postPaginationSchema) pagination: PostPagination,
    @SortingParams(postSortingSchema) sort?: PostSorting,
    @FilteringParams(postFilteringSchema) filter?: PostFiltering,
  ) {
    return await this.postService.getUserPosts(session.user.id, pagination, sort, filter);
  }

  @TypedRoute.Get(":id", userPostSchema)
  async getUserPost(
    @Session() session: { user: { id: string } },
    @Param("id") id: string
  ) {
    return await this.postService.getUserPost(id, session.user.id);
  }
}

@Controller("public/posts")
export class PublicPostController {
  constructor(private readonly postService: PostService) {}

  @TypedRoute.Get("random", publicPostSchema)
  async getRandomPost() {
    return await this.postService.getRandomPublicPost();
  }

  @TypedRoute.Get(":slug", publicPostSchema)
  async getPost(@TypedParam("slug") slug: string) {
    return await this.postService.getPublicPost(slug);
  }

  @TypedRoute.Get("", publicPostsSchema)
  async getPosts(
    @PaginationParams(postPaginationSchema) pagination: PostPagination,
    @SortingParams(postSortingSchema) sort?: PostSorting,
    @FilteringParams(postFilteringSchema) filter?: PostFiltering
  ) {
    return await this.postService.getPublicPosts(pagination, sort, filter);
  }
}
