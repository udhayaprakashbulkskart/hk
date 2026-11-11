/**
 * Pure monitoring rules. No I/O, so they are unit-testable and deterministic.
 * Thresholds are policy inputs supplied by the caller, not constants buried here.
 */
export interface TransferEvent {
  at: Date;
  amountMinor: bigint;
}

export interface VelocityPolicy {
  windowMs: number;
  /** Alert when the count in the window is greater than this. */
  maxCount: number;
}

export interface StructuringPolicy {
  /** Reporting threshold in minor units. */
  threshold: bigint;
  /** Amounts at or above this and below the threshold count as "just under". */
  lowerBound: bigint;
  windowMs: number;
  /** Alert when at least this many just-under transfers occur in the window. */
  minCount: number;
}

function inWindow(e: TransferEvent, now: Date, windowMs: number): boolean {
  const t = e.at.getTime();
  return t <= now.getTime() && t > now.getTime() - windowMs;
}

export function velocityBreached(events: TransferEvent[], now: Date, p: VelocityPolicy): boolean {
  return events.filter((e) => inWindow(e, now, p.windowMs)).length > p.maxCount;
}

export function structuringDetected(events: TransferEvent[], now: Date, p: StructuringPolicy): boolean {
  const near = events.filter(
    (e) => inWindow(e, now, p.windowMs) && e.amountMinor >= p.lowerBound && e.amountMinor < p.threshold,
  );
  return near.length >= p.minCount;
}
