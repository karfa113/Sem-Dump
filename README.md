# Sem Dump

A glassmorphic, macOS Finder-style site for your semester notes. Pure black page, orange theme, Space Grotesk.

## Adding notes

1. Drop files or folders into `notes/Sem1` … `notes/Sem8` (PDF, JPG, PNG, TXT, anything else works too, it just gets a download-only view).
2. Run `python3 update.py`.
3. Done. Push to GitHub if the site is hosted there.

**Even easier on GitHub:** upload files through the GitHub website (Add file → Upload files) into `notes/SemX/...`. The included workflow rebuilds `manifest.json` for you, so there is nothing to run.

## Preview locally

```
python3 update.py --serve
```

Then open http://localhost:8000. Opening `index.html` by double-click will not work because browsers block loading `manifest.json` from `file://`.

## Letting others contribute

The **Contribute** button opens GitHub's upload page for the folder the visitor is looking at. Visitors without write access are asked to fork the repo and open a pull request, so nothing goes live until you merge it (the workflow then rebuilds the index automatically).

Set it up once in `config.js`:

```js
window.NOTES_CONFIG = { githubUser: "your-username", repo: "your-repo", branch: "main" };
```

## Customising

- **Theme colour:** change `--accent` at the top of `style.css`.
- **Folder names:** `SEMESTERS` in `update.py`. Subfolders can be named anything and nested as deep as you like.

## Using it

- Double-click (or tap on a phone) to open a folder or file.
- Files open in a preview with a Download button; `←` `→` flip between files, `Esc` closes.
- `/` focuses search, which looks through every folder.
- Every folder and file has its own link, e.g. `index.html#/Sem3/Physics/lecture1.pdf`.

## Hosting (free)

GitHub Pages: push this folder to a repo → Settings → Pages → deploy from `main` / root.# Sem-Dump
