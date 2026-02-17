/**
 * PreToolUse hook for Bash commands.
 * Runs multiple checkers against the command and returns a deny decision
 * if any checker rejects it.
 */

import { loadConfig } from "./config";

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

export type ForbiddenPatternConfig =
  | { reason: string; suggestion: string; type?: "glob" | "regex"; disabled?: false }
  | { disabled: true };

/**
 * Load forbidden patterns from the unified config.
 * Reads `config.preBash.forbiddenPatterns` (keyed by pattern string) and
 * filters out disabled entries.
 */
export function loadForbiddenPatterns(cwd: string): ActivePattern[] {
  const config = loadConfig(cwd);
  const patterns = config.preBash?.forbiddenPatterns ?? {};
  return Object.entries(patterns)
    .filter(([, entry]) => !entry.disabled)
    .map(([pattern, entry]) => {
      const active = entry as Exclude<ForbiddenPatternConfig, { disabled: true }>;
      return { pattern, reason: active.reason, suggestion: active.suggestion, type: active.type };
    });
}

export interface ActivePattern {
  pattern: string;
  reason: string;
  suggestion: string;
  type?: "glob" | "regex";
}

/**
 * Split a command string on shell operators (`&&`, `||`, `;`, `|`),
 * trimming each sub-command.
 */
export function splitCommand(command: string): string[] {
  return command.split(/\s*(?:&&|\|\||[;|])\s*/).filter(Boolean);
}

/**
 * Convert a Claude Code–style glob pattern to a RegExp.
 *
 * Rules (matching Claude Code's Bash permission syntax):
 * - `*` is a wildcard
 * - `cmd *` (space before `*`) enforces a word boundary:
 *   matches `cmd` alone or `cmd <anything>`
 * - `cmd*` (no space) matches any string starting with `cmd`
 * - `:*` is treated as equivalent to ` *` (deprecated syntax)
 */
export function globToRegExp(pattern: string): RegExp {
  // Normalise deprecated `:*` suffix to ` *`
  const normalised = pattern.replace(/:(\*)/, " $1");

  // Split on `*` to process segments
  const parts = normalised.split("*");
  let regex = "^";

  for (let i = 0; i < parts.length; i++) {
    // Escape regex special characters in the literal segment
    const escaped = parts[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (i < parts.length - 1) {
      // Check whether the character before the `*` is a space
      if (parts[i].endsWith(" ")) {
        // Drop the trailing space from the escaped segment
        const isLast = i === parts.length - 2 && parts[i + 1] === "";
        if (isLast) {
          // Trailing `cmd *` → match `cmd` alone or `cmd <space><anything>`
          regex += escaped.slice(0, -1) + "(\\s.*)?";
        } else {
          // Middle `cmd * suffix` → require space + content
          regex += escaped.slice(0, -1) + "\\s.*";
        }
      } else {
        regex += escaped + ".*";
      }
    } else {
      regex += escaped;
    }
  }

  regex += "$";
  return new RegExp(regex);
}

/**
 * Parse a pattern string into a RegExp.
 *
 * When `type` is specified, the pattern is interpreted accordingly:
 * - `"regex"` → treated as a regex (no delimiters needed)
 * - `"glob"` → treated as a glob pattern
 *
 * When `type` is omitted, auto-detection is used:
 * - `/pattern/` or `/pattern/flags` → treated as a regex
 * - Everything else → treated as a glob pattern
 */
export function parsePattern(pattern: string, type?: "glob" | "regex"): RegExp {
  if (type === "regex") {
    return new RegExp(pattern);
  }
  if (type === "glob") {
    return globToRegExp(pattern);
  }
  const regexMatch = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
  if (regexMatch) {
    return new RegExp(regexMatch[1], regexMatch[2]);
  }
  return globToRegExp(pattern);
}

export function checkForbiddenPatterns(
  command: string,
  patterns: ActivePattern[],
): DenyResult | null {
  const subCommands = splitCommand(command);

  for (const { pattern, reason, suggestion, type } of patterns) {
    const re = parsePattern(pattern, type);

    for (const sub of subCommands) {
      if (re.test(sub)) {
        return { reason, suggestion };
      }
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
