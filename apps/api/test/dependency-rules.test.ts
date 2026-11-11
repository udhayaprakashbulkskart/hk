import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Enforces the dependency direction in docs/architecture.md section 2:
 * services/* are framework-agnostic and never import apps, integrations or Nest.
 */
const ROOT = join(__dirname, "..", "..", "..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "test" || name === "generated") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

function imports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(/(?:import|export)[^'"]*from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
}

describe("dependency rules", () => {
  const FORBIDDEN_IN_SERVICES = [/^@nestjs\//, /^express$/, /^socket\.io/, /\/apps\//, /\/integrations\//, /^@hkfinhub\/api/, /^pino/];

  for (const pkg of ["authentication", "notifications"]) {
    it(`services/${pkg} imports no framework, app or provider code`, () => {
      for (const file of sourceFiles(join(ROOT, "services", pkg, "src"))) {
        for (const spec of imports(file)) {
          for (const bad of FORBIDDEN_IN_SERVICES) {
            expect(bad.test(spec), `${relative(ROOT, file)} imports ${spec}`).toBe(false);
          }
        }
      }
    });
  }

  it("the database package does not import the API app", () => {
    for (const file of sourceFiles(join(ROOT, "database", "src"))) {
      for (const spec of imports(file)) {
        expect(/apps\/|@hkfinhub\/api/.test(spec), `${relative(ROOT, file)} imports ${spec}`).toBe(false);
      }
    }
  });
});
