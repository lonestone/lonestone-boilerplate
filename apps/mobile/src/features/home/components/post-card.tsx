import type { UserPostsSchema } from '@lonestone/openapi-generator'
import { Clock, FileText } from 'lucide-react-native'
import * as React from 'react'
import { Text, View } from 'react-native'

interface PostCardProps {
  post: UserPostsSchema['data'][number]
}

export function PostCard({ post }: PostCardProps) {
  const latestVersion = post.versions[0]
  const isPublished = post.type === 'published'

  return (
    <View className="mx-4 mb-3 rounded-2xl border border-border bg-card p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Title */}
      <Text className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
        {post.title}
      </Text>

      {/* Status Badge */}
      <View className="mb-3 self-start">
        <View
          className={`rounded-full px-3 py-1 ${
            isPublished
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'bg-yellow-100 dark:bg-yellow-900/30'
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              isPublished
                ? 'text-green-700 dark:text-green-300'
                : 'text-yellow-700 dark:text-yellow-300'
            }`}
          >
            {isPublished ? 'Published' : 'Draft'}
          </Text>
        </View>
      </View>

      {/* Content Preview */}
      {post.contentPreview && (
        <View className="mb-3">
          {post.contentPreview.type === 'text' && (
            <View className="flex-row items-start gap-2">
              <FileText size={16} className="text-muted mt-0.5" />
              <Text className="flex-1 text-sm text-muted" numberOfLines={2}>
                {post.contentPreview.data}
              </Text>
            </View>
          )}
          {post.contentPreview.type === 'image' && (
            <Text className="text-xs text-muted">📷 Image content</Text>
          )}
          {post.contentPreview.type === 'video' && (
            <Text className="text-xs text-muted">🎥 Video content</Text>
          )}
        </View>
      )}

      {/* Date */}
      {latestVersion && (
        <View className="flex-row items-center gap-1">
          <Clock size={14} className="text-muted" />
          <Text className="text-xs text-muted">
            {new Date(latestVersion.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
      )}
    </View>
  )
}
