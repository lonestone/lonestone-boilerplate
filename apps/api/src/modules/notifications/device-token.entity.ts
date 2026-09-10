import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { User } from '../auth/auth.entity'
import { DevicePlatform } from './contracts/notification.contract'

@Entity({ tableName: 'device_token' })
export class DeviceToken {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => User, { fieldName: 'userId', deleteRule: 'cascade' })
  @Index()
  user!: User

  @Property()
  token!: string

  @Enum({ items: () => DevicePlatform })
  platform!: DevicePlatform

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
