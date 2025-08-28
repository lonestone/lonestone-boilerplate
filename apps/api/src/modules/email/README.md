# Email Module

This module handles email sending in the application using Nodemailer.

## Technologies Used

- [nodemailer](https://nodemailer.com/about/) - Email sending service
- [MailDev](https://maildev.github.io/maildev/) - Email testing tool for development

## Features

- Email sending service with Nodemailer
- Support for both plain text and HTML emails
- Email connection verification
- Comprehensive error handling and logging
- Environment-based configuration
- MailDev integration for development

## Configuration

### Development with MailDev

For development, you can use MailDev to catch and view emails locally:

1. **Install MailDev globally:**
   ```bash
   npm install -g maildev
   ```

2. **Start MailDev:**
   ```bash
   maildev
   ```

3. **Configure environment variables:**
   ```env
   # Email Configuration (MailDev)
   EMAIL_HOST=localhost
   EMAIL_PORT=1025
   EMAIL_SECURE=false
   EMAIL_FROM=noreply@localhost
   ```

4. **Access MailDev UI:**
   - Web interface: http://localhost:1080
   - SMTP server: localhost:1025

### Production Configuration

For production, configure with your SMTP provider:

```env
# Email Configuration (Production)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

### Gmail Setup

For Gmail, you'll need to:
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the App Password as `EMAIL_PASSWORD`

## Usage

### Basic Email Sending

```typescript
import { EmailService } from './email.service'

@Injectable()
export class SomeService {
  constructor(private readonly emailService: EmailService) {}

  async sendWelcomeEmail(userEmail: string) {
    await this.emailService.sendEmail({
      to: userEmail,
      subject: 'Welcome to our platform!',
      content: 'Thank you for joining us.',
    })
  }
}
```

### HTML Email Sending

```typescript
await this.emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  content: 'Welcome to our platform!',
  html: '<h1>Welcome!</h1><p>Thank you for joining us.</p>',
})
```

### Connection Verification

```typescript
const isConnected = await this.emailService.verifyConnection()
if (isConnected) {
  console.log('Email service is ready')
}
else {
  console.log('Email service connection failed')
}
```

## Interface

```typescript
interface EmailOptions {
  to: string
  subject: string
  content: string
  html?: string
}
```

## Error Handling

The service includes comprehensive error handling:
- Connection verification on startup
- Detailed error logging
- Graceful error handling for failed email sends
- Proper error propagation to calling services

## Development Workflow

1. Start MailDev: `maildev`
2. Configure your application with MailDev settings
3. Send emails through your application
4. View emails in MailDev web interface at http://localhost:1080
5. For production, switch to your SMTP provider configuration
