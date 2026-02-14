# claude-marketplace

A Claude Code plugin marketplace by nownabe.

## Installation

Add this marketplace:

```
/plugin marketplace add nownabe/claude-marketplace
```

Browse and install plugins:

```
/plugin
```

## Adding a Plugin

1. Create a plugin directory under `plugins/`:

```
plugins/my-plugin/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── my-skill/
        └── SKILL.md
```

2. Add an entry to `.claude-plugin/marketplace.json`:

```json
{
  "name": "my-plugin",
  "source": "./plugins/my-plugin",
  "description": "Description of the plugin"
}
```

## License

Apache-2.0
