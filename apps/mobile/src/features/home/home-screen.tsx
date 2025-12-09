import type { RootNavigationProp } from '@/src/navigation/types'
import { useNavigation } from '@react-navigation/native'
import React from 'react'
import { Text, View } from 'react-native'
import { Button } from '@/src/components'
import { useAuthStore } from '@/src/store'
import { PostsList } from './components/posts-list'

export function HomeScreen() {
  const navigation = useNavigation<RootNavigationProp>()
  const user = useAuthStore(state => state.user)

  const renderHeader = () => (
    <View className="items-center px-6 pt-8 pb-6">
      <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Welcome,
        {' '}
        {user?.name}
        !
      </Text>
      <Text className="text-gray-600 dark:text-gray-400 mb-6 text-center">
        This is your home screen. Navigate to your profile to see more details.
      </Text>
      <Button onPress={() => navigation.navigate('Profile')}>
        Go to Profile
      </Button>
    </View>
  )

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <PostsList ListHeaderComponent={renderHeader} />
    </View>
  )
}
