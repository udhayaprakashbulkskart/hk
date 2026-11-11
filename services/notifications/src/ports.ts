/**
 * Ports for the notification pipeline. Persistence, queueing, providers and realtime are injected.
 */

export interface OutboxRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface OutboxStore {
  transaction<T>(fn: (tx: OutboxStore) => Promise<T>): Promise<T>;
  /** Unpublished rows, oldest first. Must lock rows so parallel relays never pick the same row. */
  claimUnpublished(limit: number): Promise<OutboxRow[]>;
  markPublished(ids: string[], now: Date): Promise<void>;
  /** Replaces the payload with a redaction marker once the message is delivered. */
  redact(id: string, now: Date): Promise<void>;
  loadContact(userId: string): Promise<{ email: string; phoneE164: string; fullName: string } | null>;
  createInApp(input: { userId: string; category: string; title: string; body: string; now: Date }): Promise<void>;
}

export interface JobQueue {
  /** Adds a job. Using the same jobId twice must not create a second job. */
  add(jobId: string, data: NotificationJob): Promise<void>;
}

export interface NotificationJob {
  outboxId: string;
  payload: Record<string, unknown>;
}

export interface EmailSender {
  send(input: { to: string; subject: string; text: string }): Promise<void>;
}

export interface SmsSender {
  send(input: { to: string; text: string }): Promise<void>;
}

export interface RealtimePublisher {
  publish(userId: string, event: { type: string; data: Record<string, unknown> }): Promise<void>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(channel: "email" | "sms") {
    super(`No ${channel} provider is configured. Messages are not sent until one is approved (decision D12).`);
    this.name = "ProviderNotConfiguredError";
  }
}
