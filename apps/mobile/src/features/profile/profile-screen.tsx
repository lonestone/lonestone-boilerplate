import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/src/components'
import { useAuthStore } from '@/src/store'

export function ProfileScreen() {
  const { user, logout } = useAuthStore()
  const [isLoading, setIsLoading] = React.useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await authClient.signOut()
      logout()
    }
    catch (err) {
      console.error('Logout error:', err)
    }
    finally {
      setIsLoading(false)
    }
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-900">
      <View className="px-6 py-8">
        <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Profile
        </Text>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Name
          </Text>
          <Text className="text-lg text-gray-900 dark:text-white">
            {user?.name}
          </Text>
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Email
          </Text>
          <Text className="text-lg text-gray-900 dark:text-white">
            {user?.email}
          </Text>
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            User ID
          </Text>
          <Text className="text-lg text-gray-900 dark:text-white font-mono">
            {user?.id}
          </Text>
        </View>

        <Button
          variant="secondary"
          onPress={handleLogout}
          isLoading={isLoading}
        >
          Sign Out
        </Button>
      </View>
    </ScrollView>
  )
}
