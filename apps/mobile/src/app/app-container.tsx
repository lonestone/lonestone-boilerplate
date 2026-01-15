import { StatusBar } from 'expo-status-bar'
import * as React from 'react'
import { ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { secureStorageReady } from '@/lib/secure-storage-adapter'
import { useTheme } from '@/src/common/hooks/use-theme'
import { RootNavigator } from '@/src/navigation/root-navigator'

export function AppContainer() {
  const [isStorageReady, setIsStorageReady] = React.useState(false)
  const { colorScheme } = useTheme()

  React.useEffect(() => {
    secureStorageReady.finally(() => setIsStorageReady(true))
  }, [])

  if (!isStorageReady) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
      <Toast />
    </SafeAreaView>
  )
}
