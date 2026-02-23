import { Elysia } from 'elysia'
import { createTransport, Transporter } from 'nodemailer'
import { config } from '../../config/env.config'

export interface EmailOptions {
  to: string
  subject: string
  content: string
  html?: string
}

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  auth?: {
    user: string
    pass: string
  }
}

function createEmailTransporter() {
  const transportConfig: SmtpConfig = {
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
  }

  // Only add auth if user and password are provided
  if (config.email.user && config.email.password) {
    transportConfig.auth = {
      user: config.email.user,
      pass: config.email.password,
    }
  }

  return createTransport(transportConfig)
}

export const EmailService = new Elysia({ name: 'Email.Service' })
  .derive({ as: 'global' }, () => {
    const transporter: Transporter = createEmailTransporter()
    const logger = console

    return {
      emailService: {
        sendEmail: async ({
          to,
          subject,
          content,
          html,
        }: EmailOptions): Promise<void> => {
          try {
            const mailOptions = {
              from: config.email.from,
              to,
              subject,
              text: content,
              html: html || content,
            }

            const info = await transporter.sendMail(mailOptions)

            logger.log(`Email sent successfully to ${to}: ${info.messageId}`)
          }
          catch (error) {
            logger.error(`Failed to send email to ${to}:`, error)
            throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        },

        verifyConnection: async (): Promise<boolean> => {
          try {
            await transporter.verify()
            logger.log('Email service connection verified successfully')
            return true
          }
          catch (error) {
            logger.error('Email service connection verification failed:', error)
            return false
          }
        },
      },
    }
  })
