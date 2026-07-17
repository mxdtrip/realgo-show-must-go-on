#!/usr/bin/env node
// Chrome Web Store build: same manifest as `npm run build`, minus the fields
// that only make sense for local dev — `key` (pins a stable extension ID
// across reloads) and the localhost/127.0.0.1 host permissions (dev API/web
// targets). Google's review flags both as unexplained red flags on a store
// submission.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
const original = readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(original);

delete pkg.manifest.key;
pkg.manifest.host_permissions = pkg.manifest.host_permissions.filter(
  (host) => !host.startsWith("http://localhost") && !host.startsWith("http://127.0.0.1"),
);

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

try {
  execFileSync("npx", ["plasmo", "build"], { cwd: fileURLToPath(new URL("..", import.meta.url)), stdio: "inherit" });
} finally {
  writeFileSync(pkgPath, original);
}
