#!/bin/bash

# Setup pre-commit hooks for local development
# This script installs pre-commit hooks that run linting checks before commits

set -e

echo "🔧 Setting up pre-commit hooks..."

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo "Installing pre-commit..."
    pip install pre-commit
fi

# Install the git hooks
pre-commit install

echo "✅ Pre-commit hooks installed successfully!"
echo ""
echo "Available checks:"
echo "  - Markdown linting (markdownlint with MD013,MD024,MD025,MD029,MD033,MD036,MD040,MD041,MD056,MD060 disabled)"
echo "  - Python linting (Ruff: E, W, F, I codes)"
echo "  - Python formatting (Ruff format)"
echo "  - Bash linting (ShellCheck)"
echo "  - YAML validation (yamllint with .yamllint.yaml config)"
echo "  - JSON syntax validation"
echo "  - Whitespace/line ending fixes"
echo "  - Merge conflict detection"
echo "  - Private key detection"
echo ""
echo "To run checks manually:"
echo "  pre-commit run --all-files    # Run all hooks on all files"
echo "  pre-commit run -v             # Verbose output"
echo "  pre-commit run markdownlint   # Run only markdown linting"
echo "  pre-commit run shellcheck     # Run only bash linting"
echo ""
echo "To bypass hooks for emergency commits:"
echo "  git commit --no-verify"
echo ""
