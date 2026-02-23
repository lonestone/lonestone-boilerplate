import { Elysia } from 'elysia'
import { EmailService } from './email.service'

export const emailModule = new Elysia({ name: 'email' })
  .use(EmailService)
