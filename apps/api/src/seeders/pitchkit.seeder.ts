/* oxlint-disable no-console */

import { EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { createUserData } from '../modules/auth/auth.factory'
import { Member, Organization, SportType } from '../modules/auth/auth.entity'

const DEV_PASSWORD = 'password123!'

const ADMIN = {
  name: 'Admin Rösti',
  firstName: 'Admin',
  lastName: 'Rösti',
  email: 'admin@admin.fr',
  password: DEV_PASSWORD,
}

const CLUB = {
  name: 'Rösti FC',
  slug: 'rosti-fc',
  venue: 'Stade des Développeurs',
  sportType: SportType.Football,
  defaultMaxCapacity: 14,
}

const PLAYERS: Array<{ firstName: string; lastName: string }> = [
  { firstName: 'Lucas', lastName: 'Martin' },
  { firstName: 'Hugo', lastName: 'Bernard' },
  { firstName: 'Louis', lastName: 'Dubois' },
  { firstName: 'Gabriel', lastName: 'Thomas' },
  { firstName: 'Arthur', lastName: 'Robert' },
  { firstName: 'Jules', lastName: 'Richard' },
  { firstName: 'Adam', lastName: 'Petit' },
  { firstName: 'Leo', lastName: 'Durand' },
  { firstName: 'Raphael', lastName: 'Leroy' },
  { firstName: 'Nathan', lastName: 'Moreau' },
  { firstName: 'Ethan', lastName: 'Simon' },
  { firstName: 'Paul', lastName: 'Laurent' },
  { firstName: 'Tom', lastName: 'Lefebvre' },
  { firstName: 'Noah', lastName: 'Michel' },
  { firstName: 'Theo', lastName: 'Garcia' },
]

/**
 * Development seeder: one club owner, one club, and 15 players already joined.
 *
 * Login: admin@admin.fr / password123!
 * Players: player01@rosti.dev … player15@rosti.dev / password123!
 */
export class PitchkitSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const admin = await createUserData(
      em,
      {
        name: ADMIN.name,
        firstName: ADMIN.firstName,
        lastName: ADMIN.lastName,
        email: ADMIN.email,
        emailVerified: true,
      },
      ADMIN.password,
    )

    const organization = em.create(Organization, {
      name: CLUB.name,
      slug: CLUB.slug,
      venue: CLUB.venue,
      sportType: CLUB.sportType,
      defaultMaxCapacity: CLUB.defaultMaxCapacity,
      createdAt: new Date(),
    })

    const adminMembership = em.create(Member, {
      user: admin,
      organization,
      role: 'owner',
      createdAt: new Date(),
    })

    await em.persist([organization, adminMembership]).flush()

    for (let index = 0; index < PLAYERS.length; index++) {
      const player = PLAYERS[index]
      const email = `player${String(index + 1).padStart(2, '0')}@rosti.dev`
      const name = `${player.firstName} ${player.lastName}`

      const user = await createUserData(
        em,
        {
          name,
          firstName: player.firstName,
          lastName: player.lastName,
          email,
          emailVerified: true,
        },
        DEV_PASSWORD,
      )

      const membership = em.create(Member, {
        user,
        organization,
        role: 'member',
        createdAt: new Date(),
      })

      await em.persist(membership).flush()
    }

    console.info('PitchkitSeeder: admin@admin.fr / password123!')
    console.info(`PitchkitSeeder: club "${CLUB.name}" with ${PLAYERS.length} players`)
  }
}
