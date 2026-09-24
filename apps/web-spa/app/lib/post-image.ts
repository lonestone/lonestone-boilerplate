export function publicPostImageUrl(slug: string): string {
  return `${import.meta.env.VITE_API_URL}/api/public/posts/${encodeURIComponent(slug)}/cover-image`
}

export function adminPostImageUrl(id: string): string {
  return `${import.meta.env.VITE_API_URL}/api/admin/posts/${id}/cover-image`
}
