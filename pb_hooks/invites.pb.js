/// <reference path="../pb_data/types.d.ts" />

/**
 * PocketBase hook: send an informational invitation email when an invite
 * record is created.
 *
 * This hook uses PocketBase's built-in mailer ($app.newMailClient()) so it
 * respects whatever SMTP settings are configured in Dashboard > Settings >
 * Mail settings — no separate email service is needed.
 *
 * IMPORTANT: This email does NOT contain an OTP code.
 * OTP is only generated when the invited user visits /login and submits their
 * email address. This email simply tells them they have been invited and
 * provides the login link.
 *
 * Deployment: place this file in the pb_hooks/ directory on your PocketBase
 * server and restart PocketBase. The hook will be picked up automatically.
 *
 * APP_URL: update the constant below to match your Next.js app's public URL.
 */

const APP_URL = "https://app.eluxemang.top";

onRecordCreateRequest((e) => {
    // Let the record be created first
    e.next();

    const invite = e.record;
    const email  = invite.getString("email");
    const userId = invite.getString("user");

    // Resolve the invited user's name from the linked user record
    let name = email; // fallback to email if the user record can't be loaded
    try {
        const user = $app.findRecordById("users", userId);
        const recordName = user.getString("name");
        if (recordName) name = recordName;
    } catch (_) {
        // Non-fatal — email still sends with email address as the name
    }

    const senderAddress = $app.settings().meta.senderAddress;
    const senderName    = $app.settings().meta.senderName || "Elux Space";
    const loginUrl      = APP_URL + "/login";

    const htmlBody = `
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
          <a href="${loginUrl}"
             style="display:inline-block;background:#4f46e5;color:white;padding:12px 32px;
                    border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
            Go to Login
          </a>
        </div>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />
        <p style="font-size:13px;color:#94a3b8;text-align:center;margin:0;">
          If you were not expecting this invitation, you can safely ignore this email.
        </p>
      </div>
    `;

    const textBody = [
        "Hello " + name + ",",
        "",
        "You have been invited to join the Elux Space Project Tracker.",
        "",
        "You can access the system using this email address.",
        "",
        "When logging in, simply enter your email and you will receive a one-time login code (OTP).",
        "",
        "Login here: " + loginUrl,
        "",
        "If you were not expecting this invitation, you can ignore this email.",
        "",
        "Elux Space",
    ].join("\n");

    const message = new MailerMessage({
        from: {
            address: senderAddress,
            name:    senderName,
        },
        to:      [{ address: email }],
        subject: "You're invited to Elux Space Project Tracker",
        html:    htmlBody,
        text:    textBody,
    });

    try {
        $app.newMailClient().send(message);
    } catch (err) {
        // Non-fatal: the invite record was already created successfully.
        // The inviter can ask the recipient to visit the login page directly.
        $app.logger().error("Failed to send invite email", "error", String(err));
    }
}, "invites");
