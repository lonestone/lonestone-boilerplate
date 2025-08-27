import { Test, TestingModule } from '@nestjs/testing'
import { Transporter } from 'nodemailer'
import { EmailService } from './email.service'

describe('emailService', () => {
  let service: EmailService
  let mockTransporter: Partial<Transporter>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile()

    service = module.get<EmailService>(EmailService)

    // Create mock transporter
    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn(),
    }
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

      // Mock the transporter to avoid actual email sending in tests
      const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
      mockTransporter.sendMail = mockSendMail

      // Use Object.defineProperty to mock the private transporter
      Object.defineProperty(service, 'transporter', {
        value: mockTransporter,
        writable: true,
      })

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

      const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
      mockTransporter.sendMail = mockSendMail

      Object.defineProperty(service, 'transporter', {
        value: mockTransporter,
        writable: true,
      })

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
      const mockVerify = jest.fn().mockResolvedValue(true)
      mockTransporter.verify = mockVerify

      Object.defineProperty(service, 'transporter', {
        value: mockTransporter,
        writable: true,
      })

      const result = await service.verifyConnection()

      expect(result).toBe(true)
      expect(mockVerify).toHaveBeenCalled()
    })

    it('should return false when connection verification fails', async () => {
      const mockVerify = jest.fn().mockRejectedValue(new Error('Connection failed'))
      mockTransporter.verify = mockVerify

      Object.defineProperty(service, 'transporter', {
        value: mockTransporter,
        writable: true,
      })

      const result = await service.verifyConnection()

      expect(result).toBe(false)
      expect(mockVerify).toHaveBeenCalled()
    })
  })
})
