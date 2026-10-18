/* Sem Dump — Finder-style file browser.
   Reads manifest.json (built by update.py) and renders it. The URL hash is the
   source of truth, so every folder and file has a shareable link:
   index.html#/Sem3/Physics/lecture1.pdf */

const $ = (s) => document.querySelector(s);
const FOLDER = '<svg class="folder"><use href="#i-folder"/></svg>';
const MINI_FOLDER = '<svg class="mini"><use href="#i-folder"/></svg>';

let root = null;
let view = localStorage.getItem('notes-view') || 'grid';
let query = '';
let selected = null;

/* ───────── helpers ───────── */
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const kind = (ext) =>
  ext === 'link' ? 'link'
  : ext === 'pdf' ? 'pdf'
  : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(ext) ? 'img'
  : ['txt', 'md', 'csv', 'log'].includes(ext) ? 'txt'
  : 'other';
const fmtSize = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
const fmtDate = (t) => t ? new Date(t * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function segsFromHash() {
  const h = location.hash.replace(/^#\/?/, '');
  return h ? h.split('/').map(decodeURIComponent) : [];
}
const go = (segs) => { location.hash = '/' + segs.map(encodeURIComponent).join('/'); };

function resolve(segs) {
  let node = root;
  const trail = [];
  for (const s of segs) {
    const next = (node.children || []).find((c) => c.name === s);
    if (!next) return null;
    node = next; trail.push(next);
  }
  return { node, trail };
}

function allFiles(node, out = []) {
  for (const c of node.children || []) c.type === 'folder' ? allFiles(c, out) : out.push(c);
  return out;
}

/* ───────── rendering ───────── */
function render() {
  if (!root) return;
  let segs = segsFromHash();
  let hit = resolve(segs);
  if (!hit) { go([]); return; }
  if (hit.node.type === 'link') { go(segs.slice(0, -1)); return; }

  let folderSegs = segs, file = null;
  if (hit.node.type === 'file') { file = hit.node; folderSegs = segs.slice(0, -1); }
  const folder = resolve(folderSegs).node;

  renderSide(folderSegs);
  renderCrumbs(folderSegs);
  $('#title').textContent = folderSegs.length ? folderSegs[folderSegs.length - 1] : 'Sem Dump';
  document.title = (file ? file.name + ' — ' : folderSegs.length ? folderSegs[folderSegs.length - 1] + ' — ' : '') + 'Sem Dump';

  renderItems(folder, folderSegs);
  renderPreview(file, folder);

  $('#btnBack').disabled = folderSegs.length === 0 && !file;
  $('#vGrid').classList.toggle('on', view === 'grid');
  $('#vList').classList.toggle('on', view === 'list');
}

function renderSide(folderSegs) {
  const home = '<button class="side-item ' + (folderSegs.length === 0 ? 'active' : '') + '" data-go="">' + MINI_FOLDER + 'All Notes</button>';
  const sems = root.children.filter((c) => c.type === 'folder').map((c) =>
    '<button class="side-item ' + (folderSegs[0] === c.name ? 'active' : '') + '" data-go="' + esc(c.name) + '">' + MINI_FOLDER + esc(c.name) + '</button>'
  ).join('');
  $('#side').innerHTML = home + sems;
}

function renderCrumbs(folderSegs) {
  const parts = ['<button data-crumb="0">Sem Dump</button>'];
  folderSegs.forEach((s, i) => parts.push('<span class="sep">›</span><button data-crumb="' + (i + 1) + '">' + esc(s) + '</button>'));
  $('#crumbs').innerHTML = parts.join('');
}

function itemsFor(folder, folderSegs) {
  if (query) {
    const q = query.toLowerCase();
    const out = [];
    (function walk(n, p) {
      for (const c of n.children || []) {
        const cp = [...p, c.name];
        if (c.name.toLowerCase().includes(q)) out.push({ ...c, _segs: cp, _where: p.join(' / ') });
        if (c.type === 'folder') walk(c, cp);
      }
    })(root, []);
    return out;
  }
  return (folder.children || []).map((c) => ({ ...c, _segs: [...folderSegs, c.name] }));
}

function iconFor(it) {
  if (it.type === 'folder') return FOLDER;
  const k = kind(it.ext);
  if (k === 'img') return '<img class="thumb" loading="lazy" src="' + enc(it.path) + '" alt="">';
  return '<div class="doc ' + k + '"><div class="tag">' + esc((it.ext || 'file').slice(0, 4).toUpperCase()) + '</div></div>';
}
function miniFor(it) {
  return it.type === 'folder' ? MINI_FOLDER : '<span class="mini-doc ' + kind(it.ext) + '"></span>';
}

function renderItems(folder, folderSegs) {
  const items = itemsFor(folder, folderSegs);
  const body = $('#body');

  if (!items.length) {
    body.innerHTML = '<div class="empty"><div>' + (query
      ? '<b>No results</b>Nothing matches “' + esc(query) + '”.'
      : '<b>This folder is empty</b>Drop files into it, then run update.py.') + '</div></div>';
    $('#status').textContent = '0 items';
    return;
  }

  if (view === 'grid') {
    body.innerHTML = '<div class="grid">' + items.map((it, i) =>
      '<button class="item" style="animation-delay:' + Math.min(i * 18, 300) + 'ms" data-i="' + i + '" title="' + esc(it.type === 'link' ? it.url : (it._where ? it._where + ' / ' + it.name : it.name)) + '">' +
        '<div class="ico">' + iconFor(it) + '</div>' +
        '<div class="name">' + esc(it.name) + '</div>' +
        (query && it._where ? '<div class="sub">' + esc(it._where) + '</div>' : '') +
      '</button>').join('') + '</div>';
  } else {
    body.innerHTML = '<div class="list"><div class="head"><span>Name</span><span>Size</span><span>Date Modified</span></div>' + items.map((it, i) =>
      '<div class="row" style="animation-delay:' + Math.min(i * 12, 240) + 'ms" data-i="' + i + '">' +
        '<div class="nm">' + miniFor(it) + '<span>' + esc(it.name) + '</span></div>' +
        '<span class="dim">' + (it.type === 'folder' ? '—' : it.type === 'link' ? 'Link' : fmtSize(it.size || 0)) + '</span>' +
        '<span class="dim">' + fmtDate(it.mtime) + '</span>' +
      '</div>').join('') + '</div>';
  }

  body._items = items;
  const folders = items.filter((i) => i.type === 'folder').length;
  const files = items.length - folders;
  $('#status').textContent = items.length + (items.length === 1 ? ' item' : ' items') + (folders && files ? ' · ' + folders + ' folders, ' + files + ' files' : '');
}

/* ───────── preview ───────── */
async function renderPreview(file, folder) {
  const pv = $('#preview');
  if (!file) { pv.hidden = true; $('#pvStage').innerHTML = ''; return; }

  pv.hidden = false;
  $('#pvName').textContent = file.name;
  const url = enc(file.path);
  const dl = $('#pvDl');
  dl.href = url; dl.setAttribute('download', file.name);

  const siblings = (folder.children || []).filter((c) => c.type === 'file');
  const idx = siblings.findIndex((c) => c.path === file.path);
  pv._prev = siblings[idx - 1]; pv._next = siblings[idx + 1];
  $('#pvPrev').disabled = !pv._prev;
  $('#pvNext').disabled = !pv._next;

  const stage = $('#pvStage');
  const k = kind(file.ext);
  if (k === 'pdf') {
    stage.innerHTML = '<iframe title="' + esc(file.name) + '" src="' + url + '#view=FitH"></iframe>';
  } else if (k === 'img') {
    stage.innerHTML = '<img src="' + url + '" alt="' + esc(file.name) + '">';
  } else if (k === 'txt') {
    stage.innerHTML = '<pre>Loading…</pre>';
    try {
      const r = await fetch(url);
      const t = await r.text();
      if (!$('#preview').hidden && $('#pvName').textContent === file.name) stage.innerHTML = '<pre>' + esc(t) + '</pre>';
    } catch { stage.innerHTML = '<div class="nofile">Could not load this file.</div>'; }
  } else {
    stage.innerHTML = '<div class="nofile"><div class="doc"><div class="tag">' + esc((file.ext || 'file').toUpperCase().slice(0, 4)) + '</div></div>No preview available for this file type.<br>Use Download to open it.</div>';
  }
}

/* ───────── events ───────── */
const isTouch = matchMedia('(pointer: coarse)').matches;

function openItem(it) {
  if (it.type === 'link') {
    if (/^https?:\/\//i.test(it.url)) window.open(it.url, '_blank', 'noopener,noreferrer');
    return;
  }
  go(it._segs);
}

$('#body').addEventListener('click', (e) => {
  const el = e.target.closest('[data-i]');
  if (!el) { selected = null; document.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel')); return; }
  const it = $('#body')._items[+el.dataset.i];
  document.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel'));
  el.classList.add('sel'); selected = it;
  if (isTouch) openItem(it);
});
$('#body').addEventListener('dblclick', (e) => {
  const el = e.target.closest('[data-i]');
  if (el) openItem($('#body')._items[+el.dataset.i]);
});

$('#side').addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  $('#q').value = ''; query = '';
  go(b.dataset.go ? [b.dataset.go] : []);
});
$('#crumbs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-crumb]');
  if (!b) return;
  query = ''; $('#q').value = '';
  const n = +b.dataset.crumb;
  const segs = segsFromHash();
  const hit = resolve(segs);
  const folderSegs = hit && hit.node.type === 'file' ? segs.slice(0, -1) : segs;
  go(folderSegs.slice(0, n));
});

$('#q').addEventListener('input', (e) => {
  query = e.target.value.trim();
  const segs = segsFromHash();
  const hit = resolve(segs);
  if (hit && hit.node.type === 'file') go(segs.slice(0, -1)); else render();
});

$('#btnBack').addEventListener('click', () => {
  const segs = segsFromHash();
  if (segs.length) go(segs.slice(0, -1));
});
$('#btnFwd').addEventListener('click', () => history.forward());
$('#vGrid').addEventListener('click', () => { view = 'grid'; localStorage.setItem('notes-view', view); render(); });
$('#vList').addEventListener('click', () => { view = 'list'; localStorage.setItem('notes-view', view); render(); });

$('#btnHome').addEventListener('click', () => { query = ''; $('#q').value = ''; go([]); });
$('#btnMax').addEventListener('click', () => $('#win').classList.toggle('max'));
$('#btnClose').addEventListener('click', closePreview);
$('#pvBack').addEventListener('click', closePreview);
$('#pvPrev').addEventListener('click', () => { const p = $('#preview')._prev; if (p) go(p.path.split('/').slice(1)); });
$('#pvNext').addEventListener('click', () => { const p = $('#preview')._next; if (p) go(p.path.split('/').slice(1)); });

function closePreview() {
  const segs = segsFromHash();
  const hit = resolve(segs);
  if (hit && hit.node.type === 'file') go(segs.slice(0, -1));
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
  const pv = $('#preview');
  if (e.key === 'Escape') { if (!$('#contrib').hidden) { closeContrib(); return; } closePreview(); }
  if (!pv.hidden && e.key === 'ArrowLeft' && pv._prev) go(pv._prev.path.split('/').slice(1));
  if (!pv.hidden && e.key === 'ArrowRight' && pv._next) go(pv._next.path.split('/').slice(1));
  if (e.key === 'Enter' && selected && pv.hidden) openItem(selected);
  if (e.key === '/' ) { e.preventDefault(); $('#q').focus(); }
});

window.addEventListener('hashchange', render);

/* ───────── contribute ───────── */
function currentFolderSegs() {
  const segs = segsFromHash();
  const hit = resolve(segs);
  return hit && hit.node.type === 'file' ? segs.slice(0, -1) : segs;
}
function openContrib() {
  const cfg = window.NOTES_CONFIG || {};
  const ok = cfg.githubUser && cfg.repo && !/^YOUR_/.test(cfg.githubUser + cfg.repo);
  const segs = currentFolderSegs();
  const repoUrl = 'https://github.com/' + cfg.githubUser + '/' + cfg.repo;
  $('#cPath').textContent = ['Notes', ...segs].join(' / ');
  $('#cWarn').hidden = !!ok;
  $('#cRepo').href = ok ? repoUrl : '#';
  $('#cUpload').href = ok
    ? repoUrl + '/upload/' + (cfg.branch || 'main') + '/notes' + segs.map((s) => '/' + encodeURIComponent(s)).join('')
    : '#';
  $('#contrib').hidden = false;
  $('#cUpload').focus();
}
function closeContrib() { $('#contrib').hidden = true; $('#btnContrib').focus(); }
$('#btnContrib').addEventListener('click', openContrib);
$('#cClose').addEventListener('click', closeContrib);
$('#contrib').addEventListener('click', (e) => { if (e.target.id === 'contrib') closeContrib(); });
['#cUpload', '#cRepo'].forEach((id) => $(id).addEventListener('click', (e) => { if ($(id).getAttribute('href') === '#') e.preventDefault(); }));

/* ───────── built-by bar ───────── */
(function renderCredit() {
  const p = window.NOTES_PROFILE;
  const box = $('#credit');
  if (!p || !p.name) return;
  const clean = (v) => String(v || '').trim().replace(/^@/, '');
  const url = (v, base) => /^https?:\/\//i.test(v) ? v : base + encodeURIComponent(v);
  const fill = (d) => '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + d + '"/></svg>';
  const line = (inner) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  const ICONS = {
    instagram: line('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>'),
    linkedin: fill('M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z'),
    github: fill('M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z'),
    email: line('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>')
  };
  const links = [
    p.instagram && ['Instagram', 'instagram', url(clean(p.instagram), 'https://instagram.com/')],
    p.linkedin && ['LinkedIn', 'linkedin', url(clean(p.linkedin), 'https://linkedin.com/in/')],
    p.github && ['GitHub', 'github', url(clean(p.github), 'https://github.com/')],
    p.email && ['Email', 'email', 'mailto:' + String(p.email).trim()]
  ].filter(Boolean);
  box.innerHTML = '<span>Built by <b>' + esc(p.name) + '</b></span>' + (links.length
    ? '<span class="sep"></span><span class="links">' + links.map((l) =>
        '<a href="' + esc(l[2]) + '" target="_blank" rel="noopener noreferrer" aria-label="' + l[0] + '" title="' + l[0] + '">' + ICONS[l[1]] + '</a>').join('') + '</span>'
    : '');
  box.hidden = false;
})();

/* ───────── boot ───────── */
(async function init() {
  try {
    const r = await fetch('manifest.json?v=' + Date.now());
    if (!r.ok) throw new Error(r.status);
    root = await r.json();
    render();
  } catch (err) {
    $('#body').innerHTML = '<div class="empty"><div><b>Couldn’t load notes</b>manifest.json is missing. Run <code>python3 update.py</code>,<br>and open the site through a web server (not by double-clicking the file).</div></div>';
  }
})();