/**
 * Message templates. Plain, specific, and never includes more personal data than needed.
 * Security templates also go to the in-app inbox, so the customer keeps a record.
 */

export interface RenderedMessage {
  email?: { subject: string; text: string };
  sms?: { text: string };
  inApp?: { category: string; title: string; body: string };
}

export function render(template: string, data: Record<string, unknown>, extra: { code?: string; channel?: "email" | "sms"; name?: string }): RenderedMessage | null {
  const s = (k: string) => String(data[k] ?? "");
  switch (template) {
    case "otp": {
      const code = extra.code ?? "";
      if (extra.channel === "sms") {
        return { sms: { text: `HK FinHub: your code is ${code}. It expires in 5 minutes. Never share it with anyone.` } };
      }
      return {
        email: {
          subject: "Your HK FinHub verification code",
          text: `Your HK FinHub verification code is ${code}. It expires in 5 minutes.\n\nIf you did not request this code, you can ignore this email. We will never ask you for this code by phone or chat.`,
        },
      };
    }
    case "welcome":
      return { inApp: { category: "system", title: "Welcome to HK FinHub", body: "Your identity contact details are verified. You can now log in." } };
    case "new_device":
      return security(
        "New device signed in",
        `A new device (${s("deviceName")}, ${s("platform")}) signed in to your account. If this was not you, change your password now and sign out the device in Security.`,
        "New device signed in",
      );
    case "account_locked":
      return security("Account temporarily locked", `Too many failed log in attempts. Your account is locked for ${s("minutes")} minutes.`, "Account temporarily locked");
    case "password_changed":
      return security("Password changed", "Your password was changed. Other devices have been signed out. If this was not you, contact support immediately.", "Password changed");
    case "password_reset":
      return security("Password reset", "Your password was reset and all devices have been signed out.", "Password reset");
    case "totp_enabled":
      return security("Two-factor authentication on", "Two-factor authentication is now on for your account.", "Two-factor authentication on");
    case "totp_disabled":
      return security("Two-factor authentication off", "Two-factor authentication was turned off. If this was not you, contact support immediately.", "Two-factor authentication off");
    case "device_revoked":
      return security("Device signed out", `The device ${s("deviceName")} was signed out of your account.`, "Device signed out");
    case "refresh_reuse":
      return security("Session ended for your protection", "We detected a repeated use of an old session token and ended that session. Log in again, and change your password if this was not you.", "Session ended for your protection");
    case "registration_attempted":
      return security("Registration attempt", "Someone tried to create an HK FinHub account with your email address. If this was not you, you can ignore this message.", "Registration attempt");
    default:
      return null;
  }
}

function security(subject: string, body: string, title: string): RenderedMessage {
  return {
    email: { subject: `HK FinHub: ${subject}`, text: `${body}\n\n— HK FinHub security` },
    inApp: { category: "security", title, body },
  };
}
