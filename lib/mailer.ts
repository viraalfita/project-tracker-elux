import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.resend.com",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER ?? "resend",
    pass: process.env.SMTP_PASS ?? "",
  },
});

export async function sendInviteEmail({
  to,
  name,
  appUrl,
}: {
  to: string;
  name: string;
  appUrl: string;
}) {
  const from = process.env.SMTP_FROM ?? "tracker@eluxemang.top";

  await transport.sendMail({
    from,
    to,
    subject: "You're invited to Elux Space Project Tracker",
    text: [
      `Hello ${name},`,
      "",
      "You have been invited to join the Elux Space Project Tracker.",
      "",
      "You can access the system using this email address.",
      "",
      "When logging in, simply enter your email and you will receive a one-time login code (OTP).",
      "",
      `Login here: ${appUrl}/login`,
      "",
      "If you were not expecting this invitation, you can ignore this email.",
      "",
      "Elux Space",
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="display:inline-block;background:#4f46e5;border-radius:12px;padding:14px 18px;margin-bottom:12px;">
            <span style="color:white;font-size:22px;font-weight:700;">PT</span>
          </div>
          <h1 style="font-size:20px;font-weight:700;margin:0 0 4px;">Project Tracker</h1>
          <p style="color:#64748b;font-size:13px;margin:0;">Elux Space</p>
        </div>

        <p style="font-size:15px;line-height:1.6;margin:0 0 12px;color:#334155;">
          Hello <strong>${name}</strong>,
        </p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 12px;color:#334155;">
          You have been invited to join the <strong>Elux Space Project Tracker</strong>.
        </p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#334155;">
          When logging in, simply enter your email address and you will receive
          a one-time login code (OTP) to your inbox.
        </p>

        <div style="text-align:center;margin:32px 0;">
          <a href="${appUrl}/login"
             style="display:inline-block;background:#4f46e5;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
            Go to Login
          </a>
        </div>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />
        <p style="font-size:13px;color:#94a3b8;text-align:center;margin:0;">
          If you were not expecting this invitation, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
