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

## Adding links

To put a link inside a folder (a YouTube playlist, a Google Drive folder, a website), create a small text file ending in `.url` and put the address inside it:

```
notes/Sem1/Maths/Lecture playlist.url   →   contains:  https://youtube.com/playlist?list=...
```

The file name becomes the label (without `.url`). Run `python3 update.py` and it appears as a link icon; clicking it opens the site in a new tab. On GitHub use *Add file → Create new file*, type the name with `.url` at the end, paste the address, and commit. Files ending in `.link` work the same way.

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

GitHub Pages: push this folder to a repo → Settings → Pages → deploy from `main` / root.