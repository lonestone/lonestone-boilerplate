import PostCard from "@/features/posts/post-card";
import { publicPostControllerGetRandomPost } from "@lonestone/openapi-generator";
import { queryClient } from "@/lib/query-client";
import { dehydrate, useQuery } from "@tanstack/react-query";

// https://tanstack.com/query/latest/docs/framework/react/guides/ssr
// Example of use TanStack query with SSR 
const publicPostRandomQuery = {
  queryKey: ["publicPostRandom"],
  queryFn: async () => await publicPostControllerGetRandomPost(),
};

export const loader = async () => {
  await queryClient.prefetchQuery(publicPostRandomQuery);

  return {
    dehydratedState: dehydrate(queryClient),
  };
};

export default function HomePage() {
  const { data: post } = useQuery(publicPostRandomQuery);

  const contentPreview = post?.data?.content.find(
    (content) => content.type === "text"
  )

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <h1 className="text-4xl font-bold">Home</h1>
      <p>This is the home page. It is pre-rendered.</p>

      {post?.data && (
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Random post</h2>
          {contentPreview && (
            <div>
              <PostCard
                post={{
                  ...post.data,
                  contentPreview: contentPreview,
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function meta() {
  return [
    {
      title: "Home",
    },
    {
      property: "og:title",
      content: "Home",
    },
    {
      name: "description",
      content: "Home page",
    },
  ];
}
