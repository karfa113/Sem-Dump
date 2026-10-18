#!/usr/bin/env python3
"""
Rebuilds manifest.json from whatever is inside the notes/ folder.

  python3 update.py           rebuild the file list
  python3 update.py --serve   rebuild, then preview at http://localhost:8000

Folders Sem1..Sem8 are always created, so they show up even when empty.
Names starting with "." (like .gitkeep or .DS_Store) are ignored.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
NOTES = ROOT / "notes"
SEMESTERS = [f"Semester {i}" for i in range(1, 9)]


def natural(name: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def scan(folder: Path) -> list:
    entries = [p for p in folder.iterdir() if not p.name.startswith(".")]
    entries.sort(key=lambda p: (p.is_file(), natural(p.name)))  # folders first
    out = []
    for p in entries:
        if p.is_dir():
            out.append({"name": p.name, "type": "folder", "children": scan(p)})
        else:
            st = p.stat()
            out.append({
                "name": p.name,
                "type": "file",
                "ext": p.suffix.lstrip(".").lower(),
                "size": st.st_size,
                "mtime": int(st.st_mtime),
                "path": p.relative_to(ROOT).as_posix(),
            })
    return out


def main():
    NOTES.mkdir(exist_ok=True)
    for s in SEMESTERS:
        (NOTES / s).mkdir(exist_ok=True)

    tree = {"name": "Notes", "type": "folder", "children": scan(NOTES)}
    (ROOT / "manifest.json").write_text(json.dumps(tree, indent=1, ensure_ascii=False), encoding="utf-8")

    def count(n):
        return sum(count(c) if c["type"] == "folder" else 1 for c in n.get("children", []))
    print(f"manifest.json updated: {count(tree)} files")

    if "--serve" in sys.argv:
        import http.server
        import os
        import socketserver
        os.chdir(ROOT)
        with socketserver.TCPServer(("", 8000), http.server.SimpleHTTPRequestHandler) as srv:
            print("Open http://localhost:8000  (Ctrl+C to stop)")
            try:
                srv.serve_forever()
            except KeyboardInterrupt:
                pass


if __name__ == "__main__":
    main()
