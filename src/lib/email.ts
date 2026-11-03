
import "server-only";

import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL;
const fromName =
  process.env.SENDGRID_FROM_NAME || "Seasia Gala Event";

if (!apiKey) {
  throw new Error("SENDGRID_API_KEY is missing");
}

if (!fromEmail) {
  throw new Error("SENDGRID_FROM_EMAIL is missing");
}

const verifiedFromEmail: string = fromEmail;

sgMail.setApiKey(apiKey);

interface EmailAttachment {
  content: string;
  filename: string;
  type?: string;
  disposition?: "attachment" | "inline";
  content_id?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments = [],
}: SendEmailOptions) {
  const [response] = await sgMail.send({
    to,
    from: {
      email: verifiedFromEmail,
      name: fromName,
    },
    subject,
    html,
    text,
    ...(attachments.length > 0 && {
      attachments: attachments.map((attachment) => ({
        content: attachment.content,
        filename: attachment.filename,
        type: attachment.type || "application/octet-stream",
        disposition: attachment.disposition || "attachment",
        ...(attachment.content_id
          ? { content_id: attachment.content_id }
          : {}),
      })),
    }),
  });

  return {
    success: true,
    statusCode: response.statusCode,
    messageId: response.headers["x-message-id"],
  };
}
