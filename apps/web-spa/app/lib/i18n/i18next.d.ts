import type commonEn from './locales/en/common.locales.en.json'

import 'i18next'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      common: typeof commonEn
    }
  }
}
