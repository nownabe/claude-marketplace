#!/usr/bin/env bun

import { commands as gh } from "./commands/gh";
import { parseRepoFlag } from "./commands/gh/repo";

const subcommands: Record<string, Record<string, () => Promise<void>>> = {
  gh,
};

// Extract --repo flag from all args so it can appear anywhere (e.g. before the subcommand name)
const { remaining: cleanedArgs } = parseRepoFlag(process.argv.slice(2));

const group = cleanedArgs[0];
const name = cleanedArgs[1];

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
