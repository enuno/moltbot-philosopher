#!/usr/bin/env python3
"""
load_identity.py — Persona identity loader for NoesisLab OpenClaw Workers

Reads SOUL.md + IDENTITY.md from workspace/{persona}/ and returns structured
persona context for injection into Worker system prompts.

Usage:
    from tools.load_identity import load_identity
    persona = load_identity("classical")
    system_prompt = persona["system_prompt"]
"""

import os
import re
import yaml
from pathlib import Path
from typing import Dict, Any, Optional

# Project root relative to this file
PROJECT_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = PROJECT_ROOT / "workspace"
SUB_AGENTS_DIR = PROJECT_ROOT / "sub-agents"

REQUIRED_SOUL_FIELDS = [
    "name",
    "tradition",
    "council_role",
    "boundaries",
    "communication_style",
]

REQUIRED_IDENTITY_FIELDS = [
    "name",
    "tradition",
    "council_role",
    "strengths",
    "blind_spots",
]


def _read_markdown_section(content: str, section_title: str) -> Optional[str]:
    """Extract a section by its markdown header (case-insensitive)."""
    pattern = rf"##\s*{re.escape(section_title)}\s*\n(.*?)(?=\n##\s|\Z)"
    match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
    return match.group(1).strip() if match else None


def _parse_soul(content: str) -> Dict[str, Any]:
    """Parse SOUL.md into structured fields."""
    result: Dict[str, Any] = {}

    # Core truths / philosophical foundation
    core = _read_markdown_section(content, "Core Truths")
    result["philosophical_foundation"] = core or ""

    # Role in council
    role_match = re.search(
        r"Your role in the Council.*?[:\-]\s*(.+?)(?=\n\n|\n##|\Z)",
        content,
        re.IGNORECASE | re.DOTALL,
    )
    result["council_role"] = role_match.group(1).strip() if role_match else ""

    # Communication style
    comm = _read_markdown_section(content, "Communication Style")
    result["communication_style"] = comm or ""

    # Boundaries
    bnd = _read_markdown_section(content, "Boundaries")
    result["boundaries"] = bnd or ""

    # Name from first heading
    name_match = re.search(r"#\s*SOUL\.md\s*[-–]\s*(.+)", content, re.IGNORECASE)
    result["name"] = name_match.group(1).strip() if name_match else ""

    # Tradition from first line after heading
    trad_match = re.search(
        r"\*You are the .+?, embodying the (.+?) through.*", content
    )
    result["tradition"] = trad_match.group(1).strip() if trad_match else ""

    # Ethical priorities
    priorities = re.findall(r"^\d+\.\s+\*\*(.+?)\*\*\s*[-–]\s*(.+)$", content, re.MULTILINE)
    result["ethical_priorities"] = [
        {"principle": p[0].strip(), "description": p[1].strip()} for p in priorities
    ]

    # Examples
    good_example = re.search(
        r"\*\*Good example\*\*:\s*(.+?)(?=\*\*Bad example|\Z)", content, re.DOTALL
    )
    bad_example = re.search(
        r"\*\*Bad example.*?\*\*:\s*(.+?)(?=\*\*|$)", content, re.DOTALL
    )
    result["examples"] = {
        "good": good_example.group(1).strip() if good_example else "",
        "bad": bad_example.group(1).strip() if bad_example else "",
    }

    return result


def _parse_identity(content: str) -> Dict[str, Any]:
    """Parse IDENTITY.md into structured fields."""
    result: Dict[str, Any] = {}

    # Basic info fields
    for field in ["name", "tradition", "emoji", "avatar"]:
        match = re.search(rf"\*\*{field.capitalize()}\*\*:\s*(.+)", content, re.IGNORECASE)
        result[field] = match.group(1).strip() if match else ""

    # Council role
    role_match = re.search(r"\*\*Council Role\*\*:\s*(.+)", content, re.IGNORECASE)
    result["council_role"] = role_match.group(1).strip() if role_match else ""

    # Strengths / blind spots
    strengths = _read_markdown_section(content, "Strengths")
    result["strengths"] = strengths or ""

    blind = _read_markdown_section(content, "Blind spots")
    result["blind_spots"] = blind or ""

    # Personality snapshot
    snap = _read_markdown_section(content, "Personality Snapshot")
    result["personality_snapshot"] = snap or ""

    # Context / tradition background
    ctx = _read_markdown_section(content, "Context")
    result["context"] = ctx or ""

    return result


def load_identity(persona: str, validate: bool = True) -> Dict[str, Any]:
    """
    Load a philosopher persona from workspace/{persona}/.

    Args:
        persona: Directory name under workspace/ (e.g., "classical", "existentialist")
        validate: If True, raise ValueError if required fields are missing

    Returns:
        Dict with keys: name, tradition, council_role, soul, identity,
        system_prompt, validation_errors
    """
    persona_dir = WORKSPACE_DIR / persona
    soul_path = persona_dir / "SOUL.md"
    identity_path = persona_dir / "IDENTITY.md"
    agents_path = persona_dir / "AGENTS.md"

    errors: list[str] = []

    if not soul_path.exists():
        errors.append(f"SOUL.md not found: {soul_path}")
        soul_raw = ""
    else:
        soul_raw = soul_path.read_text(encoding="utf-8")

    if not identity_path.exists():
        errors.append(f"IDENTITY.md not found: {identity_path}")
        identity_raw = ""
    else:
        identity_raw = identity_path.read_text(encoding="utf-8")

    # Parse structured content
    soul_data = _parse_soul(soul_raw) if soul_raw else {}
    identity_data = _parse_identity(identity_raw) if identity_raw else {}

    # Merge name/tradition/role (IDENTITY.md is canonical for basic info)
    name = identity_data.get("name") or soul_data.get("name", "")
    tradition = identity_data.get("tradition") or soul_data.get("tradition", "")
    council_role = identity_data.get("council_role") or soul_data.get("council_role", "")

    # Validate required fields
    if validate:
        if not name:
            errors.append("Missing required field: name")
        if not tradition:
            errors.append("Missing required field: tradition")
        if not council_role:
            errors.append("Missing required field: council_role")
        if not soul_data.get("communication_style"):
            errors.append("Missing required field: communication_style (from SOUL.md)")
        if not soul_data.get("boundaries"):
            errors.append("Missing required field: boundaries (from SOUL.md)")
        if not identity_data.get("strengths"):
            errors.append("Missing required field: strengths (from IDENTITY.md)")
        if not identity_data.get("blind_spots"):
            errors.append("Missing required field: blind_spots (from IDENTITY.md)")

    # Build system prompt
    system_prompt = _build_system_prompt(name, tradition, council_role, soul_data, identity_data)

    result = {
        "persona": persona,
        "name": name,
        "tradition": tradition,
        "council_role": council_role,
        "emoji": identity_data.get("emoji", ""),
        "soul": soul_data,
        "identity": identity_data,
        "system_prompt": system_prompt,
        "validation_errors": errors,
        "source_files": {
            "soul": str(soul_path.relative_to(PROJECT_ROOT)),
            "identity": str(identity_path.relative_to(PROJECT_ROOT)),
            "agents": str(agents_path.relative_to(PROJECT_ROOT)) if agents_path.exists() else None,
        },
    }

    if validate and errors:
        raise ValueError(
            f"Identity validation failed for '{persona}': " + "; ".join(errors)
        )

    return result


def _build_system_prompt(
    name: str,
    tradition: str,
    council_role: str,
    soul: Dict[str, Any],
    identity: Dict[str, Any],
) -> str:
    """Compose a system prompt from parsed identity components."""
    lines = [
        f"# {name}",
        f"*You are the {name}, embodying the {tradition} tradition.*",
        "",
        f"## Council Role: {council_role}",
        "",
        "## Core Truths",
        soul.get("philosophical_foundation", ""),
        "",
        "## Communication Style",
        soul.get("communication_style", ""),
        "",
        "## Boundaries",
        soul.get("boundaries", ""),
        "",
        "## Strengths",
        identity.get("strengths", ""),
        "",
        "## Blind Spots",
        identity.get("blind_spots", ""),
        "",
        "## Ethical Priorities",
    ]
    for prio in soul.get("ethical_priorities", []):
        lines.append(f"- **{prio['principle']}**: {prio['description']}")

    lines.extend([
        "",
        "## Examples",
        f"**Good**: {soul.get('examples', {}).get('good', '')}",
        f"**Bad**: {soul.get('examples', {}).get('bad', '')}",
    ])

    return "\n".join(lines)


def load_all_personas() -> Dict[str, Dict[str, Any]]:
    """Load all philosopher personas found in workspace/."""
    result: Dict[str, Dict[str, Any]] = {}
    for entry in sorted(WORKSPACE_DIR.iterdir()):
        if entry.is_dir() and (entry / "SOUL.md").exists():
            persona_name = entry.name
            try:
                result[persona_name] = load_identity(persona_name)
            except ValueError as e:
                result[persona_name] = {"persona": persona_name, "validation_errors": [str(e)]}
    return result


def load_from_agent_yaml(agent_yaml_path: str) -> Dict[str, Any]:
    """Load identity using paths specified in a sub-agent agent.yaml."""
    path = Path(agent_yaml_path)
    if not path.exists():
        raise FileNotFoundError(f"agent.yaml not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    identity_files = config.get("identity_files", {})
    soul_rel = identity_files.get("soul", "")
    identity_rel = identity_files.get("identity", "")

    # Derive persona name from directory
    persona = path.parent.name.replace("philosopher-", "")

    # Map kebab-case to workspace directory names
    persona_dir_map = {
        "joycestream": "joyce",
        "beatgeneration": "beat",
        "cyberpunkposthumanist": "cyberpunk-posthumanist",
        "satiristabsurdist": "satirist-absurdist",
        "scientistempiricist": "scientist-empiricist",
        "easternbridge": "eastern-bridge",
        "islamicmystic": "islamic-mystic",
        "philosopherpoet": "philosopher-poet",
    }
    workspace_persona = persona_dir_map.get(persona, persona)

    return load_identity(workspace_persona)


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) < 2:
        print("Usage: python load_identity.py <persona> [--all]", file=sys.stderr)
        sys.exit(1)

    if sys.argv[1] == "--all":
        all_personas = load_all_personas()
        # Strip system_prompt for brevity in JSON output
        for p in all_personas.values():
            if "system_prompt" in p:
                p["system_prompt"] = p["system_prompt"][:200] + "... [truncated]"
        print(json.dumps(all_personas, indent=2, default=str))
    else:
        persona = sys.argv[1]
        try:
            data = load_identity(persona)
            output = {
                "persona": data["persona"],
                "name": data["name"],
                "tradition": data["tradition"],
                "council_role": data["council_role"],
                "emoji": data["emoji"],
                "validation_errors": data["validation_errors"],
                "source_files": data["source_files"],
            }
            print(json.dumps(output, indent=2))
        except ValueError as e:
            print(json.dumps({"error": str(e)}), file=sys.stderr)
            sys.exit(1)
