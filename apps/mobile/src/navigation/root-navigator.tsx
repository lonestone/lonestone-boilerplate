import type { NativeStackNavigationOptions } from '@react-navigation/native-stack'
import type { AuthStackParamList, MainStackParamList } from './types'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Settings } from 'lucide-react-native'
import React from 'react'
import { ActivityIndicator, TouchableOpacity, View } from 'react-native'
import { useAuthInitialization } from '@/src/common/hooks/use-auth-initialization'

import { LoginScreen } from '@/src/features/auth/screens/login-screen'
import { RegisterScreen } from '@/src/features/auth/screens/register-screen'
import { HomeScreen } from '@/src/features/home/home-screen'
import { ProfileScreen } from '@/src/features/profile/profile-screen'
import { useAuthStore } from '@/src/store'
import { colors } from '@/src/theme/colors'

const AuthStack = createNativeStackNavigator<AuthStackParamList>()
const MainStack = createNativeStackNavigator<MainStackParamList>()

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'Login' }}
      />
      <AuthStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Register' }}
      />
    </AuthStack.Navigator>
  )
}

function MainNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerShown: true,
      }}
    >
      <MainStack.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }): NativeStackNavigationOptions => ({
          title: 'Home',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              accessibilityLabel="Go to profile"
              hitSlop={8}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Settings size={20} color={colors['primary-foreground']} />
            </TouchableOpacity>
          ),
        })}
      />
      <MainStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerBackVisible: true,
          headerBackTitle: '',
        }}
      />
    </MainStack.Navigator>
  )
}

export function RootNavigator() {
  const { isInitialized } = useAuthInitialization()
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)

  // Show loading while checking auth state from SecureStore
  if (!isInitialized) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" testID="activity-indicator" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  )
}
