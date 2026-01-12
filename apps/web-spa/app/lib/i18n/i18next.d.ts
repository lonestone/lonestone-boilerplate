import type apiEn from './locales/en/api.locales.en.json'
import type archiveEn from './locales/en/archive.locales.en.json'
import type authEn from './locales/en/auth.locales.en.json'
import type clientEn from './locales/en/client.locales.en.json'
import type commonEn from './locales/en/common.locales.en.json'
import type onboardingEn from './locales/en/onboarding.locales.en.json'
import type organizationEn from './locales/en/organization.locales.en.json'
import type proposalsEn from './locales/en/proposals.locales.en.json'
import type templateEn from './locales/en/template.locales.en.json'
import type userEn from './locales/en/user.locales.en.json'

import 'i18next'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      auth: typeof authEn
      common: typeof commonEn
      api: typeof apiEn
      organization: typeof organizationEn
      client: typeof clientEn
      proposals: typeof proposalsEn
      archive: typeof archiveEn
      editor: typeof editorEn
      user: typeof userEn
      onboarding: typeof onboardingEn
      template: typeof templateEn
    }
  }
}
