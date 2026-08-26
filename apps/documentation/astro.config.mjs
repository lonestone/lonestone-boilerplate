import starlight from '@astrojs/starlight'
// @ts-check
import { defineConfig } from 'astro/config'
import starlightLinksValidator from 'starlight-links-validator'

// https://astro.build/config
export default defineConfig({
  site: 'https://lonestone.github.io',
  base: '/lonestone-boilerplate',
  integrations: [
    starlight({
      plugins: [
        starlightLinksValidator({
          errorOnLocalLinks: false,
          // French pages may link to pages that are not translated yet;
          // those resolve to Starlight's fallback (English) pages.
          errorOnFallbackPages: false,
        }),
      ],
      title: 'Boilerstone Documentation',
      // English lives at the root (no /en/ prefix); French pages live in
      // src/content/docs/fr/ and fall back to English when untranslated.
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        fr: { label: 'Français' },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/lonestone/lonestone-boilerplate',
        },
      ],
      sidebar: [
        { slug: 'quickstart' },
        {
          label: 'Explanations',
          translations: { fr: 'Explications' },
          items: [{ autogenerate: { directory: 'explanations' } }],
        },
        {
          label: 'Core Features',
          translations: { fr: 'Fonctionnalités de base' },
          items: [{ autogenerate: { directory: 'core-features' } }],
        },
        {
          label: 'Adding features',
          translations: { fr: 'Ajouter des fonctionnalités' },
          items: [{ autogenerate: { directory: 'addons' } }],
        },
        {
          label: 'Guides',
          items: [{ autogenerate: { directory: 'guides' } }],
        },
        {
          label: 'Tutorials',
          translations: { fr: 'Tutoriels' },
          items: [{ autogenerate: { directory: 'tutorials' } }],
        },
        {
          label: 'References',
          translations: { fr: 'Références' },
          items: [{ autogenerate: { directory: 'references' } }],
        },
        {
          label: 'Releases',
          items: [{ autogenerate: { directory: 'releases' } }],
        },
      ],
    }),
  ],
})
