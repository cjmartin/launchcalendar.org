# Launch Post Extraction Tool

Extract YAML front‑matter from your Jekyll launch posts (in **_posts** or **_drafts**) and
produce a single JSON array of `LaunchData` objects suitable for matcher testing.

## Directory layout

```
repo-root/
├── _posts/
├── _drafts/
└── _tools/
    └── extract_launch_data/
        ├── setup_env.sh
        ├── requirements.txt
        ├── extract_launch_data.py
        └── venv/  (auto‑generated)
```

## Quick start

```bash
# one‑time setup
_tools/extract_launch_data/setup_env.sh

# every new shell
source _tools/extract_launch_data/venv/bin/activate

# run extraction (stdout)
python _tools/extract_launch_data/extract_launch_data.py

# or write to file
python _tools/extract_launch_data/extract_launch_data.py -o launch-source.json
```
