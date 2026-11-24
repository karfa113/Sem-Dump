/* Sem Dump — mobile-friendly PDF viewer (PDF.js, self-hosted in /vendor/pdfjs).
   Vertical scroll through every page, pinch-to-zoom, double-tap zoom, page counter,
   remembers where you stopped reading. */
let pdfjsP;
function loadPdfjs() {
  if (!pdfjsP) pdfjsP = import('./vendor/pdfjs/pdf.min.mjs').then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    return m;
  });
  return pdfjsP;
}

const KEY = 'semdump.pdfpos';
const readPos = (u) => { try { return (JSON.parse(localStorage.getItem(KEY)) || {})[u] || null; } catch { return null; } };
const savePos = (u, v) => { try { const o = JSON.parse(localStorage.getItem(KEY)) || {}; o[u] = v; const ks = Object.keys(o); if (ks.length > 60) delete o[ks[0]]; localStorage.setItem(KEY, JSON.stringify(o)); } catch {} };

export function mountPdf(stage, url, name, { onFail } = {}) {
  stage.innerHTML =
    '<div class="pdfv">' +
      '<div class="pdfv-bar">' +
        '<span class="pdfv-count" aria-live="polite">Loading…</span>' +
        '<span class="pdfv-tools">' +
          '<button class="pdfv-btn" data-z="out" aria-label="Zoom out">−</button>' +
          '<button class="pdfv-btn pdfv-fit" data-z="fit" aria-label="Fit to width">Fit</button>' +
          '<button class="pdfv-btn" data-z="in" aria-label="Zoom in">+</button>' +
        '</span>' +
      '</div>' +
      '<div class="pdfv-scroll" tabindex="0"><div class="pdfv-pages"></div></div>' +
      '<div class="pdfv-bgbar"><i></i></div>' +
    '</div>';
  const root = stage.firstElementChild;
  const scroller = root.querySelector('.pdfv-scroll');
  const pagesEl = root.querySelector('.pdfv-pages');
  const countEl = root.querySelector('.pdfv-count');
  const prog = root.querySelector('.pdfv-bgbar i');

  let dead = false, failed = false, doc = null, zoom = 1, pages = [], cur = 1, io = null, task = null;
  const GAP = 10, MAXZ = 4, MINZ = 1;

  const fitW = () => Math.max(120, scroller.clientWidth - 16);
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2.5);

  function layout() {
    const w = fitW() * zoom;
    pages.forEach((p) => {
      p.w = w; p.h = w * p.ratio;
      p.el.style.width = w + 'px'; p.el.style.height = p.h + 'px';
      if (p.canvas) { p.canvas.remove(); p.canvas = null; p.rendered = 0; }
    });
    pagesEl.style.width = w + 'px';
    pages.forEach((p) => { if (p.visible) draw(p); });
  }

  async function draw(p) {
    if (dead || p.rendered === p.w || p.busy) return;
    p.busy = true;
    const want = p.w;
    try {
      const page = await doc.getPage(p.n);
      const vp0 = page.getViewport({ scale: 1 });
      const scale = (want / vp0.width) * dpr();
      const vp = page.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      c.style.width = '100%'; c.style.height = '100%';
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      if (dead) return;
      if (want !== p.w) { p.busy = false; return draw(p); }
      if (p.canvas) p.canvas.remove();
      p.el.appendChild(c); p.canvas = c; p.rendered = want;
      p.el.classList.add('done');
    } catch (e) {
      if (dead || /cancel/i.test((e && e.name) || '') || /cancel/i.test(String((e && e.message) || ''))) { p.busy = false; return; }
      if (!failed) { failed = true; onFail && onFail(e); }   // a broken page must not leave a blank view
    }
    p.busy = false;
  }

  function observe() {
    io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        const p = pages[e.target.dataset.i];
        p.visible = e.isIntersecting;
        if (e.isIntersecting) draw(p);
        else if (p.canvas && Math.abs(p.n - cur) > 6) { p.canvas.remove(); p.canvas = null; p.rendered = 0; p.el.classList.remove('done'); }
      });
    }, { root: scroller, rootMargin: '120% 0px' });
    pages.forEach((p) => io.observe(p.el));
  }

  function updateCount() {
    const mid = scroller.scrollTop + scroller.clientHeight * 0.35;
    let n = 1;
    for (const p of pages) { if (p.el.offsetTop <= mid) n = p.n; else break; }
    cur = n;
    countEl.textContent = n + ' / ' + pages.length;
    const max = scroller.scrollHeight - scroller.clientHeight;
    prog.style.width = (max > 0 ? (scroller.scrollTop / max) * 100 : 0) + '%';
  }
  let saveT;
  scroller.addEventListener('scroll', () => {
    updateCount();
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      if (dead || !doc || !pages[cur - 1]) return;
      savePos(url, { p: cur, f: (scroller.scrollTop - pages[cur - 1].el.offsetTop) / Math.max(1, pages[cur - 1].h) });
    }, 400);
  }, { passive: true });

  /* zoom, keeping the point under (cx,cy) stable */
  function setZoom(z, cx, cy) {
    z = Math.min(MAXZ, Math.max(MINZ, z));
    if (Math.abs(z - zoom) < 0.01) return;
    const r = z / zoom;
    const x = (cx == null ? scroller.clientWidth / 2 : cx), y = (cy == null ? scroller.clientHeight / 2 : cy);
    const sx = (scroller.scrollLeft + x) * r - x, sy = (scroller.scrollTop + y) * r - y;
    zoom = z; layout();
    scroller.scrollLeft = sx; scroller.scrollTop = sy;
    updateCount();
  }
  root.querySelector('.pdfv-tools').addEventListener('click', (e) => {
    const b = e.target.closest('[data-z]'); if (!b) return;
    if (b.dataset.z === 'in') setZoom(zoom * 1.35);
    else if (b.dataset.z === 'out') setZoom(zoom / 1.35);
    else setZoom(1);
  });

  /* pinch (live CSS transform, real re-render on release) + double-tap */
  let pinch = null, lastTap = 0, tapX = 0, tapY = 0;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  scroller.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const r = scroller.getBoundingClientRect();
      pinch = { d: dist(e.touches), s: 1,
        cx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
        cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top };
      pagesEl.style.transformOrigin = (scroller.scrollLeft + pinch.cx) + 'px ' + (scroller.scrollTop + pinch.cy) + 'px';
    } else if (e.touches.length === 1) {
      const now = Date.now(), t = e.touches[0];
      if (now - lastTap < 300 && Math.hypot(t.clientX - tapX, t.clientY - tapY) < 30) {
        const r = scroller.getBoundingClientRect();
        setZoom(zoom > 1.05 ? 1 : 2.2, t.clientX - r.left, t.clientY - r.top);
        lastTap = 0; e.preventDefault();
      } else { lastTap = now; tapX = t.clientX; tapY = t.clientY; }
    }
  }, { passive: false });
  scroller.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    pinch.s = Math.min(MAXZ / zoom, Math.max(MINZ / zoom, dist(e.touches) / pinch.d));
    pagesEl.style.transform = 'scale(' + pinch.s + ')';
  }, { passive: false });
  const endPinch = () => {
    if (!pinch) return;
    const { s, cx, cy } = pinch; pinch = null;
    pagesEl.style.transform = ''; pagesEl.style.transformOrigin = '';
    setZoom(zoom * s, cx, cy);
  };
  scroller.addEventListener('touchend', (e) => { if (e.touches.length < 2) endPinch(); });
  scroller.addEventListener('touchcancel', endPinch);

  /* keyboard / ctrl+wheel for desktop testing */
  scroller.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return; e.preventDefault();
    const r = scroller.getBoundingClientRect();
    setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  let rzT, lastW = 0;
  const ro = new ResizeObserver(() => {
    if (!doc || Math.abs(scroller.clientWidth - lastW) < 2) return;
    lastW = scroller.clientWidth; clearTimeout(rzT);
    rzT = setTimeout(() => { const f = scroller.scrollTop / Math.max(1, scroller.scrollHeight); layout(); scroller.scrollTop = f * scroller.scrollHeight; updateCount(); }, 150);
  });
  ro.observe(scroller);

  (async () => {
    try {
      const pdfjs = await loadPdfjs();
      if (dead) return;
      task = pdfjs.getDocument({ url, withCredentials: false });
      task.onProgress = (p) => { if (p.total) prog.style.width = Math.min(100, (p.loaded / p.total) * 100) + '%'; };
      doc = await task.promise;
      if (dead) { doc.destroy(); return; }
      if (!doc.numPages) throw new Error('PDF has no pages');
      const first = await doc.getPage(1);
      const v = first.getViewport({ scale: 1 });
      lastW = scroller.clientWidth;
      for (let i = 1; i <= doc.numPages; i++) {
        const el = document.createElement('div');
        el.className = 'pdfv-page'; el.dataset.i = i - 1;
        el.innerHTML = '<span class="pdfv-n">' + i + '</span>';
        pagesEl.appendChild(el);
        pages.push({ n: i, el, ratio: v.height / v.width, w: 0, h: 0, visible: false, rendered: 0 });
      }
      layout(); observe();
      /* real aspect ratios for pages that differ from page 1 */
      (async () => { for (const p of pages.slice(1)) {
        if (dead) return;
        const pg = await doc.getPage(p.n), vp = pg.getViewport({ scale: 1 });
        const r = vp.height / vp.width;
        if (Math.abs(r - p.ratio) > 0.01) { p.ratio = r; p.h = p.w * r; p.el.style.height = p.h + 'px'; if (p.visible) { p.rendered = 0; draw(p); } }
      } })();
      prog.style.width = '0%';
      const saved = readPos(url);
      if (saved && saved.p > 1 && saved.p <= pages.length) {
        const t = pages[saved.p - 1]; scroller.scrollTop = t.el.offsetTop + (saved.f || 0) * t.h - 8;
        const toast = document.createElement('div'); toast.className = 'pdfv-toast'; toast.textContent = 'Resumed at page ' + saved.p;
        root.appendChild(toast); setTimeout(() => toast.remove(), 2200);
      }
      updateCount();
    } catch (e) {
      if (dead) return;
      console.warn('PDF viewer failed', e);
      onFail && onFail(e);
    }
  })();

  return () => { dead = true; ro.disconnect(); io && io.disconnect(); try { task && task.destroy(); } catch {} };
}
