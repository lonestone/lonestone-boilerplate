/* oxlint-disable no-console */

import { EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { PitchkitSeeder } from './pitchkit.seeder'

/**
 * Default development seeder.
 * Creates an admin owner, one club, and 15 joined players.
 */
export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await new PitchkitSeeder().run(em)
    console.info('DatabaseSeeder done')
  }
}
