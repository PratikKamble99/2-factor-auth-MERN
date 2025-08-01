import { config } from "../config/app.config";
import { resend } from "./resendClient";

type params = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  from?: string;
};

const mail_sender =
  config.NODE_ENV == "production"
    ? `no-reply<${config.MAILER_SENDER}>`
    : "no-reply<onboarding@resend.dev>";

export async function sendmail({
  html,
  subject,
  text,
  to,
  from = mail_sender,
}: params) {
  return await resend.emails.send({
    from,
    to,
    text,
    subject,
    html,
  });
}
