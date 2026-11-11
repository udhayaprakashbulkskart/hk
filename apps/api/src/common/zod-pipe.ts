import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Validates a request body against a zod schema. Passing the schema explicitly means validation
 * does not depend on TypeScript decorator metadata, so it works the same under tsx, vitest and tsc.
 * Unknown fields are rejected (strict schemas), so clients cannot smuggle extra properties through.
 */
export class ZodPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new BadRequestException({
      code: "VALIDATION_FAILED",
      message: "Some fields are missing or invalid.",
      fields: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
}
