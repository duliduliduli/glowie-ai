import "server-only";
import { Resend } from "resend";

export async function sendEmail(to: string, subject: string, text: string) {
  if (!process.env.RESEND_API_KEY) return console.warn("[email] RESEND_API_KEY missing, skipped:", subject);
  await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.EMAIL_FROM ?? "Glowie <hello@glowupai.app>", to, subject, text });
}
