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
      plugins: [starlightLinksValidator(
        { errorOnLocalLinks: false },
      )],
      title: 'Boilerstone Documentation',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/lonestone/lonestone-boilerplate' }],
      sidebar: [
        { slug: 'quickstart' },
        {
          label: 'Explanations',
          autogenerate: { directory: 'explanations' },
        },
        {
          label: 'Core Features',
          autogenerate: { directory: 'core-features' },
        },
        {
          label: 'Adding features',
          autogenerate: { directory: 'addons' },
        },
        {
          label: 'Guides',
          autogenerate: { directory: 'guides' },
        },
        {
          label: 'Tutorials',
          autogenerate: { directory: 'tutorials' },
        },
        {
          label: 'References',
          autogenerate: { directory: 'references' },
        },
      ],
    }),
  ],
})
