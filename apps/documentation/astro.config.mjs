import starlight from '@astrojs/starlight'
// @ts-check
import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  site: 'https://lonestone.github.io',
  base: '/lonestone-boilerplate',
  integrations: [
    starlight({
      title: 'Lonestone Boilerplate Documentation',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
      sidebar: [
        { slug: 'quickstart' },
        {
          label: 'Explanations',
          autogenerate: { directory: 'explanations' },
        },
        {
          label: 'Tutorials',
          autogenerate: { directory: 'tutorials' },
        },
        {
          label: 'Guides',
          autogenerate: { directory: 'guides' },
        },
        {
          label: 'Guidelines',
          autogenerate: { directory: 'guidelines' },
        },
      ],
    }),
  ],
})
