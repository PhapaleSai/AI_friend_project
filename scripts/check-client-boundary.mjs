/**
 * Fails if anything an API route imports — directly or transitively — is
 * marked 'use client'.
 *
 * Calling a client-marked function from a route throws only at runtime, and
 * only when that code path is actually reached. toneInstruction() slipped
 * through because its call sits behind `if (tone)`, so it worked for every
 * user who had not chosen a tone, including in every test.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const full = join(dir, entry);
  return statSync(full).isDirectory() ? walk(full) : [full];
});

const isClientModule = (file) => readFileSync(file, 'utf8').trimStart().startsWith("'use client'");

const resolve = (spec) => {
  const base = spec.replace(/^@\//, '');
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

const importsOf = (file) =>
  [...readFileSync(file, 'utf8').matchAll(/from\s+'(@\/[^']+)'/g)].map((m) => m[1]);

const routes = existsSync('app/api') ? walk('app/api').filter((f) => f.endsWith('route.ts')) : [];
const seen = new Set();
const violations = [];

const visit = (file, chain) => {
  if (seen.has(file)) return;
  seen.add(file);
  if (isClientModule(file) && chain.length > 1) {
    violations.push(chain.join(' -> '));
    return;
  }
  for (const spec of importsOf(file)) {
    const target = resolve(spec);
    if (target) visit(target, [...chain, target]);
  }
};

for (const route of routes) visit(route, [route]);

if (violations.length > 0) {
  console.error("Client-only modules reachable from an API route:\n");
  for (const v of violations) console.error('  ' + v);
  console.error("\nMove the shared code into a module without 'use client'.");
  process.exit(1);
}
console.log(`client boundary ok — ${routes.length} API routes checked`);
