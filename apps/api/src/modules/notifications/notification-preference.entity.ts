import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { User } from '../auth/auth.entity'

@Entity({ tableName: 'notification_preference' })
@Unique({ properties: ['user'] })
export class NotificationPreference {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => User, { fieldName: 'userId', deleteRule: 'cascade' })
  user!: User

  @Property({ default: true })
  emailEnabled: boolean = true

  @Property({ default: true })
  pushEnabled: boolean = true

  @Property({ default: true })
  notifyNewMatch: boolean = true

  @Property({ default: true })
  notifyRsvpReminder: boolean = true

  @Property({ default: true })
  notifyMatchCancelled: boolean = true

  /** If true, only notify on @mentions; if false, notify on all match chat messages */
  @Property({ default: true })
  chatMentionsOnly: boolean = true

  @Property({ default: true })
  notifyChatMention: boolean = true

  @Property({ default: false })
  notifyAllChatMessages: boolean = false

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
