# Bitwarden Secrets Integration

Moltbot uses Bitwarden Secrets Manager for secure API key storage and distribution.

## Quick Start

### Prerequisites

- `bws` CLI installed: `brew install bitwarden-cli` or [download](https://github.com/bitwarden/sdk/releases)
- Access to Bitwarden organization `93331de5-fa6e-44ab-8aee-b3840034e681`
- Service account token configured in `~/.zshrc` or environment

### Export Secrets to .env

```bash
# Source your BWS access token
source ~/.zshrc

# Export secrets from Bitwarden to .env
bws secret list -o env 7173d0ef-7c7d-4356-b98f-b3d20010b2e7 > .env

# Or use the helper script
./scripts/export-secrets.sh
```

### Required Secrets

| Secret | Purpose | Location in BWS |
|--------|---------|-----------------|
| `MOLTBOOK_API_KEY` | Moltbook API access | Project: dotfiles |
| `VENICE_API_KEY` | Venice AI inference | Project: dotfiles |
| `KIMI_API_KEY` | Kimi/Moonshot AI | Project: dotfiles |
| `NTFY_API` | NTFY notifications | Project: dotfiles |

## Managing Secrets

### View Secrets

```bash
# List all secrets in the project
bws secret list 7173d0ef-7c7d-4356-b98f-b3d20010b2e7

# Get specific secret
bws secret get <SECRET_ID>
```

### Update a Secret

```bash
# Edit existing secret
bws secret edit <SECRET_ID> --value "new-value"
```

### Create New Secret

```bash
bws secret create KEY_NAME "value" 7173d0ef-7c7d-4356-b98f-b3d20010b2e7 --note "Description"
```

## Project Configuration

- **Organization ID:** `93331de5-fa6e-44ab-8aee-b3840034e681`
- **Project ID:** `7173d0ef-7c7d-4356-b98f-b3d20010b2e7`
- **Project Name:** `dotfiles`

## Security Best Practices

1. **Never commit `.env`** - Already in `.gitignore`
2. **Rotate keys regularly** - Update in Bitwarden, re-export to `.env`
3. **Use service accounts** - Limited scope tokens for CI/CD
4. **Audit access** - Review Bitwarden audit logs periodically

## Troubleshooting

### "Unauthorized" Error

```bash
# Verify token is set
echo $BWS_ACCESS_TOKEN

# Re-source your shell config
source ~/.zshrc
```

### Secret Not Found

Ensure you're using the correct project ID:
```bash
bws project list
```

### Export Format Issues

The `env` format outputs:
```
KEY=value
KEY2=value2
```

Pipe to `.env` file:
```bash
bws secret list -o env 7173d0ef-7c7d-4356-b98f-b3d20010b2e7 > .env
```
