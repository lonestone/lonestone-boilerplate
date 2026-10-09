import { Test, TestingModule } from '@nestjs/testing'
import { EmailService } from './email.service'

const { mockSendMail, mockVerify } = vi.hoisted(() => ({
  mockSendMail: vi.fn(),
  mockVerify: vi.fn(),
}))

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({ sendMail: mockSendMail, verify: mockVerify })),
}))

describe('emailService', () => {
  let service: EmailService

  beforeEach(async () => {
    mockSendMail.mockReset()
    mockVerify.mockReset()

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile()

    service = module.get<EmailService>(EmailService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('sendEmail', () => {
    it('should send an email with correct parameters', async () => {
      const emailOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test content',
      }

      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

      await service.sendEmail(emailOptions)

      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: emailOptions.to,
        subject: emailOptions.subject,
        text: emailOptions.content,
        html: emailOptions.content,
      })
    })

    it('should send an email with HTML content when provided', async () => {
      const emailOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test content',
        html: '<h1>Test HTML</h1>',
      }

      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

      await service.sendEmail(emailOptions)

      expect(mockSendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: emailOptions.to,
        subject: emailOptions.subject,
        text: emailOptions.content,
        html: emailOptions.html,
      })
    })
  })

  describe('verifyConnection', () => {
    it('should return true when connection is verified', async () => {
      mockVerify.mockResolvedValue(true)

      const result = await service.verifyConnection()

      expect(result).toBe(true)
      expect(mockVerify).toHaveBeenCalled()
    })

    it('should return false when connection verification fails', async () => {
      mockVerify.mockRejectedValue(new Error('Connection failed'))

      const result = await service.verifyConnection()

      expect(result).toBe(false)
      expect(mockVerify).toHaveBeenCalled()
    })
  })
})
