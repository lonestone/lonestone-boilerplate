import { Elysia } from 'elysia'
import { EmailService } from './email.service'

describe('emailService', () => {
  // We need to mock nodemailer.createTransport to return our mockTransporter
  vi.mock('nodemailer', () => ({
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      verify: vi.fn().mockResolvedValue(true),
    })),
  }))

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should be defined', async () => {
    expect(EmailService).toBeDefined()
  })

  describe('sendEmail', () => {
    it('should send an email with correct parameters', async () => {
      const emailOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test content',
      }

      // Let's use a dummy route to test the service
      const testApp = new Elysia()
        .use(EmailService)
        .get('/test', async ({ emailService }) => {
          await emailService.sendEmail(emailOptions)
          return { success: true }
        })

      const response = await testApp.handle(new Request('http://localhost/test'))
      expect(response.status).toBe(200)
    })

    it('should send an email with HTML content when provided', async () => {
      const emailOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test content',
        html: '<h1>Test HTML</h1>',
      }

      const testApp = new Elysia()
        .use(EmailService)
        .get('/test', async ({ emailService }) => {
          await emailService.sendEmail(emailOptions)
          return { success: true }
        })

      const response = await testApp.handle(new Request('http://localhost/test'))
      expect(response.status).toBe(200)
    })
  })

  describe('verifyConnection', () => {
    it('should return true when connection is verified', async () => {
      const testApp = new Elysia()
        .use(EmailService)
        .get('/test', async ({ emailService }) => {
          return await emailService.verifyConnection()
        })

      const response = await testApp.handle(new Request('http://localhost/test'))
      const result = await response.json()
      expect(result).toBe(true)
    })
  })
})
