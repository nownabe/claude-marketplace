/**
 * PreToolUse hook for Bash commands.
 * Runs multiple checkers against the command and returns a deny decision
 * if any checker rejects it.
 */

import { resolve, dirname, join } from "path";
import { existsSync, readFileSync } from "fs";

// --- Types ---

/**
 * Common input fields.
 * @see https://code.claude.com/docs/en/hooks#common-input-fields
 */
interface HookCommonInput {
  /** Current session identifier. */
  session_id: string;
  /** Path to conversation JSON. */
  transcript_path: string;
  /** Current working directory when the hook is invoked. */
  cwd: string;
  /** Current permission mode: "default", "plan", "acceptEdits", "dontAsk", or "bypassPermissions". */
  permission_mode: string;
  /** Name of the event that fired. */
  hook_event_name: string;
}

/**
 * Tool-specific input fields for PreToolUse.
 * @see https://code.claude.com/docs/en/hooks#pretooluse-input
 */
interface HookInput extends HookCommonInput {
  /** Name of the tool being called. */
  tool_name: string;
  /** The parameters sent to the tool. */
  tool_input: {
    /** The command to execute. */
    command: string;
    /** Clear, concise description of what this command does. */
    description?: string;
    /** Optional timeout in milliseconds (max 600000). */
    timeout?: number;
    /** Set to true to run this command in the background. */
    run_in_background?: boolean;
  };
  /** Unique identifier for this tool call. */
  tool_use_id: string;
}

interface DenyResult {
  reason: string;
  suggestion: string;
}

/**
 * Hook output for PreToolUse.
 * @see https://code.claude.com/docs/en/hooks#hook-output
 */
interface HookOutput {
  hookSpecificOutput: {
    /** Name of the event that fired. */
    hookEventName: "PreToolUse";
    /** "allow" bypasses the permission system, "deny" prevents the tool call, "ask" prompts the user to confirm. */
    permissionDecision: "allow" | "deny" | "ask";
    /** For "allow" and "ask", shown to the user but not Claude. For "deny", shown to Claude. */
    permissionDecisionReason?: string;
    /** Modifies the tool's input parameters before execution. Combine with "allow" to auto-approve, or "ask" to show the modified input to the user. */
    updatedInput?: Record<string, unknown>;
    /** String added to Claude's context before the tool executes. */
    additionalContext?: string;
  };
}

// --- Feature: Forbidden Command Patterns ---

export type ForbiddenPatternEntry =
  | { pattern: string; reason: string; suggestion: string; disabled?: false }
  | { pattern: string; disabled: true };

const CONFIG_FILENAME = "pre-bash.json";

interface PreBashConfig {
  forbiddenPatterns?: ForbiddenPatternEntry[];
}

/**
 * Collect directories from `startDir` up to (and including) `stopDir`.
 * Returns paths from startDir (most specific) to stopDir (least specific).
 */
export function collectAncestorDirs(startDir: string, stopDir: string): string[] {
  const start = resolve(startDir);
  const stop = resolve(stopDir);
  const dirs: string[] = [];
  let current = start;
  for (;;) {
    dirs.push(current);
    if (current === stop) break;
    const parent = dirname(current);
    if (parent === current) break; // reached filesystem root
    current = parent;
  }
  return dirs;
}

/**
 * Load pre-bash.json config files from CWD up to HOME and merge
 * forbiddenPatterns. Files are loaded from CWD (most specific) to
 * HOME (least specific). For duplicate pattern strings, the first
 * occurrence (child) wins, allowing child-level files to override
 * parent patterns (e.g. disable them).
 */
export function loadForbiddenPatterns(cwd: string): ActivePattern[] {
  const home = process.env.HOME ?? "";
  if (!home) return [];

  const dirs = collectAncestorDirs(cwd, home);
  const seen = new Set<string>();
  const patterns: ForbiddenPatternEntry[] = [];

  for (const dir of dirs) {
    const filePath = join(dir, ".claude", CONFIG_FILENAME);
    if (!existsSync(filePath)) continue;
    try {
      const config: PreBashConfig = JSON.parse(readFileSync(filePath, "utf-8"));
      for (const entry of config.forbiddenPatterns ?? []) {
        if (!seen.has(entry.pattern)) {
          seen.add(entry.pattern);
          patterns.push(entry);
        }
      }
    } catch {
      // skip malformed files
    }
  }

  return patterns.filter((entry): entry is ActivePattern => !entry.disabled);
}

export type ActivePattern = Extract<ForbiddenPatternEntry, { reason: string }>;

export function checkForbiddenPatterns(
  command: string,
  patterns: ActivePattern[],
): DenyResult | null {
  for (const { pattern, reason, suggestion } of patterns) {
    if (new RegExp(pattern).test(command)) {
      return { reason, suggestion };
    }
  }
  return null;
}

// --- Checker Pipeline ---

type Checker = (command: string) => DenyResult | null;

// --- Main ---

export async function main() {
  const text = await Bun.stdin.text();
  const input: HookInput = JSON.parse(text);
  const command = input.tool_input.command;

  const forbiddenPatterns = loadForbiddenPatterns(input.cwd);
  const checkers: Checker[] = [(cmd) => checkForbiddenPatterns(cmd, forbiddenPatterns)];

  for (const checker of checkers) {
    const result = checker(command);
    if (result) {
      const output: HookOutput = {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `${result.reason} ${result.suggestion}`,
          additionalContext: result.suggestion,
        },
      };
      console.log(JSON.stringify(output));
      process.exit(0);
    }
  }

  // All checks passed — no opinion, let normal permission flow continue.
  process.exit(0);
}

