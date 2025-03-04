import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  async sendEmail({
    to,
    subject,
    content,
  }: {
    to: string;
    subject: string;
    content: string;
  }): Promise<void> {
    // Pour l'instant, on va juste logger les emails
    console.log('Email envoyé :', {
      to,
      subject,
      content,
    });
  }
} 