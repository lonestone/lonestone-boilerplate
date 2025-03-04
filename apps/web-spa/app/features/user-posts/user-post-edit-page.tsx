import UserPostForm, { UserPostFormSkeleton } from "./user-post-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { postControllerGetUserPost, postControllerUpdatePost,UpdatePostSchema } from "@lonestone/openapi-generator";
import { useNavigate, useParams } from "react-router";

export default function UserPostEditPage() {
  const { userPostId } = useParams();
  
  const { data: post, isLoading } = useQuery({
    queryKey: ["userPost", userPostId],
    queryFn: () => postControllerGetUserPost({
      path: {
        id: userPostId as string,
      },
    }),
  });

  const { mutate: UpdatePost, isPending } = useMutation({
    mutationFn: (data: UpdatePostSchema) => postControllerUpdatePost({
      body: data,
      path: {
        id: userPostId as string,
      },
    }),
    onSuccess: (result) => {
      navigate(`/dashboard/posts/${result.data?.id}/edit`);
    },
  });
  const navigate = useNavigate();

  const onSubmit = async (data: UpdatePostSchema) => {
    try {
      await UpdatePost(data);
    } catch (error) {
      console.error(error);
    }
  };

  // Show skeleton while loading
  if (isLoading) {
    return <UserPostFormSkeleton />;
  }

  return <UserPostForm onSubmit={onSubmit} initialData={{
    title: post?.data?.title ?? "",
    content: post?.data?.content ?? [],
  }} isSubmitting={isPending} />;
}
    