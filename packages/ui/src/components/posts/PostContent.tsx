import { PostContentSchema } from "@lonestone/openapi-generator";

export default function PostContent({
  content,
}: {
  content: Array<PostContentSchema>;
}) {
  return (
    <div>
      {content.map((item) => {
        switch (item.type) {
          case "text":
            return <PostText data={item.data} />;
          case "image":
            return <PostImage data={item.data} />;
          case "video":
            return <PostVideo data={item.data} />;
        }
      })}
    </div>
  );
}

function PostText({ data }: { data: string }) {
  return <p>{data}</p>;
}

function PostImage({ data }: { data: string }) {
  return <img src={data} alt={data} />;
}

function PostVideo({ data }: { data: string }) {
  return <video src={data} controls />;
}
