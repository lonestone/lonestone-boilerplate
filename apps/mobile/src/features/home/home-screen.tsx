import { Button } from '@/src/components'
import { useTranslation } from '@/src/i18n'
import type { RootNavigationProp } from '@/src/navigation/types'
import { useAuthStore } from '@/src/store'
import { useNavigation } from '@react-navigation/native'
import React from 'react'
import { Text, View } from 'react-native'
import { PostsList } from './components/posts-list'

export function HomeScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<RootNavigationProp>()
  const user = useAuthStore(state => state.user)

  const renderHeader = () => (
    <View className="items-center px-6 pt-8 pb-6">
      <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        {t('home.welcomeName', { name: user?.name ?? '' })}
      </Text>
      <Text className="text-gray-600 dark:text-gray-400 mb-6 text-center">
        {t('home.subtitle')}
      </Text>
      <Button onPress={() => navigation.navigate('Profile')}>
        {t('navigation.goToProfile')}
      </Button>
    </View>
  )

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <PostsList ListHeaderComponent={renderHeader} />
    </View>
  )
}
