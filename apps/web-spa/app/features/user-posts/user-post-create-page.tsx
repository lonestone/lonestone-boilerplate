import UserPostForm from "./user-post-form";
import { useMutation } from "@tanstack/react-query";
import { postControllerCreatePost,CreatePostSchema } from "@lonestone/openapi-generator";
import { useNavigate } from "react-router";

export default function UserPostCreatePage() {
  const { mutate: createPost, isPending } = useMutation({
    mutationFn: (data: CreatePostSchema) => postControllerCreatePost({
      body: data,
    }),
    onSuccess: (result) => {
      navigate(`/dashboard/posts/${result.data?.id}/edit`);
    },
  });
  const navigate = useNavigate();

  const onSubmit = async (data: CreatePostSchema) => {
    try {
      await createPost(data);
    } catch (error) {
      console.error(error);
    }
  };

  return <UserPostForm onSubmit={onSubmit} isSubmitting={isPending} />;
}
    