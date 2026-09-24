export function publicPostImageUrl(slug: string): string {
  return `${import.meta.env.VITE_API_URL}/api/public/posts/${encodeURIComponent(slug)}/cover-image`
}
