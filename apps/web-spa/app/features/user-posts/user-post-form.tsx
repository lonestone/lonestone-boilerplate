import { useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { Button } from "@lonestone/ui/components/primitives/button";
import { Input } from "@lonestone/ui/components/primitives/input";
import { Loader2, Plus, Trash2, Type, Image, Video, X, MoveUp, MoveDown } from "lucide-react";
import { cn } from "@lonestone/ui/lib/utils";
import { Skeleton } from "@lonestone/ui/components/primitives/skeleton";

type PostContentItem = {
  type: "text" | "image" | "video";
  data: string;
};

type PostFormData = {
  title: string;
  content: PostContentItem[];
};

type UserPostFormProps = {
  onSubmit: (data: PostFormData) => Promise<void>;
  initialData?: PostFormData;
  isSubmitting?: boolean;
};

export default function UserPostForm({
  onSubmit,
  initialData,
  isSubmitting = false,
}: UserPostFormProps) {
  const [activeContentType, setActiveContentType] = useState<"text" | "image" | "video">("text");
  
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PostFormData>({
    defaultValues: initialData || {
      title: "",
      content: [{ type: "text", data: "" }],
    },
  });
  
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "content",
  });

  const handleFormSubmit = async (data: PostFormData) => {
    try {
      await onSubmit(data);
      // Optionally reset the form after successful submission
      // reset();
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  const addContentItem = () => {
    append({ type: activeContentType, data: "" });
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">
          {initialData ? "Edit Post" : "Create New Post"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Share your thoughts, images, and videos with the world.
        </p>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Title Input */}
        <div className="space-y-2">
          <label htmlFor="title" className="block text-sm font-medium">
            Title
          </label>
          <Input
            id="title"
            placeholder="Enter a captivating title..."
            className="w-full"
            {...register("title", {
              required: "Title is required",
              minLength: {
                value: 3,
                message: "Title must be at least 3 characters",
              },
            })}
          />
          {errors.title && (
            <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
          )}
        </div>

        {/* Content Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">Content</label>
            <div className="flex items-center space-x-2">
              <div className="bg-muted rounded-md p-1 flex">
                <button
                  type="button"
                  onClick={() => setActiveContentType("text")}
                  className={cn(
                    "p-1.5 rounded-md flex items-center justify-center",
                    activeContentType === "text" ? "bg-background shadow-sm" : "hover:bg-background/50"
                  )}
                >
                  <Type className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveContentType("image")}
                  className={cn(
                    "p-1.5 rounded-md flex items-center justify-center",
                    activeContentType === "image" ? "bg-background shadow-sm" : "hover:bg-background/50"
                  )}
                >
                  <Image className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveContentType("video")}
                  className={cn(
                    "p-1.5 rounded-md flex items-center justify-center",
                    activeContentType === "video" ? "bg-background shadow-sm" : "hover:bg-background/50"
                  )}
                >
                  <Video className="size-4" />
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addContentItem}
                className="flex items-center gap-1"
              >
                <Plus className="size-3.5" />
                Add {activeContentType}
              </Button>
            </div>
          </div>

          {fields.length === 0 && (
            <div className="text-center py-8 border border-dashed rounded-md">
              <p className="text-muted-foreground">
                No content added yet. Use the buttons above to add content.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="border rounded-md p-4 relative bg-card"
              >
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => move(index, index - 1)}
                      className="size-7"
                    >
                      <MoveUp className="size-3.5" />
                    </Button>
                  )}
                  {index < fields.length - 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => move(index, index + 1)}
                      className="size-7"
                    >
                      <MoveDown className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="size-7 text-destructive hover:text-destructive/90"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                <div className="mb-3 flex items-center gap-2">
                  {field.type === "text" && <Type className="size-4" />}
                  {field.type === "image" && <Image className="size-4" />}
                  {field.type === "video" && <Video className="size-4" />}
                  <span className="text-sm font-medium capitalize">
                    {field.type} Content
                  </span>
                </div>

                <Controller
                  control={control}
                  name={`content.${index}.type`}
                  render={({ field }) => (
                    <input type="hidden" {...field} />
                  )}
                />

                <Controller
                  control={control}
                  name={`content.${index}.data`}
                  rules={{ required: `${field.type} content is required` }}
                  render={({ field: controllerField, fieldState }) => (
                    <div>
                      {field.type === "text" && (
                        <div className="space-y-1">
                          <textarea
                            {...controllerField}
                            placeholder="Enter your text content here..."
                            className={cn(
                              "border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[120px] resize-y",
                              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                              "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
                              fieldState.error && "border-destructive"
                            )}
                          />
                          {fieldState.error && (
                            <p className="text-sm text-destructive">
                              {fieldState.error.message}
                            </p>
                          )}
                        </div>
                      )}

                      {field.type === "image" && (
                        <div className="space-y-1">
                          <Input
                            {...controllerField}
                            placeholder="Enter image URL or upload..."
                            className={cn(
                              fieldState.error && "border-destructive"
                            )}
                          />
                          {fieldState.error && (
                            <p className="text-sm text-destructive">
                              {fieldState.error.message}
                            </p>
                          )}
                          {controllerField.value && (
                            <div className="mt-2 relative rounded-md overflow-hidden border">
                              <img
                                src={controllerField.value}
                                alt="Preview"
                                className="max-h-[200px] w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = "https://placehold.co/600x400?text=Invalid+Image+URL";
                                }}
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 size-7 opacity-80 hover:opacity-100"
                                onClick={() => controllerField.onChange("")}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {field.type === "video" && (
                        <div className="space-y-1">
                          <Input
                            {...controllerField}
                            placeholder="Enter video URL (YouTube, Vimeo, etc.)"
                            className={cn(
                              fieldState.error && "border-destructive"
                            )}
                          />
                          {fieldState.error && (
                            <p className="text-sm text-destructive">
                              {fieldState.error.message}
                            </p>
                          )}
                          {controllerField.value && (
                            <div className="mt-2 p-2 bg-muted/50 rounded-md">
                              <p className="text-sm">Video URL: {controllerField.value}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Saving post...
              </span>
            ) : (
              "Save Post"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export const UserPostFormSkeleton = () => {
  return (
    <div className="space-y-8 max-w-3xl">
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
      
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-4">
          {/* Skeleton for content items */}
          {Array.from({ length: 1 }).map((_, index) => (
            <div key={index} className="space-y-2 border rounded-md p-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
        
        {/* Add content button skeleton */}
        <Skeleton className="h-10 w-40 mt-4" />
      </div>
      
      {/* Submit button skeleton */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
};