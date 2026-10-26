import "server-only";
import { Resend } from "resend";
import { APP_DOMAIN } from "./config";

export async function sendEmail(to: string, subject: string, text: string) {
  if (!process.env.RESEND_API_KEY) return console.warn("[email] RESEND_API_KEY missing, skipped:", subject);
  await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.EMAIL_FROM ?? `Glowie <hello@${APP_DOMAIN}>`, to, subject, text });
}
