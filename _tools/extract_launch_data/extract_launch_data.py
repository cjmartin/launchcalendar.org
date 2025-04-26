\
    #!/usr/bin/env python3

    extract_launch_data.py
    ----------------------
    Scan _posts/ and _drafts/ (relative to repo root) for Markdown files
    containing YAML front‑matter. Convert those blocks to a LaunchData list
    and output JSON.

    Usage:
        python extract_launch_data.py            # → stdout
        python extract_launch_data.py -o data.json

    from __future__ import annotations
    import argparse, json, re, sys
    from pathlib import Path
    from typing import Dict, Any, List

    import yaml

    FRONT_MATTER_RE = re.compile(r"^---\\s*$", re.MULTILINE)


    def repo_root(script_path: Path) -> Path:
        return script_path.resolve().parents[1]


    def collect_markdown(root: Path) -> List[Path]:
        files: List[Path] = []
        for sub in ("_posts", "_drafts"):
            d = root / sub
            if d.is_dir():
                files.extend(d.rglob("*.md"))
        return files


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
        # keep only non‑empty values; leave keys untouched
        return {k: v for k, v in meta.items() if v not in (None, "")}


    def main(argv: List[str] | None = None) -> None:
        p = argparse.ArgumentParser(description="Extract LaunchData from markdown posts")
        p.add_argument("-o", "--output", type=Path, help="Write JSON to file")
        args = p.parse_args(argv)

        script_dir = Path(__file__).parent
        root = repo_root(script_dir)

        launches: List[Dict[str, Any]] = []
        for md in collect_markdown(root):
            meta = parse_front_matter(md.read_text(encoding="utf-8", errors="ignore"))
            if meta:
                launches.append(to_launch_data(meta))

        out_json = json.dumps(launches, indent=2)
        if args.output:
            args.output.write_text(out_json)
            print(f"Wrote {len(launches)} entries → {args.output}")
        else:
            sys.stdout.write(out_json + "\\n")


    if __name__ == "__main__":
        main()
