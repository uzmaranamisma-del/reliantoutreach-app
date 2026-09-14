import nodemailer from "nodemailer";
export async function sendMail(to: string, subject: string, text: string) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM_EMAIL)
    throw new Error("SMTP is not configured");
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  await transport.sendMail({
    from: {
      name: process.env.SMTP_FROM_NAME || "ReliantOutreach",
      address: process.env.SMTP_FROM_EMAIL,
    },
    to,
    subject,
    text,
  });
  transport.close();
}
