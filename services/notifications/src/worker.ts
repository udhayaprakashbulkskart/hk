import { decryptField } from "@hkfinhub/authentication";
import { render } from "./templates";
import type { EmailSender, NotificationJob, OutboxStore, RealtimePublisher, SmsSender } from "./ports";

export interface NotificationDeps {
  store: OutboxStore;
  email: EmailSender;
  sms: SmsSender;
  realtime: RealtimePublisher;
  fieldKey: Uint8Array;
  now?: () => Date;
}

/**
 * Delivers one notification job. Throws on provider failure so the queue retries with backoff.
 * On success the outbox payload is redacted, so the OTP ciphertext and contact details are removed.
 */
export async function deliver(job: NotificationJob, deps: NotificationDeps): Promise<"sent" | "skipped"> {
  const now = deps.now ?? (() => new Date());
  const p = job.payload;
  if (p["redacted"] === true) return "skipped";
  if (p["template"] === undefined) return "skipped";

  const template = String(p["template"]);
  const userId = String(p["userId"]);
  const data = (p["data"] as Record<string, unknown> | undefined) ?? {};
  const channel = p["channel"] === "sms" ? "sms" : p["channel"] === "email" ? "email" : undefined;
  const code = typeof p["codeEnc"] === "string" ? decryptField(deps.fieldKey, p["codeEnc"]) : undefined;

  const rendered = render(template, data, { ...(code !== undefined ? { code } : {}), ...(channel ? { channel } : {}) });
  if (!rendered) throw new Error(`unknown notification template: ${template}`);

  const contact = await deps.store.loadContact(userId);
  if (!contact) {
    // The account was closed before delivery. Nothing to send, and nothing to keep.
    await deps.store.redact(job.outboxId, now());
    return "skipped";
  }

  if (channel === "sms" || (channel === undefined && rendered.sms)) {
    if (!rendered.sms) throw new Error(`template ${template} has no SMS content`);
    await deps.sms.send({ to: String(p["destination"] ?? contact.phoneE164), text: rendered.sms.text });
  }
  if (channel === "email" || (channel === undefined && rendered.email)) {
    if (!rendered.email) throw new Error(`template ${template} has no email content`);
    await deps.email.send({ to: String(p["destination"] ?? contact.email), subject: rendered.email.subject, text: rendered.email.text });
  }
  if (rendered.inApp) {
    await deps.store.createInApp({ userId, category: rendered.inApp.category, title: rendered.inApp.title, body: rendered.inApp.body, now: now() });
    await deps.realtime.publish(userId, { type: "notification", data: { title: rendered.inApp.title, category: rendered.inApp.category } });
  }
  await deps.store.redact(job.outboxId, now());
  return "sent";
}
