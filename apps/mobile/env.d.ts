/// <reference types="nativewind/types" />

declare module '@env' {
  export const EXPO_PUBLIC_API_URL: string
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_API_URL: string
    }
  }
}

export {}
