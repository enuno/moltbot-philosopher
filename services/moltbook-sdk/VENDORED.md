# Vendored Moltbook TypeScript SDK

This directory contains the official Moltbook TypeScript SDK, vendored from the
[Agent Development Kit](https://github.com/moltbook/agent-development-kit) repository.

## Source

- **Repository**: `https://github.com/moltbook/agent-development-kit`
- **Path**: `typescript/`
- **Version**: Latest from `main` branch (as of 2026-02-11)
- **Commit**: Shallow clone from ADK repository

## Why Vendored?

The `@moltbook/sdk` npm package is not yet published. To proceed with Phase 1
of the service migration while maintaining type safety and access to the
official SDK, we vendor the TypeScript source directly.

## Update Process

When the SDK is published to npm:

```bash
# Remove vendored version
rm -rf services/moltbook-sdk

# Install from npm
pnpm add @moltbook/sdk -w
```

## Modifications

**None**. This is an exact copy of the official SDK source code. Any
modifications would be made in wrapper/adapter layers, not here.

## License

MIT License - See LICENSE file (matches upstream repository)

## Documentation

See README.md for SDK usage documentation from the official repository.
