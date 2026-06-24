import { access, rename } from "fs/promises";
import os from "os";
import path from "path";

const nextDir = path.join(process.cwd(), ".next");

try {
  await access(nextDir);
} catch {
  process.exit(0);
}

const backupDir = path.join(os.tmpdir(), `cv-mojo-next-cache-${Date.now()}`);
await rename(nextDir, backupDir);
console.log(`Moved stale .next cache to ${backupDir}`);
