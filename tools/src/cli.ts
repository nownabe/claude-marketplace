#!/usr/bin/env bun

import { hello } from "./commands/hello.ts";

const args = Bun.argv.slice(2);
const command = args[0];

switch (command) {
  case "hello":
    hello();
    break;
  default:
    console.log("Usage: tools <command>");
    console.log("");
    console.log("Commands:");
    console.log("  hello  Print a greeting with your username");
    process.exit(command ? 1 : 0);
}
