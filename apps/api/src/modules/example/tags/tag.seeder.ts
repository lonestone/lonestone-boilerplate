import { Dictionary, EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import slugify from 'slugify'
import { Tag } from './tag.entity'

const TAG_DEFINITIONS = [
  { name: 'TypeScript' },
  { name: 'NestJS' },
  { name: 'React' },
  { name: 'Database Design' },
  { name: 'API Design' },
  { name: 'Performance' },
  { name: 'Testing' },
  { name: 'Security' },
  { name: 'DevOps' },
  { name: 'Open Source' },
]

export class TagSeeder extends Seeder {
  async run(em: EntityManager, context: Dictionary): Promise<void> {
    const tags: Tag[] = []

    for (const def of TAG_DEFINITIONS) {
      const tag = new Tag()
      tag.name = def.name
      tag.slug = slugify(def.name, { lower: true, strict: true })
      await em.persist(tag).flush()
      tags.push(tag)
    }

    context.tags = tags
  }
}
