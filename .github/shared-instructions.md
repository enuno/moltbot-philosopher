# Shared Workflow Instructions

## Repository Context

This is the **Moltbot Philosopher** repository, a multi-agent philosophical AI
system for Moltbook.

**Key Components**:
- 9 philosopher personas (Classical, Existentialist, Transcendentalist, etc.)
- Ethics-convergence governance (4/6 consensus model)
- Living Noosphere (3-layer epistemological memory)
- Thread Continuation Engine
- Docker-based architecture

**Main Files**:
- `README.md` - User guide and feature documentation
- `AGENTS.md` - Complete architecture documentation
- `docker-compose.yml` - Service orchestration
- `/scripts/` - 32+ operational bash scripts
- `/services/` - Core service implementations

## General Guidelines

### Git Operations
- Use conventional commits (feat:, fix:, docs:, chore:)
- Check status before committing
- Always add descriptive commit messages

### Code Style
- Follow existing patterns in the codebase
- Max 100 characters per line for code
- Document complex logic with comments

### Documentation
- Load `.github/instructions/documentation.instructions.md` before editing docs
- Follow Diátaxis framework
- Keep lines under 80 characters
- Use proper markdown syntax

### Testing
- Validate changes before committing
- Check Docker health after service changes
- Ensure permissions are correct (UID 1001:1001)

### Security
- Never commit secrets or API keys
- Use `.env.example` for reference
- Flag potential security issues

## Repository-Specific Notes

### File Permissions
- Workspace files: `1001:1001` (container user)
- Scripts: Executable (`chmod +x`)
- State files: Atomic updates with temp files

### Docker Services
- All services must pass health checks
- Use `docker compose` (not `docker-compose`)
- Check logs: `docker logs <service>`

### Memory System (Noosphere)
- Layer 1: Daily notes
- Layer 2: Consolidated heuristics
- Layer 3: Constitutional archive
- Always use Python scripts for memory operations

## Common Tasks

### Updating Documentation
1. Read `.github/instructions/documentation.instructions.md`
2. Identify documentation type (tutorial/how-to/reference/explanation)
3. Make minimal, surgical changes
4. Validate formatting and links

### Modifying Services
1. Update source code
2. Rebuild: `docker compose build <service>`
3. Restart: `docker compose up -d`
4. Check health: `docker compose ps`

### Adding Scripts
1. Create in `/scripts/`
2. Make executable: `chmod +x`
3. Document in `README.md`
4. Test thoroughly

## Resources

- Project root: `/home/elvis/.moltbot` (symlink to actual location)
- Workspace: `/workspace/classical/` (persistent state)
- Logs: `/logs/` (service logs)
