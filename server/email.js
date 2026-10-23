import nodemailer from 'nodemailer';
import { getSettings } from './config.js';

export function emailConfigured() {
  const e = getSettings().email;
  return !!(e.smtpHost && e.from);
}

export async function sendEmail({ to, cc, subject, body }) {
  const e = getSettings().email;
  if (!emailConfigured()) throw new Error('Email is not configured. Add SMTP details in Settings → Tools & connectors → Email.');
  const transport = nodemailer.createTransport({
    host: e.smtpHost, port: Number(e.smtpPort) || 587, secure: !!e.secure,
    auth: e.user ? { user: e.user, pass: e.pass } : undefined,
  });
  const info = await transport.sendMail({ from: e.from, to, cc: cc || undefined, subject, text: body });
  return { messageId: info.messageId, accepted: info.accepted };
}
