#!/usr/bin/env python3
"""
extract_launch_data.py
----------------------
Scan `_posts/` and `_drafts/` (relative to the repo root) for Markdown
files containing YAML front-matter and emit an array of LaunchData objects
in JSON.

Usage:
    python extract_launch_data.py            # → stdout
    python extract_launch_data.py -o data.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

import yaml

# ---------------------------------------------------------------------------
FRONT_MATTER_RE = re.compile(r"^---\s*$", re.MULTILINE)


def repo_root(script_path: Path) -> Path:
    """Repo root is the parent directory of `_tools`."""
    return script_path.resolve().parents[1]


def collect_markdown(root: Path) -> List[Path]:
    md_files: List[Path] = []
    for sub in ("_posts", "_drafts"):
        dir_path = root / sub
        if dir_path.is_dir():
            md_files.extend(dir_path.rglob("*.md"))
    return md_files


def parse_front_matter(text: str) -> Dict[str, Any]:
    matches = list(FRONT_MATTER_RE.finditer(text))
    if len(matches) < 2:
        return {}
    start, end = matches[0].end(), matches[1].start()
    try:
        return yaml.safe_load(text[start:end]) or {}
    except yaml.YAMLError:
        return {}


def to_launch_data(meta: Dict[str, Any]) -> Dict[str, Any]:
    """Strip empty/null values but keep all keys."""
    return {k: v for k, v in meta.items() if v not in (None, "")}


# ---------------------------------------------------------------------------
def main(argv: List[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Extract LaunchData from Markdown posts."
    )
    parser.add_argument(
        "-o", "--output", type=Path, help="Write JSON to a file instead of stdout"
    )
    args = parser.parse_args(argv)

    script_dir = Path(__file__).parent
    root = repo_root(script_dir)

    launches: List[Dict[str, Any]] = []
    for md_path in collect_markdown(root):
        content = md_path.read_text(encoding="utf-8", errors="ignore")
        meta = parse_front_matter(content)
        if meta:
            launches.append(to_launch_data(meta))

    out_json = json.dumps(launches, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(out_json, encoding="utf-8")
        print(f"✅  Wrote {len(launches)} entries → {args.output}")
    else:
        sys.stdout.write(out_json + "\n")


if __name__ == "__main__":
    main()