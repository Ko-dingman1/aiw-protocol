import { cp } from 'node:fs/promises';
await cp(
  new URL('../apps/dashboard/public/', import.meta.url),
  new URL('../dist/apps/dashboard/public/', import.meta.url),
  { recursive: true },
);
