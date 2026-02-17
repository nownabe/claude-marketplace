# @nownabe/claude-hooks

A collection of [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) for enhanced workflow automation.

## Installation

```bash
npm install -g @nownabe/claude-hooks
```

## Configuration

All hooks share a single config file: `.claude/nownabe-claude-hooks.json` (or `.claude/nownabe-claude-hooks.local.json` for machine-local overrides).

```json
{
  "preBash": {
    "forbiddenPatterns": {
      "git -C *": {
        "reason": "git -C is not allowed",
        "suggestion": "Run git commands from the working directory directly"
      }
    }
  },
  "notification": {
    "sounds": {
      "permission_prompt": "C:\\Windows\\Media\\Windows Notify System Generic.wav",
      "*": "C:\\Windows\\Media\\tada.wav"
    }
  }
}
```

Config files are loaded hierarchically from the current working directory up to `$HOME`. Files are deep merged — objects are recursively merged (child keys override parent keys), while primitives are replaced entirely by the child value.

File priority (highest first, per directory from CWD to HOME):

1. `CWD/.claude/nownabe-claude-hooks.local.json`
2. `CWD/.claude/nownabe-claude-hooks.json`
3. `<parent>/.claude/nownabe-claude-hooks.local.json`
4. `<parent>/.claude/nownabe-claude-hooks.json`
5. ... up to `$HOME`

## Hooks

### `pre-bash` — Forbidden Command Patterns

A `PreToolUse` hook that blocks dangerous or unwanted Bash commands based on configurable patterns.

#### Setup

Add to your `settings.json` (`~/.claude/settings.json`, `.claude/settings.json`, or `.claude/settings.local.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "npx @nownabe/claude-hooks pre-bash"
          }
        ]
      }
    ]
  }
}
```

#### Configuration

Add a `preBash` section to your `.claude/nownabe-claude-hooks.json`. Patterns are specified as an object keyed by pattern string:

```json
{
  "preBash": {
    "forbiddenPatterns": {
      "git -C *": {
        "reason": "git -C is not allowed",
        "suggestion": "Run git commands from the working directory directly"
      },
      "git push --force *": {
        "reason": "Force push is dangerous",
        "suggestion": "Use --force-with-lease instead"
      },
      "rm -rf /*": {
        "reason": "Dangerous delete from root",
        "suggestion": "Be more specific about the target path"
      }
    }
  }
}
```

#### Pattern types

Two pattern formats are supported. Patterns are treated as **glob by default**; wrap in `/` delimiters for regex, or use the `type` field for explicit control.

**Glob patterns** (default, Claude Code style):

| Pattern        | Matches                               | Does not match  |
| -------------- | ------------------------------------- | --------------- |
| `git commit *` | `git commit -m msg`, `git commit`     | `git commitall` |
| `git*`         | `git`, `gitk`, `git status`           |                 |
| `git * main`   | `git checkout main`, `git merge main` | `git main`      |
| `* --version`  | `node --version`, `bun --version`     |                 |
| `git commit:*` | Same as `git commit *` (deprecated)   |                 |

**Regex patterns** — wrap in `/` delimiters (like JavaScript), optionally with flags:

| Pattern                 | Matches                               | Equivalent glob |
| ----------------------- | ------------------------------------- | --------------- |
| `/^git commit(\s.*)?$/` | `git commit -m msg`, `git commit`     | `git commit *`  |
| `/^git/`                | `git`, `gitk`, `git status`           | `git*`          |
| `/^git\s.*main$/`       | `git checkout main`, `git merge main` | `git * main`    |
| `/\bgit\s+-C\b/`        | `git -C /tmp status`                  |                 |
| `/curl/i`               | `curl`, `CURL`, `Curl`                |                 |

**Explicit `type` field** — you can also set `"type": "glob"` or `"type": "regex"` to override auto-detection. This is useful when the pattern key itself would be ambiguous (e.g., a regex without `/` delimiters or a glob path containing `/`):

```json
{
  "preBash": {
    "forbiddenPatterns": {
      "\\bgit\\s*push\\b": {
        "type": "regex",
        "reason": "Direct push is not allowed",
        "suggestion": "Use a pull request instead"
      },
      "/usr/local/*": {
        "type": "glob",
        "reason": "Do not modify /usr/local",
        "suggestion": "Use a different path"
      }
    }
  }
}
```

#### Shell operator awareness

Commands are split on shell operators (`&&`, `||`, `;`, `|`) and each sub-command is checked independently. This means a pattern like `safe-cmd malicious-cmd` will not match `safe-cmd && malicious-cmd`.

#### Multiple pattern matching

When a command matches multiple forbidden patterns, all matching patterns are reported at once. This allows Claude to see every violated rule in a single response and adjust accordingly, rather than hitting them one at a time on retries.

#### Config merging

Because `forbiddenPatterns` is an object, patterns from parent and child directories are deep merged. Child directories can:

- **Add** new patterns alongside inherited ones
- **Override** an inherited pattern's reason/suggestion
- **Disable** an inherited pattern:

```json
{
  "preBash": {
    "forbiddenPatterns": {
      "git push --force *": { "disabled": true }
    }
  }
}
```

### `notification` — OS-Native Notifications

A `Notification` hook that sends native OS notifications. Currently supports WSL (Windows) with sound and balloon notifications via PowerShell.

#### Setup

Add to your `settings.json`:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "npx @nownabe/claude-hooks notification"
          }
        ]
      }
    ]
  }
}
```

#### Configuration

Add a `notification` section to your `.claude/nownabe-claude-hooks.json`:

```json
{
  "notification": {
    "sounds": {
      "permission_prompt": "C:\\Windows\\Media\\Windows Notify System Generic.wav",
      "*": "C:\\Windows\\Media\\tada.wav"
    }
  }
}
```

- `permission_prompt` — Sound for permission prompts
- `*` — Default sound for all other notification types (e.g., `stop`, task completion)

Sound keys from child directories override parent keys (object merge).

#### Supported Platforms

| Platform      | Status                                                        |
| ------------- | ------------------------------------------------------------- |
| WSL (Windows) | Supported — plays sound + balloon notification via PowerShell |
| macOS         | Not yet implemented                                           |
| Linux         | Not yet implemented                                           |
