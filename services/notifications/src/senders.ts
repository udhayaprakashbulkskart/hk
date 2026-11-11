import type { EmailSender, SmsSender } from "./ports";
import { ProviderNotConfiguredError } from "./ports";

/** Records messages in memory. For local development and tests only. Refused in production. */
export class CaptureSender implements EmailSender, SmsSender {
  readonly sent: { channel: "email" | "sms"; to: string; subject?: string; text: string }[] = [];

  async send(input: { to: string; subject?: string; text: string }): Promise<void> {
    this.sent.push({ channel: input.subject ? "email" : "sms", to: input.to, ...(input.subject ? { subject: input.subject } : {}), text: input.text });
  }

  latest(to: string, channel: "email" | "sms"): { subject?: string; text: string } | undefined {
    return [...this.sent].reverse().find((m) => m.to === to && m.channel === channel);
  }
}

/** Fails closed. Used when no provider is approved, so no customer message is silently dropped. */
export class UnconfiguredSender implements EmailSender, SmsSender {
  constructor(private readonly channel: "email" | "sms") {}
  async send(): Promise<void> {
    throw new ProviderNotConfiguredError(this.channel);
  }
}
