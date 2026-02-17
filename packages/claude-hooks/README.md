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
    "forbiddenPatterns": [
      {
        "pattern": "\\bgit\\s+-C\\b",
        "reason": "git -C is not allowed",
        "suggestion": "Run git commands from the working directory directly"
      }
    ]
  },
  "notification": {
    "sounds": {
      "permission_prompt": "C:\\Windows\\Media\\Windows Notify System Generic.wav",
      "*": "C:\\Windows\\Media\\tada.wav"
    }
  }
}
```

Config files are loaded hierarchically from the current working directory up to `$HOME`. Files are deep merged — objects are recursively merged (child keys override parent keys), while arrays and primitives are replaced entirely by the child value.

File priority (highest first, per directory from CWD to HOME):

1. `CWD/.claude/nownabe-claude-hooks.local.json`
2. `CWD/.claude/nownabe-claude-hooks.json`
3. `<parent>/.claude/nownabe-claude-hooks.local.json`
4. `<parent>/.claude/nownabe-claude-hooks.json`
5. ... up to `$HOME`

## Hooks

### `pre-bash` — Forbidden Command Patterns

A `PreToolUse` hook that blocks dangerous or unwanted Bash commands based on configurable regex patterns.

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

Add a `preBash` section to your `.claude/nownabe-claude-hooks.json`:

```json
{
  "preBash": {
    "forbiddenPatterns": [
      {
        "pattern": "\\bgit\\s+-C\\b",
        "reason": "git -C is not allowed",
        "suggestion": "Run git commands from the working directory directly"
      }
    ]
  }
}
```

When a child directory defines `forbiddenPatterns`, it replaces the parent's array entirely. To inherit everything, omit the `preBash` section.

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
