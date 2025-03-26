import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class <%= className %> {
  @PrimaryKey({ type: "uuid", defaultRaw: "gen_random_uuid()" })
  id!: string;
  
  @Property()
  name!: string;

  @Property({ nullable: true })
  description?: string;

  @Property({ fieldName: "createdAt" })
  createdAt: Date = new Date();

  @Property({ fieldName: "updatedAt", onUpdate: () => new Date() })
  updatedAt: Date = new Date();
} 