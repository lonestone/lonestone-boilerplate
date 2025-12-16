import React from 'react'
import { LogBox } from 'react-native'
import { AppContainer } from './src/app/app-container'

import { AppProviders } from './src/app/app-providers'
import './src/i18n' // Initialize i18n
import './global.css'

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated and will be removed in a future release. Please use \'react-native-safe-area-context\' instead.',
])

export default function App() {
  return (
    <AppProviders>
      <AppContainer />
    </AppProviders>
  )
}
