
import dotenv from "dotenv";
import sgMail from "@sendgrid/mail";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

dotenv.config({ path: ".env.local" });

async function testSendGrid() {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName =
    process.env.SENDGRID_FROM_NAME || "Seasia Gala Event";

  if (!apiKey || !fromEmail) {
    throw new Error("SendGrid environment variables are missing.");
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const toEmail = await rl.question(
      "Enter your test recipient email: "
    );

    if (!toEmail.trim()) {
      throw new Error("Recipient email is required.");
    }

    sgMail.setApiKey(apiKey);

    console.log("\nSending test email...");

    const [response] = await sgMail.send({
      to: toEmail.trim(),
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: "Seasia Gala Event - Email Test",
      text: "Your SendGrid email integration is working!",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>Seasia Gala Event</h2>
          <p>Your SendGrid email integration is working successfully.</p>
          <p>We are ready to proceed with employee email verification.</p>
        </div>
      `,
    });

    console.log("\nEmail accepted by SendGrid!");
    console.log("Status Code:", response.statusCode);
    console.log(
      "Message ID:",
      response.headers["x-message-id"] || "Not provided"
    );
  } catch (error: any) {
    console.error("\nSendGrid test failed.");

    if (error.response?.body) {
      console.error(
        JSON.stringify(error.response.body, null, 2)
      );
    } else {
      console.error(error.message);
    }

    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

testSendGrid();
