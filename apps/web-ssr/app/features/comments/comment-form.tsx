import { useForm } from "react-hook-form";
import { Loader2, Send, User } from "lucide-react";
import { Button } from "@lonestone/ui/components/primitives/button";
import { Textarea } from "@lonestone/ui/components/primitives/textarea";
import { Card, CardContent } from "@lonestone/ui/components/primitives/card";
import { cn } from "@lonestone/ui/lib/utils";

import {
  zCreateCommentSchema,
  CreateCommentSchema,
} from "@lonestone/openapi-generator";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";

type CommentFormProps = {
  initialData?: CreateCommentSchema;
  onSubmit?: (data: CreateCommentSchema) => void;
  isPending?: boolean;
  onCancel?: () => void;
};

export function CommentForm({
  initialData,
  onSubmit,
  isPending,
  onCancel,
}: CommentFormProps) {
  // Form for adding comments
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid, isDirty },
    reset,
    watch,
  } = useForm<CreateCommentSchema>({
    resolver: zodResolver(zCreateCommentSchema),
    defaultValues: {
      content: initialData?.content || "",
      parentId: initialData?.parentId || undefined,
    },
    mode: "onChange",
  });

  // Reset form when initialData changes (e.g. when cancelling a reply)
  useEffect(() => {
    if (initialData) {
      reset({
        content: initialData.content || "",
        parentId: initialData.parentId || undefined,
      });
    }
  }, [initialData, reset]);

  // Handle form submission
  const _onSubmit = async (data: CreateCommentSchema) => {
    try {
      await onSubmit?.(data);
      // Only reset if not a reply form
      if (!initialData?.parentId) {
        reset({ content: "", parentId: undefined });
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const content = watch("content");
  const isReply = !!initialData?.parentId;
  const hasContent = content.trim().length > 0;

  return (
    <Card
      data-has-content={hasContent}
      data-is-reply={isReply}
      className={cn(
        "border shadow-sm transition-all data-[has-content=true]:border-primary/20 data-[is-reply=true]:bg-muted/30"
      )}
    >
      <CardContent>
        <form onSubmit={handleSubmit(_onSubmit)} className="space-y-3">
          <div className="flex gap-3">
            <div
              className={cn(
                "flex-shrink-0 flex items-center justify-center rounded-full bg-primary/10",
                isReply ? "h-6 w-6" : "h-8 w-8"
              )}
            >
              <User
                className={cn("text-primary", isReply ? "h-3 w-3" : "h-4 w-4")}
              />
            </div>

            <div className="flex-1 space-y-2">
              <Textarea
                {...register("content")}
                placeholder={
                  isReply ? "Write your reply..." : "Write your comment..."
                }
                className={cn(
                  "resize-none transition-all focus-visible:ring-primary/30",
                  isReply ? "min-h-[80px] text-sm" : "min-h-[100px]",
                  errors.content ? "border-destructive" : ""
                )}
              />
              {errors.content && (
                <p className="text-xs text-destructive font-medium">
                  {errors.content.message}
                </p>
              )}

              <div
                className={cn(
                  "flex items-center",
                  isReply ? "justify-end gap-2 mt-2" : "justify-between mt-3"
                )}
              >
                {isReply ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onCancel}
                    className="h-8 px-3 text-xs"
                  >
                    Cancel
                  </Button>
                ) : null}

                <Button
                  type="submit"
                  variant={isReply ? "default" : "default"}
                  size={isReply ? "sm" : "default"}
                  className={cn(
                    "gap-1.5 transition-all",
                    isReply ? "h-8 px-3 text-xs" : "",
                    !isValid && "opacity-70"
                  )}
                  disabled={isSubmitting || isPending || !isDirty || !isValid}
                >
                  {isPending || isSubmitting ? (
                    <>
                      <Loader2
                        className={cn(
                          "animate-spin",
                          isReply ? "h-3 w-3" : "h-4 w-4"
                        )}
                      />
                      <span>{isReply ? "Sending..." : "Posting..."}</span>
                    </>
                  ) : (
                    <>
                      <Send className={cn(isReply ? "h-3 w-3" : "h-4 w-4")} />
                      <span>{isReply ? "Reply" : "Post Comment"}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
