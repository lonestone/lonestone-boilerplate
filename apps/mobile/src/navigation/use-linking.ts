import type { LinkingOptions, NavigationContainerRefWithCurrent } from '@react-navigation/native'
import type { RootStackParamList } from './types'
import { createNavigationContainerRef } from '@react-navigation/native'
import Constants from 'expo-constants'
import * as Linking from 'expo-linking'
import React from 'react'

interface UseLinkingResult {
  linking: LinkingOptions<RootStackParamList>
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>
  onNavigationReady: () => void
}

export function useLinking(): UseLinkingResult {
  const scheme = React.useMemo(() => {
    const rawScheme = Constants.expoConfig?.scheme
    const raw = Array.isArray(rawScheme) ? rawScheme[0] : rawScheme
    return (raw ?? 'lonestone').replace('://', '')
  }, [])

  const navigationRef = React.useMemo(
    () => createNavigationContainerRef<RootStackParamList>(),
    [],
  )

  const prefixes = React.useMemo(
    () => [Linking.createURL('/'), `${scheme}://`],
    [scheme],
  )

  const linking = React.useMemo<LinkingOptions<RootStackParamList>>(() => ({
    prefixes,
    config: {
      screens: {
        Login: 'login',
        Register: 'register',
        ResetPassword: {
          path: 'reset-password',
          parse: {
            token: (token: string) => token,
          },
        },
        Home: 'home',
        Profile: 'profile',
      },
    },
  }), [prefixes])

  const pendingUrlRef = React.useRef<string | null>(null)
  const [isNavigationReady, setIsNavigationReady] = React.useState(false)

  const url = Linking.useURL()

  const handleUrl = React.useCallback((incomingUrl: string) => {
    const { path, queryParams } = Linking.parse(incomingUrl)
    const tokenParam = queryParams?.token
    const token = typeof tokenParam === 'string' ? tokenParam : undefined

    if (path === 'reset-password') {
      navigationRef.navigate('ResetPassword', { token })
    }
  }, [navigationRef])

  React.useEffect(() => {
    if (!url)
      return

    if (!navigationRef.isReady()) {
      pendingUrlRef.current = url
      return
    }

    handleUrl(url)
  }, [handleUrl, navigationRef, url])

  React.useEffect(() => {
    if (!isNavigationReady)
      return

    if (pendingUrlRef.current) {
      handleUrl(pendingUrlRef.current)
      pendingUrlRef.current = null
    }
  }, [handleUrl, isNavigationReady])

  const onNavigationReady = React.useCallback(() => {
    setIsNavigationReady(true)
  }, [])

  return { linking, navigationRef, onNavigationReady }
}
