#!/usr/bin/env bun

import { commands as gh } from "./commands/gh";

const subcommands: Record<string, Record<string, () => Promise<void>>> = {
  gh,
};

const group = process.argv[2];
const name = process.argv[3];

if (!group || !(group in subcommands)) {
  const available = Object.keys(subcommands).join(", ");
  console.error(group ? `Unknown command group: ${group}` : "No command specified");
  console.error(`Available command groups: ${available}`);
  process.exit(1);
}

const groupCommands = subcommands[group];

if (!name || !(name in groupCommands)) {
  const available = Object.keys(groupCommands).join(", ");
  console.error(name ? `Unknown command: ${group} ${name}` : `No subcommand specified`);
  console.error(`Available commands for '${group}': ${available}`);
  process.exit(1);
}

await groupCommands[name]();
