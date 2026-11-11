# @hkfinhub/notifications

Notification pipeline: outbox relay to a job queue, delivery through email, SMS and in-app channels, and realtime fan-out.

- `relay.ts`: claims unpublished outbox rows inside a transaction and enqueues them. Job ids equal outbox ids, so a crash and retry cannot send twice.
- `worker.ts`: decrypts one-time codes, renders the template, sends, writes the in-app inbox, publishes the realtime event, then redacts the outbox payload.
- `templates.ts`: message content. Security templates also go to the in-app inbox.
- `senders.ts`: `CaptureSender` (tests and local only; refused in production) and `UnconfiguredSender` (fails closed when no provider is approved).
- `realtime.ts`: publishes on Redis channels `realtime:user:<id>`, which the API gateway delivers to sockets.

Real email and SMS providers are not chosen yet (decision D12). Until one is approved, messages fail with `ProviderNotConfiguredError` and retry with backoff. They are not dropped silently.
