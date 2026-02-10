# Documentation Guidelines

## Framework: Diátaxis

Our documentation follows the **Diátaxis framework** which organizes content into
four distinct categories:

### 1. Tutorials (Learning-Oriented)
- Guide beginners through achieving specific outcomes
- Step-by-step walkthroughs
- Teach by doing
- Example: "Getting Started with Moltbot"

### 2. How-to Guides (Goal-Oriented)
- Solve specific real-world problems
- Assume basic knowledge
- Focus on practical solutions
- Example: "How to Deploy a Custom Agent"

### 3. Reference (Information-Oriented)
- Provide accurate technical descriptions
- API documentation, configuration options
- Dry and factual
- Example: "Configuration Reference", "API Documentation"

### 4. Explanation (Understanding-Oriented)
- Clarify and illuminate topics
- Discuss design decisions
- Provide context and background
- Example: "Ethics-Convergence Governance Model"

## Tone and Voice

- **Neutral and Technical**: Use clear, professional language
- **Not Promotional**: Focus on facts, not marketing
- **Helpful**: Provide context and examples where appropriate
- **Concise**: Be direct and avoid unnecessary verbosity

## Formatting Standards

### Headings
- Use markdown heading syntax (`#`, `##`, `###`)
- Never use bold text as a substitute for headings
- Always include blank lines before and after headings

### Code Blocks
- Always specify language for syntax highlighting
- Use `bash` for shell commands
- Use `json` for JSON examples
- Use `yaml` for YAML configuration
- Use `aw` for agentic workflow syntax

Example:
```bash
docker compose up -d
```

### Lists
- Always include blank lines before and after lists
- Use consistent bullet formatting
- Prefer numbered lists for sequential steps

### Line Length
- Keep lines under 80 characters for documentation
- Wrap long lines appropriately

### Links
- Use full URLs or relative paths
- No undefined references
- Ensure all links are valid

## File Organization

### Core Documentation (Root)
- `README.md` - Main project overview and quick start
- `AGENTS.md` - Architecture and agent details
- `SECURITY.md` - Security policies

### Feature Documentation (`docs/`)
- Feature guides and detailed documentation
- Organized by topic

### Development Documentation (`docs/dev-archive/`)
- Internal development notes
- Architecture decisions
- Analysis reports

## When Updating Documentation

1. **Identify the Type**: Determine if the content is tutorial, how-to, reference, or explanation
2. **Check Existing Structure**: Ensure consistency with existing documentation
3. **Follow Standards**: Apply all formatting and style guidelines
4. **Validate Links**: Ensure all references are correct
5. **Test Examples**: Verify code samples are accurate

## Quality Checklist

Before finalizing documentation updates:

- [ ] Headings use proper markdown syntax (not bold)
- [ ] Blank lines before/after headings, lists, and code blocks
- [ ] Code blocks have language tags
- [ ] Lines are under 80 characters (where practical)
- [ ] Tone is neutral and technical
- [ ] No promotional language
- [ ] Links are valid
- [ ] Examples are accurate
