import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native'
import { postsQueryOptions } from '@/src/api/queries/posts-queries'
import { useTranslation } from '@/src/i18n'
import { PostCard } from './post-card'

const PAGE_SIZE = 20

interface PostsListProps {
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null
}

export function PostsList({ ListHeaderComponent }: PostsListProps) {
  const { t } = useTranslation()

  const { data, isLoading, error, refetch, isRefetching } = useQuery(
    postsQueryOptions({ offset: 0, pageSize: PAGE_SIZE }),
  )

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <ActivityIndicator size="large" className="text-primary" />
        <Text className="mt-4 text-sm text-muted">
          {t('home.posts.loading')}
        </Text>
      </View>
    )
  }

  if (error) {
    return (
      <View className="mx-4 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
        <Text className="text-center text-sm font-medium text-red-600 dark:text-red-300">
          {t('home.posts.error')}
        </Text>
        <Text className="mt-1 text-center text-xs text-red-500 dark:text-red-400">
          {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
      </View>
    )
  }

  if (!data?.data || data.data.length === 0) {
    return (
      <View className="mx-4 rounded-2xl border border-border bg-card/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/50">
        <Text className="text-center text-lg font-medium text-zinc-900 dark:text-white">
          {t('home.posts.empty')}
        </Text>
      </View>
    )
  }

  const renderHeader
    = ListHeaderComponent
      ? typeof ListHeaderComponent === 'function'
        ? <ListHeaderComponent />
        : ListHeaderComponent
      : null

  const listHeader = (
    <>
      {renderHeader}
      <View className="mb-3 mt-4 flex-row items-center justify-between px-4">
        <Text className="text-xl font-semibold text-zinc-900 dark:text-white">
          Your Posts
        </Text>
        <Text className="text-sm text-muted">
          {data.meta.itemCount}
          {' '}
          {data.meta.itemCount === 1 ? 'post' : 'posts'}
        </Text>
      </View>
    </>
  )

  return (
    <FlatList
      data={data.data}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <PostCard post={item} />}
      ListHeaderComponent={listHeader}
      refreshControl={(
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor="#888"
        />
      )}
      contentContainerClassName="pb-4"
      showsVerticalScrollIndicator={false}
    />
  )
}
