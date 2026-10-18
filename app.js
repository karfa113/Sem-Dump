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
  ext === 'pdf' ? 'pdf'
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
      '<button class="item" style="animation-delay:' + Math.min(i * 18, 300) + 'ms" data-i="' + i + '" title="' + esc(it._where ? it._where + ' / ' + it.name : it.name) + '">' +
        '<div class="ico">' + iconFor(it) + '</div>' +
        '<div class="name">' + esc(it.name) + '</div>' +
        (query && it._where ? '<div class="sub">' + esc(it._where) + '</div>' : '') +
      '</button>').join('') + '</div>';
  } else {
    body.innerHTML = '<div class="list"><div class="head"><span>Name</span><span>Size</span><span>Date Modified</span></div>' + items.map((it, i) =>
      '<div class="row" style="animation-delay:' + Math.min(i * 12, 240) + 'ms" data-i="' + i + '">' +
        '<div class="nm">' + miniFor(it) + '<span>' + esc(it.name) + '</span></div>' +
        '<span class="dim">' + (it.type === 'folder' ? '—' : fmtSize(it.size || 0)) + '</span>' +
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

function openItem(it) { go(it._segs); }

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