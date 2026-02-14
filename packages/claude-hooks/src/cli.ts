#!/usr/bin/env bun

import { main as preBash } from "./pre-bash";

const commands: Record<string, () => Promise<void>> = {
  "pre-bash": preBash,
};

const name = process.argv[2];

if (!name || !(name in commands)) {
  const available = Object.keys(commands).join(", ");
  console.error(name ? `Unknown command: ${name}` : "No command specified");
  console.error(`Available commands: ${available}`);
  process.exit(1);
}

await commands[name]();
