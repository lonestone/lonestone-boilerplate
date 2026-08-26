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
      plugins: [starlightLinksValidator({ errorOnLocalLinks: false })],
      title: 'Boilerstone Documentation',
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
          items: [{ autogenerate: { directory: 'explanations' } }],
        },
        {
          label: 'Core Features',
          items: [{ autogenerate: { directory: 'core-features' } }],
        },
        {
          label: 'Adding features',
          items: [{ autogenerate: { directory: 'addons' } }],
        },
        {
          label: 'Guides',
          items: [{ autogenerate: { directory: 'guides' } }],
        },
        {
          label: 'Tutorials',
          items: [{ autogenerate: { directory: 'tutorials' } }],
        },
        {
          label: 'References',
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
