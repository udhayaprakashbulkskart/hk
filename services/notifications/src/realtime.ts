import type { Redis } from "ioredis";
import type { RealtimePublisher } from "./ports";

export const REALTIME_CHANNEL_PREFIX = "realtime:user:";

/** Publishes realtime events over Redis, so any API instance can fan them out to its sockets. */
export class RedisRealtimePublisher implements RealtimePublisher {
  constructor(private readonly redis: Pick<Redis, "publish">) {}
  async publish(userId: string, event: { type: string; data: Record<string, unknown> }): Promise<void> {
    await this.redis.publish(`${REALTIME_CHANNEL_PREFIX}${userId}`, JSON.stringify(event));
  }
}
