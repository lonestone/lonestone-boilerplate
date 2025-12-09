import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

/**
 * Authentication Stack Parameters
 * Screens available when user is NOT authenticated
 */
export interface AuthStackParamList {
  [key: string]: object | undefined
  Login: undefined
  Register: undefined
}

/**
 * Main Application Stack Parameters
 * Screens available when user IS authenticated
 */
export interface MainStackParamList {
  [key: string]: object | undefined
  Home: undefined
  Profile: undefined
}

/**
 * Root Stack - Union of all possible screens
 */
export type RootStackParamList = AuthStackParamList & MainStackParamList

/**
 * Navigation prop for Auth screens
 */
export type AuthNavigationProp = NativeStackNavigationProp<AuthStackParamList>

/**
 * Navigation prop for Main screens
 */
export type MainNavigationProp = NativeStackNavigationProp<MainStackParamList>

/**
 * Generic navigation prop (can navigate to any screen)
 * Use this when you need to navigate across stacks
 */
export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * Global type declaration for React Navigation
 * Enables type-safe navigation without prop drilling
 */
declare global {
  // eslint-disable-next-line ts/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
