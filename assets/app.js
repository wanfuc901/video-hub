// ═══════════════════════════════════════════════════════════════
// VHHUB — app.js (Enhanced Edition)
// ═══════════════════════════════════════════════════════════════

// ── TOAST ────────────────────────────────────────────────────
function showToast(msg, type = 'success', duration = 3000) {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(110%)';
    t.style.transition = '.3s';
    setTimeout(() => t.remove(), 320);
  }, duration);
}

// ── HELPERS ───────────────────────────────────────────────────
function formatTime(s) {
  if (isNaN(s)) return '00:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
function formatBytes(b) {
  if (!+b) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB'], i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
}
function escHtml(s) {
  return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
}
function fmtSize(b) { return formatBytes(b); }
function debounce(fn, ms) {
  let t;
  return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}

// ── LOCAL STORAGE KEYS ────────────────────────────────────────
const FAV_KEY = 'vhub_favorites';
const HIST_KEY = 'vhub_history';
const VIEW_KEY = 'vhub_viewmode';
const BLUR_ALL_KEY = 'vhub_global_blur';

function getFavs() { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
function setFavs(f) { localStorage.setItem(FAV_KEY, JSON.stringify(f)); updateFavBadge(); }
function toggleFav(name) {
  let f = getFavs();
  let added = false;
  if (f.includes(name)) {
    f = f.filter(x => x !== name);
    showToast('Đã xóa khỏi yêu thích', 'info');
  } else {
    f.push(name);
    showToast('Đã thêm vào yêu thích', 'success');
    added = true;
  }
  setFavs(f);
  return added;
}
function updateFavBadge() {
  const b = document.getElementById('favCount');
  if (b) b.textContent = getFavs().length;
}
function getHistory() { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); }
function addToHistory(name, path, title) {
  let h = getHistory();
  h = h.filter(x => x.name !== name);
  h.unshift({ name, path, title, time: Date.now() });
  if (h.length > 50) h = h.slice(0, 50);
  localStorage.setItem(HIST_KEY, JSON.stringify(h));
}
function getProgress(path) {
  const p = localStorage.getItem('video_progress_' + path);
  if (!p) return null;
  try {
    const pp = p.split('|');
    return pp.length === 2 ? { currentTime: parseFloat(pp[0]), duration: parseFloat(pp[1]) } : { currentTime: parseFloat(p), duration: 0 };
  } catch (e) { return null; }
}
function isGlobalBlur() { return localStorage.getItem(BLUR_ALL_KEY) === 'true'; }
function setGlobalBlur(val) { localStorage.setItem(BLUR_ALL_KEY, val); }

// ═══════════════════════════════════════════════════════════════
// MULTI-FILE CHUNKED UPLOADER
// ═══════════════════════════════════════════════════════════════
(function () {
  const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB
  const MAX_PARALLEL = 3;             // số file upload cùng lúc
  const CHUNK_PARALLEL = 4;           // số chunk song song mỗi file

  let queue = [];
  let running = 0;
  let isCanceled = false;
  const activeXhrs = new Set();

  const modal = document.getElementById('uploadModal');
  const dropZone = document.getElementById('uploadDropZone');
  const fileInput = document.getElementById('videoFileInput');
  const browseLink = document.getElementById('uploadBrowseLink');
  const queueEl = document.getElementById('uploadQueue');
  const startBtn = document.getElementById('uploadStartBtn');
  const stopBtn = document.getElementById('uploadStopBtn');
  const clearBtn = document.getElementById('uploadClearBtn');
  const summaryEl = document.getElementById('uploadSummary');
  const openBtn = document.getElementById('openUploadBtn');
  const closeBtn = document.getElementById('closeUploadBtn');
  const minimizeBtn = document.getElementById('minimizeUploadBtn');
  const conflictDlg = document.getElementById('conflictDialog');
  const optionsDiv = document.getElementById('uploadOptions');

  if (!openBtn) return;

  openBtn.addEventListener('click', () => { if (modal) modal.style.display = 'block'; });
  
  if (closeBtn) closeBtn.addEventListener('click', () => {
    if (running > 0) {
      if (confirm('Đang có video tải lên. Bạn có muốn dừng tất cả và thoát không?')) {
        stopAllUploads();
        closeModal();
      }
    } else closeModal();
  });
  
  if (minimizeBtn) minimizeBtn.addEventListener('click', () => { if (modal) modal.style.display = 'none'; showToast('Đang tải lên dưới nền', 'info'); });
  
  window.addEventListener('click', e => { if (modal && e.target === modal) modal.style.display = 'none'; });

  function closeModal() { if (running > 0) return; if (modal) modal.style.display = 'none'; resetQueue(); }

  function stopAllUploads() {
    isCanceled = true;
    activeXhrs.forEach(xhr => xhr.abort());
    activeXhrs.clear();
    // Only mark uploading items as error, keep pending as pending for restart
    queue.forEach(item => { if (['uploading', 'checking'].includes(item.status)) item.status = 'error'; });
    running = 0;
    renderQueue();
    showToast('Đã dừng tải lên', 'warning');
    if (stopBtn) stopBtn.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'block';
  }

  if (stopBtn) stopBtn.addEventListener('click', stopAllUploads);

  if (dropZone) {
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); addFiles(Array.from(e.dataTransfer.files)); });
  }
  if (browseLink) browseLink.addEventListener('click', e => e.stopPropagation());
  if (fileInput) fileInput.addEventListener('change', () => { addFiles(Array.from(fileInput.files)); fileInput.value = ''; });

  function addFiles(files) {
    const exts = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v', 'flv', 'wmv', 'ts'];
    files.forEach(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      if (!exts.includes(ext)) return;
      if (queue.find(q => q.file.name === f.name && q.status === 'pending')) return;
      queue.push({ file: f, id: crypto.randomUUID(), status: 'pending', progress: 0 });
    });
    renderQueue();
  }

  function renderQueue() {
    if (!queueEl || !optionsDiv || !startBtn || !clearBtn || !summaryEl) return;
    const empty = queue.length === 0;
    queueEl.style.display = empty ? 'none' : 'flex';
    optionsDiv.style.display = empty ? 'none' : 'block';
    startBtn.style.display = (empty || running > 0) ? 'none' : 'flex';
    clearBtn.style.display = (empty || running > 0) ? 'none' : 'block';
    if (empty) { summaryEl.textContent = ''; return; }

    const sortedQueue = [...queue].sort((a, b) => {
      const order = { uploading: 0, checking: 1, pending: 2, done: 3, error: 4, skipped: 5 };
      return (order[a.status] ?? 99) - (order[b.status] ?? 99);
    });

    queueEl.innerHTML = sortedQueue.map(item => `
      <div id="qi-${item.id}" style="border:1px solid var(--border);padding:10px 12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="flex:1;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(item.file.name)}">${escHtml(item.file.name)}</span>
          <span style="font-size:11px;color:var(--text-gray);white-space:nowrap;">${fmtSize(item.file.size)}</span>
          <span id="qi-status-${item.id}" style="font-size:11px;font-weight:600;${statusColor(item.status)}">${statusLabel(item.status)}</span>
          ${item.status === 'pending' ? `<button onclick="removeQueueItem('${item.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-gray);font-size:16px;">×</button>` : ''}
        </div>
        <div style="height:3px;background:var(--border);overflow:hidden;">
          <div id="qi-bar-${item.id}" style="height:100%;background:linear-gradient(90deg,var(--accent),#ff7eb3);width:${item.progress}%;transition:width .15s;"></div>
        </div>
      </div>
    `).join('');
    const total = queue.length, done = queue.filter(q => q.status === 'done').length, err = queue.filter(q => q.status === 'error').length;
    summaryEl.textContent = running > 0 ? `Đang upload... ${done}/${total} hoàn thành` :
      `${total} file · ${fmtSize(queue.reduce((s, q) => s + q.file.size, 0))}${err > 0 ? ` · ${err} lỗi`: ''}`;
  }

  window.removeQueueItem = function (id) { queue = queue.filter(q => q.id !== id); renderQueue(); };
  function resetQueue() { queue = []; renderQueue(); }

  if (startBtn) startBtn.addEventListener('click', startUploads);
  if (clearBtn) clearBtn.addEventListener('click', resetQueue);

  async function startUploads() {
    let pending = queue.filter(q => ['pending', 'error'].includes(q.status));
    if (!pending.length) return;
    isCanceled = false; // RESET isCanceled
    if (startBtn) startBtn.style.display = 'none'; 
    if (clearBtn) clearBtn.style.display = 'none'; 
    if (stopBtn) stopBtn.style.display = 'flex';
    pending.sort((a, b) => a.file.size - b.file.size);
    running = pending.length;
    const conflictMode = document.querySelector('input[name="conflictMode"]:checked')?.value || 'ask';
    
    // Robust Worker Pool for files
    const items = [...pending];
    const pool = [];
    for (let i = 0; i < Math.min(MAX_PARALLEL, items.length); i++) {
        pool.push(worker());
    }
    
    async function worker() {
        while (items.length > 0 && !isCanceled) {
            const item = items.shift();
            await uploadFile(item, conflictMode);
        }
    }
    
    await Promise.all(pool);
    
    running = 0;
    const done = queue.filter(q => q.status === 'done').length;
    const err = queue.filter(q => q.status === 'error').length;
    showToast(`Upload xong: ${done} thành công${err > 0 ? `, ${err} lỗi` : ''}`, err > 0 ? 'warning' : 'success');
    if (summaryEl) summaryEl.textContent = `Hoàn tất: ${done}/${queue.length} thành công`;
    if (clearBtn) clearBtn.style.display = 'block'; 
    if (stopBtn) stopBtn.style.display = 'none';
    if (typeof loadVideos === 'function') loadVideos();
  }

  function askConflict(fileName) {
    return new Promise(resolve => {
      const fnEl = document.getElementById('conflictFileName');
      if (fnEl) fnEl.textContent = fileName;
      if (conflictDlg) conflictDlg.style.display = 'flex';
      let resolved = false;
      const cleanup = (val) => { 
        if (resolved) return; resolved = true;
        if (conflictDlg) conflictDlg.style.display = 'none'; 
        resolve(val);
      };
      const btnOverwrite = document.getElementById('conflictOverwrite');
      const btnKeepBoth = document.getElementById('conflictKeepBoth');
      const btnSkip = document.getElementById('conflictSkip');
      if (btnOverwrite) btnOverwrite.onclick = () => cleanup('overwrite');
      if (btnKeepBoth) btnKeepBoth.onclick = () => cleanup('keepboth');
      if (btnSkip) btnSkip.onclick = () => cleanup('skip');
      // If dialog is closed without choice (Bug 7)
      window.addEventListener('click', e => { if (e.target === conflictDlg) cleanup('skip'); }, { once: true });
    });
  }

  async function uploadFile(item, conflictMode) {
    if (isCanceled) return;
    item.status = 'checking'; updateItemUI(item);
    const checkRes = await fetch(`api.php?action=check_exists&file=${encodeURIComponent(item.file.name)}`).then(r => r.json()).catch(() => ({ exists: false }));
    let overwrite = false, keepBoth = false;
    if (checkRes.exists) {
      if (isCanceled) return;
      let action = conflictMode;
      if (conflictMode === 'ask') action = await askConflict(item.file.name);
      if (action === 'skip') { item.status = 'skipped'; updateItemUI(item); return; }
      if (action === 'overwrite') overwrite = true;
      if (action === 'keepboth') keepBoth = true;
    }
    if (isCanceled) return;
    item.status = 'uploading'; updateItemUI(item);
    const file = item.file;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = item.id;
    const chunkProgress = new Array(totalChunks).fill(0);

    async function uploadChunkWithRetry(ci, retryCount = 3) {
      for (let attempt = 0; attempt <= retryCount; attempt++) {
        if (isCanceled) throw new Error('Aborted');
        try {
          const start = ci * CHUNK_SIZE;
          const chunk = file.slice(start, start + CHUNK_SIZE);
          const fd = new FormData();
          fd.append('chunk', chunk, 'chunk');
          fd.append('fileName', file.name);
          fd.append('chunkIndex', ci);
          fd.append('totalChunks', totalChunks);
          fd.append('uploadId', uploadId);
          fd.append('overwrite', overwrite ? 'true' : 'false');
          fd.append('keepBoth', keepBoth ? 'true' : 'false');
          const res = await xhrChunk('api.php?action=upload_chunk', fd, pct => {
            chunkProgress[ci] = pct / 100;
            const total = chunkProgress.reduce((s, p) => s + p, 0);
            item.progress = (total / totalChunks) * 100;
            updateItemUI(item);
          });
          if (!res.success) throw new Error(res.error || 'Chunk failed');
          return res;
        } catch (e) {
          if (attempt === retryCount || isCanceled) throw e;
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Exponential backoff
        }
      }
    }

    try {
      const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i);
      const chunkPool = [];
      for (let i = 0; i < Math.min(CHUNK_PARALLEL, chunkIndices.length); i++) {
          chunkPool.push(chunkWorker());
      }
      
      async function chunkWorker() {
          while (chunkIndices.length > 0 && !isCanceled) {
              const ci = chunkIndices.shift();
              await uploadChunkWithRetry(ci);
          }
      }
      
      await Promise.all(chunkPool);
      if (isCanceled) throw new Error('Aborted');
      item.status = 'done'; item.progress = 100;
    } catch (e) {
      item.status = 'error'; item.errorMsg = e.message;
    }
    updateItemUI(item); renderQueue();
  }

  function xhrChunk(url, fd, onProgress) {
    return new Promise((resolve, reject) => {
      if (isCanceled) return reject(new Error('Aborted'));
      const xhr = new XMLHttpRequest();
      activeXhrs.add(xhr);
      xhr.open('POST', url, true);
      xhr.upload.onprogress = ev => { if (ev.lengthComputable) onProgress((ev.loaded / ev.total) * 100); };
      xhr.onload = () => { activeXhrs.delete(xhr); try { resolve(JSON.parse(xhr.responseText)); } catch (e) { reject(new Error('Parse error')); } };
      xhr.onerror = () => { activeXhrs.delete(xhr); reject(new Error('Network error')); };
      xhr.onabort = () => { activeXhrs.delete(xhr); reject(new Error('Aborted')); };
      xhr.send(fd);
    });
  }

  function updateItemUI(item) {
    const bar = document.getElementById(`qi-bar-${item.id}`);
    const st = document.getElementById(`qi-status-${item.id}`);
    if (bar) bar.style.width = item.progress + '%';
    if (st) { st.textContent = statusLabel(item.status); st.style.cssText = statusColor(item.status); }
    if (summaryEl) {
        const total = queue.length, done = queue.filter(q => q.status === 'done').length;
        if (running > 0) summaryEl.textContent = `Đang upload... ${done}/${total} hoàn thành`;
    }
  }

  function statusLabel(s) { return { pending: 'Chờ', checking: 'Kiểm tra', uploading: 'Đang up', done: 'Xong', error: 'Lỗi', skipped: 'Bỏ qua' }[s] || s; }
  function statusColor(s) { return { done: 'color:#4ade80;', error: 'color:#f87171;', uploading: 'color:var(--accent);', skipped: 'color:var(--text-gray);' }[s] || 'color:var(--text-gray);'; }
})();

// ═══════════════════════════════════════════════════════════════
// INDEX PAGE LOGIC
// ═══════════════════════════════════════════════════════════════
if (document.getElementById('videoGrid')) {
  let allVideos = [];
  let currentTab = 'all';
  let currentView = localStorage.getItem(VIEW_KEY) || 'grid';
  let isSelectingMode = false;
  let selectedFiles = new Set();

  // ── THUMBNAIL LAZY-LOAD ─────────────────────────────────
  const thumbCache = new Map(); // url → true (loaded OK this session)
  const gridObservers = {};     // gridId → IntersectionObserver

  function loadThumbImg(img, wrapper, attempt) {
    if (attempt === undefined) attempt = 0;
    const src = img.dataset.src;
    if (!src) return;
    if (thumbCache.has(src)) {
      img.src = src;
      img.removeAttribute('data-src');
      wrapper.classList.remove('thumb-loading');
      return;
    }
    const tmp = new Image();
    tmp.onload = () => {
      thumbCache.set(src, true);
      if (img.isConnected) {
        img.src = src;
        img.removeAttribute('data-src');
        wrapper.classList.remove('thumb-loading');
      }
    };
    tmp.onerror = () => {
      if (attempt < 3 && img.isConnected) {
        setTimeout(() => loadThumbImg(img, wrapper, attempt + 1), 1000 * (attempt + 1));
      } else if (img.isConnected) {
        wrapper.classList.remove('thumb-loading');
      }
    };
    // bust cache only on retry so the browser doesn't re-download on first attempt
    tmp.src = attempt > 0 ? src + '&_r=' + attempt : src;
  }

  function observeThumbsInGrid(gridId) {
    if (gridObservers[gridId]) gridObservers[gridId].disconnect();
    const grid = document.getElementById(gridId);
    if (!grid) return;
    if (!('IntersectionObserver' in window)) {
      grid.querySelectorAll('img[data-src]').forEach(img => {
        const w = img.closest('.thumbnail-wrapper');
        if (w) loadThumbImg(img, w);
      });
      return;
    }
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        o.unobserve(entry.target);
        const img = entry.target.querySelector('img[data-src]');
        if (img) loadThumbImg(img, entry.target);
      });
    }, { rootMargin: '300px 0px', threshold: 0 });
    gridObservers[gridId] = obs;
    grid.querySelectorAll('.thumbnail-wrapper.thumb-loading').forEach(w => obs.observe(w));
  }

  updateFavBadge();

  const mobSearchBtn = document.getElementById('mobileSearchBtn');
  const searchBarContainer = document.getElementById('searchBarContainer');
  if (mobSearchBtn) {
    mobSearchBtn.addEventListener('click', () => {
      if (searchBarContainer) {
        searchBarContainer.classList.toggle('active');
        if (searchBarContainer.classList.contains('active')) {
          const si = document.getElementById('searchInput');
          if (si) si.focus();
        }
      }
    });
  }

  window.addEventListener('scroll', () => {
    const h = document.getElementById('mainHeader');
    if (h) h.classList.toggle('scrolled', window.scrollY > 10);
  });

  function applyViewMode(mode) {
    currentView = mode;
    localStorage.setItem(VIEW_KEY, mode);
    const grids = document.querySelectorAll('.video-grid');
    grids.forEach(grid => {
      grid.classList.remove('view-list', 'view-detail', 'view-none', 'blur-all');
      if (mode === 'list') grid.classList.add('view-list');
      if (mode === 'detail') grid.classList.add('view-detail');
      if (mode === 'none') grid.classList.add('view-none');
      if (isGlobalBlur()) grid.classList.add('blur-all');
    });
    document.querySelectorAll('.view-btn').forEach(b => { b.classList.toggle('active', b.dataset.view === mode); });
  }

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => { applyViewMode(btn.dataset.view); renderByTab(); });
  });

  const blurToggle = document.getElementById('globalBlurToggle');
  if (blurToggle) {
    blurToggle.checked = isGlobalBlur();
    blurToggle.addEventListener('change', e => {
      setGlobalBlur(e.target.checked);
      applyViewMode(currentView);
    });
  }
  applyViewMode(currentView);

  function renderSkeleton() {
    const g = document.getElementById('videoGrid');
    if (!g) return;
    g.style.display = ''; 
    const es = document.getElementById('emptyState');
    if (es) es.style.display = 'none'; 
    g.innerHTML = '';
    for (let i = 0; i < 8; i++) g.innerHTML += `<div class="skeleton-card"><div class="thumb skeleton"></div><div class="line1 skeleton"></div><div class="line2 skeleton"></div></div>`;
  }

  function loadVideos() {
    renderSkeleton();
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    fetch('api.php?action=list', { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        clearTimeout(tid);
        if (data.error) { showToast(data.error, 'error'); return; }
        allVideos = data; renderByTab(); generateMissingThumbnails();
      })
      .catch(err => {
        clearTimeout(tid);
        const msg = err.name === 'AbortError' ? 'Tải danh sách quá lâu, thử lại' : 'Lỗi tải danh sách';
        showToast(msg, 'error');
        const g = document.getElementById('videoGrid');
        const es = document.getElementById('emptyState');
        if (g) g.style.display = 'none';
        if (es) { es.style.display = 'block'; const p = es.querySelector('p'); if (p) p.textContent = msg; }
      });
  }
  window.loadVideos = loadVideos;
  loadVideos();

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active'); currentTab = t.dataset.tab;
      const si = document.getElementById('searchInput');
      if (si) si.value = '';
      renderByTab();
    });
  });
  const tabFav = document.getElementById('tabFavBtn');
  if (tabFav) tabFav.addEventListener('click', () => { const b = document.querySelector('[data-tab="favorites"]'); if (b) b.click(); });
  const tabHist = document.getElementById('tabHistoryBtn');
  if (tabHist) tabHist.addEventListener('click', () => { const b = document.querySelector('[data-tab="history"]'); if (b) b.click(); });

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(e => {
      const term = e.target.value.toLowerCase();
      let filtered = getFilteredVideos(currentTab).filter(v => (v.title_custom || v.name).toLowerCase().includes(term) || v.name.toLowerCase().includes(term));
      renderGrid(filtered, 'videoGrid');
    }, 250));
  }

  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) sortSelect.addEventListener('change', () => renderByTab());

  function getFilteredVideos(tab) {
    let filtered = [];
    if (tab === 'all') filtered = [...allVideos];
    else if (tab === 'favorites') { const favs = getFavs(); filtered = allVideos.filter(v => favs.includes(v.name)); }
    else if (tab === 'history') { const hist = getHistory().map(h => h.name); hist.forEach(n => { const v = allVideos.find(x => x.name === n); if (v) filtered.push(v); }); }
    else if (tab === 'suggest') { filtered = allVideos.filter(v => { const p = getProgress(v.path); return !p || p.currentTime < 10; }).sort(() => 0.5 - Math.random()).slice(0, 8); }
    if (tab === 'all' || tab === 'favorites') {
      const sv = document.getElementById('sortSelect')?.value || 'newest';
      filtered.sort((a, b) => {
        if (sv === 'newest') return b.mtime - a.mtime;
        if (sv === 'oldest') return a.mtime - b.mtime;
        if (sv === 'largest') return b.size - a.size;
        if (sv === 'smallest') return a.size - b.size;
        const na = (a.title_custom || a.name).toLowerCase(), nb = (b.title_custom || b.name).toLowerCase();
        return sv === 'az' ? na.localeCompare(nb) : nb.localeCompare(na);
      });
    }
    return filtered;
  }

  function renderByTab() {
    renderGrid(getFilteredVideos(currentTab), 'videoGrid');
    const cwSec = document.getElementById('continueWatchingSection');
    const si = document.getElementById('searchInput');
    if (currentTab === 'all' && (!si || !si.value)) {
      let cw = allVideos.filter(v => { const p = getProgress(v.path); if (p && p.duration > 0) { const pct = (p.currentTime / p.duration) * 100; return pct >= 10 && pct <= 90; } return false; });
      const hist = getHistory();
      cw.sort((a, b) => { const ha = hist.find(h => h.name === a.name), hb = hist.find(h => h.name === b.name); return (hb?.time || 0) - (ha?.time || 0); });
      cw = cw.slice(0, 4);
      if (cw.length > 0) {
        if (cwSec) cwSec.style.display = 'block';
        renderGrid(cw, 'continueWatchingGrid', true);
      } else if (cwSec) cwSec.style.display = 'none';
    } else if (cwSec) cwSec.style.display = 'none';
  }

  function renderGrid(videos, targetId, isCompact = false) {
    const grid = document.getElementById(targetId);
    const empty = document.getElementById('emptyState');
    if (!grid) return;
    grid.innerHTML = '';

    // Apply fundamental classes
    grid.className = 'video-grid';
    if (isGlobalBlur()) grid.classList.add('blur-all');

    if (targetId === 'videoGrid') {
      if (currentView === 'list') grid.classList.add('view-list');
      if (currentView === 'detail') grid.classList.add('view-detail');
      if (currentView === 'none') grid.classList.add('view-none');
      if (isSelectingMode) grid.classList.add('selecting-mode');
    }

    if (videos.length === 0 && targetId === 'videoGrid') {
      grid.style.display = 'none';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (targetId === 'videoGrid') {
      grid.style.display = '';
      if (empty) empty.style.display = 'none';
    }

    const favs = getFavs();
    videos.forEach((v, idx) => {
      const isFav = favs.includes(v.name);
      const isSelected = selectedFiles.has(v.name);
      const card = document.createElement('div');
      card.className = 'video-card' + (isSelected ? ' selected' : '');
      card.dataset.name = v.name;
      card.style.animation = `toastIn .35s ease forwards ${idx * 0.04}s`;
      card.style.opacity = '0';

      const displayName = v.title_custom || v.name;
      const thumbSrc = v.thumbnail_exists ? `api.php?action=thumbnail&file=${encodeURIComponent(v.name)}` : '';
      const prog = getProgress(v.path);
      let pct = 0, isWatched = false;
      if (prog && prog.duration > 0) { pct = (prog.currentTime / prog.duration) * 100; if (pct > 90) isWatched = true; }

      const detailExtra = (currentView === 'detail' || currentView === 'none')
        ? `<div class="detail-extra"><span>${v.ext.toUpperCase()}</span><span>${formatBytes(v.size)}</span><span>${new Date(v.mtime * 1000).toLocaleDateString('vi-VN')}</span></div>`
        : '';

      card.innerHTML = `
        <div class="thumbnail-wrapper${thumbSrc ? ' thumb-loading' : ''}">
          ${thumbSrc ? `<img data-src="${thumbSrc}" alt="">` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#444;font-size:12px;">No thumb</div>`}
          ${isWatched ? `<div class="watched-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>` : ''}
          <div class="duration-badge mono-font">${v.ext.toUpperCase()}</div>
          <button class="fav-btn${isFav ? ' active' : ''}" data-name="${v.name}" title="${isFav ? 'Bỏ yêu thích' : 'Yêu thích'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <button class="delete-hover-btn" data-name="${v.name}" title="Xóa video">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
          <div class="select-checkbox">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
        ${pct > 0 ? `<div class="progress-bar-container"><div class="progress-bar" style="width:${pct}%"></div></div>` : ''}
        <div class="card-info">
          <div class="video-title" data-name="${v.name}">
            <span style="flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;" title="${escHtml(displayName)}">${escHtml(displayName)}</span>
            <button class="edit-title-btn-small" style="background:none;border:none;cursor:pointer;color:var(--text-gray);flex-shrink:0;" title="Sửa tên">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
          <div class="video-meta">${formatBytes(v.size)} · ${new Date(v.mtime * 1000).toLocaleDateString('vi-VN')}</div>
          ${detailExtra}
        </div>
      `;

      grid.appendChild(card);

      const openVideo = () => {
        if (isSelectingMode) { toggleSelectCard(card, v.name); return; }
        window.location.href = `player.php?path=${encodeURIComponent(v.path)}`;
      };

      const thumbWrapper = card.querySelector('.thumbnail-wrapper');
      if (thumbWrapper) thumbWrapper.onclick = e => {
        if (e.target.closest('.fav-btn') || e.target.closest('.delete-hover-btn') || e.target.closest('.select-checkbox')) return;
        openVideo();
      };
      const cardInfo = card.querySelector('.card-info');
      if (cardInfo) cardInfo.onclick = e => {
        if (e.target.closest('.edit-title-btn-small')) return;
        openVideo();
      };

      const selCb = card.querySelector('.select-checkbox');
      if (selCb) selCb.onclick = e => { e.stopPropagation(); toggleSelectCard(card, v.name); };
      const favB = card.querySelector('.fav-btn');
      if (favB) favB.onclick = e => { e.stopPropagation(); const added = toggleFav(v.name); e.currentTarget.classList.toggle('active', added); const s = e.currentTarget.querySelector('svg'); if (s) s.setAttribute('fill', added ? 'currentColor' : 'none'); if (currentTab === 'favorites') renderByTab(); };
      const delB = card.querySelector('.delete-hover-btn');
      if (delB) delB.onclick = e => { e.stopPropagation(); confirmDeleteSingle(v.name); };

      const titleEl = card.querySelector('.video-title');
      const editBtn = titleEl?.querySelector('.edit-title-btn-small');
      if (editBtn) editBtn.onclick = e => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.className = 'title-edit-input'; input.value = displayName;
        if (titleEl) titleEl.replaceWith(input); input.focus();
        const save = () => {
          const nv = input.value.trim();
          if (nv && nv !== displayName) {
            fetch('api.php?action=update_title', { method: 'POST', body: JSON.stringify({ file: v.name, title: nv }), headers: { 'Content-Type': 'application/json' } })
              .then(r => r.json()).then(res => { if (res.success) { showToast('Đã lưu tên'); v.title_custom = nv; renderByTab(); } });
          } else renderByTab();
        };
        input.onblur = save;
        input.onkeydown = ek => { if (ek.key === 'Enter') save(); if (ek.key === 'Escape') renderByTab(); };
      };
    });

    observeThumbsInGrid(targetId);
  }

  function confirmDeleteSingle(name) {
    const dlg = document.getElementById('confirmDeleteDialog');
    const msg = document.getElementById('confirmDeleteMsg');
    if (!dlg || !msg) return;
    msg.textContent = `Xóa "${name}"? Hành động này không thể hoàn tác.`;
    dlg.style.display = 'flex';
    const ok = document.getElementById('confirmDeleteOk');
    const cancel = document.getElementById('confirmDeleteCancel');
    if (ok) ok.onclick = () => {
      dlg.style.display = 'none'; ok.onclick = null; if (cancel) cancel.onclick = null;
      fetch('api.php?action=delete', { method: 'POST', body: JSON.stringify({ file: name }), headers: { 'Content-Type': 'application/json' } })
        .then(r => r.json()).then(res => { if (res.success) { showToast('Đã xóa video', 'success'); loadVideos(); } else showToast('Xóa thất bại', 'error'); });
    };
    if (cancel) cancel.onclick = () => { dlg.style.display = 'none'; if (ok) ok.onclick = null; cancel.onclick = null; };
  }

  function toggleSelectCard(card, name) {
    if (selectedFiles.has(name)) { selectedFiles.delete(name); card.classList.remove('selected'); }
    else { selectedFiles.add(name); card.classList.add('selected'); }
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const sc = document.getElementById('selectionCount');
    if (sc) sc.textContent = `Đã chọn: ${selectedFiles.size} video`;
  }

  function enterSelectMode() {
    isSelectingMode = true; selectedFiles.clear();
    const tb = document.getElementById('selectionToolbar');
    if (tb) tb.style.display = 'flex';
    const g = document.getElementById('videoGrid');
    if (g) g.classList.add('selecting-mode');
    updateSelectionUI();
  }

  function exitSelectMode() {
    isSelectingMode = false; selectedFiles.clear();
    const tb = document.getElementById('selectionToolbar');
    if (tb) tb.style.display = 'none';
    const g = document.getElementById('videoGrid');
    if (g) g.classList.remove('selecting-mode');
    renderByTab();
  }

  const selAll = document.getElementById('selectAllBtn');
  if (selAll) selAll.onclick = () => { getFilteredVideos(currentTab).forEach(v => selectedFiles.add(v.name)); document.querySelectorAll('.video-card').forEach(c => c.classList.add('selected')); updateSelectionUI(); };
  const deselAll = document.getElementById('deselectAllBtn');
  if (deselAll) deselAll.onclick = () => { selectedFiles.clear(); document.querySelectorAll('.video-card').forEach(c => c.classList.remove('selected')); updateSelectionUI(); };
  const cancelSel = document.getElementById('cancelSelectBtn');
  if (cancelSel) cancelSel.onclick = exitSelectMode;

  const delSel = document.getElementById('deleteSelectedBtn');
  if (delSel) delSel.onclick = () => {
    if (!selectedFiles.size) { showToast('Chưa chọn video nào', 'error'); return; }
    const dlg = document.getElementById('confirmDeleteDialog');
    const msg = document.getElementById('confirmDeleteMsg');
    if (!dlg || !msg) return;
    msg.textContent = `Xóa ${selectedFiles.size} video đã chọn? Hành động này không thể hoàn tác.`;
    dlg.style.display = 'flex';
    const ok = document.getElementById('confirmDeleteOk');
    const cancel = document.getElementById('confirmDeleteCancel');
    if (ok) ok.onclick = () => {
      dlg.style.display = 'none'; ok.onclick = null; if (cancel) cancel.onclick = null;
      fetch('api.php?action=delete_many', { method: 'POST', body: JSON.stringify({ files: [...selectedFiles] }), headers: { 'Content-Type': 'application/json' } })
        .then(r => r.json()).then(res => { showToast(`Đã xóa ${res.deleted} video`, 'success'); exitSelectMode(); loadVideos(); });
    };
    if (cancel) cancel.onclick = () => { dlg.style.display = 'none'; if (ok) ok.onclick = null; cancel.onclick = null; };
  };

  const delMany = document.getElementById('deleteManyBtn');
  if (delMany) delMany.onclick = () => { const d = document.getElementById('deleteManyDialog'); if (d) d.style.display = 'flex'; };
  const dmSel = document.getElementById('dmSelecting');
  if (dmSel) dmSel.onclick = () => { const d = document.getElementById('deleteManyDialog'); if (d) d.style.display = 'none'; enterSelectMode(); };
  const dmAll = document.getElementById('dmDeleteAll');
  if (dmAll) dmAll.onclick = () => {
    const d = document.getElementById('deleteManyDialog'); if (d) d.style.display = 'none';
    const dlg = document.getElementById('confirmDeleteDialog');
    const msg = document.getElementById('confirmDeleteMsg');
    if (!dlg || !msg) return;
    msg.textContent = `Xóa TẤT CẢ ${allVideos.length} video? Hành động này KHÔNG THỂ hoàn tác!`;
    dlg.style.display = 'flex';
    const ok = document.getElementById('confirmDeleteOk');
    const cancel = document.getElementById('confirmDeleteCancel');
    if (ok) ok.onclick = () => {
      dlg.style.display = 'none'; ok.onclick = null; if (cancel) cancel.onclick = null;
      const allNames = allVideos.map(v => v.name);
      fetch('api.php?action=delete_many', { method: 'POST', body: JSON.stringify({ files: allNames }), headers: { 'Content-Type': 'application/json' } })
        .then(r => r.json()).then(res => { showToast(`Đã xóa ${res.deleted} video`, 'success'); loadVideos(); });
    };
    if (cancel) cancel.onclick = () => { dlg.style.display = 'none'; if (ok) ok.onclick = null; cancel.onclick = null; };
  };
  const dmCancel = document.getElementById('dmCancel');
  if (dmCancel) dmCancel.onclick = () => { const d = document.getElementById('deleteManyDialog'); if (d) d.style.display = 'none'; };

  function generateMissingThumbnails() {
    const missing = allVideos.filter(v => !v.thumbnail_exists).slice(0, 5);
    if (!missing.length) return;
    missing.forEach((v, idx) => {
      setTimeout(() => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous'; video.muted = true; video.playsInline = true; video.preload = 'auto';
        video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;top:-9999px;width:160px;height:90px;';
        document.body.appendChild(video);
        let captured = false;
        const cleanup = () => { try { video.pause(); video.src = ''; video.parentNode?.removeChild(video); } catch (e) { } };
        const captureFrame = () => {
          if (captured || video.videoWidth === 0) return;
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 640; let w = video.videoWidth, h = video.videoHeight;
            if (w > h) { if (w > maxDim) { h = h * (maxDim / w); w = maxDim; } } else { if (h > maxDim) { w = w * (maxDim / h); h = maxDim; } }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0, w, h);
            const px = ctx.getImageData(w / 2, h / 2, 1, 1).data;
            if (px[0] === 0 && px[1] === 0 && px[2] === 0 && px[3] === 255 && video.currentTime < 10) { video.currentTime = Math.min(video.duration * 0.3, 15); return; }
            captured = true;
            const fd = new FormData(); fd.append('file', v.name); fd.append('image', canvas.toDataURL('image/jpeg', 0.85));
            fetch('api.php?action=upload_thumbnail', { method: 'POST', body: fd }).then(r => r.json()).then(res => {
              if (res.success) {
                v.thumbnail_exists = true;
                const baseSrc = `api.php?action=thumbnail&file=${encodeURIComponent(v.name)}`;
                thumbCache.set(baseSrc, true);
                const wrapper = document.querySelector(`.video-card[data-name="${CSS.escape(v.name)}"] .thumbnail-wrapper`);
                if (wrapper) {
                  let img = wrapper.querySelector('img');
                  if (!img) { img = document.createElement('img'); img.alt = ''; wrapper.insertBefore(img, wrapper.firstChild); }
                  img.src = baseSrc + '&t=' + Date.now();
                  img.removeAttribute('data-src');
                  wrapper.classList.remove('thumb-loading');
                }
              }
              cleanup();
            }).catch(cleanup);
          } catch (e) { cleanup(); }
        };
        video.onloadedmetadata = () => { const t = Math.min(video.duration * 0.1, 5); video.currentTime = t > 0 ? t : 1; };
        video.onseeked = () => setTimeout(captureFrame, 250);
        video.onerror = cleanup;
        video.src = `api.php?action=stream&path=${encodeURIComponent(v.path)}`;
        video.load();
      }, idx * 600);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// PLAYER PAGE LOGIC
// ═══════════════════════════════════════════════════════════════
if (document.getElementById('videoPlayer')) {
  const video = document.getElementById('videoPlayer');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const muteBtn = document.getElementById('muteBtn');
  const volumeSlider = document.getElementById('volumeSlider');
  const seekBarContainer = document.getElementById('seekBarContainer');
  const seekBarFill = document.getElementById('seekBarFill');
  const currentTimeDisplay = document.getElementById('currentTimeDisplay');
  const durationDisplay = document.getElementById('durationDisplay');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const playerWrapper = document.getElementById('playerWrapper');
  const speedBtn = document.getElementById('speedBtn');
  const pipBtn = document.getElementById('pipBtn');
  const playerControls = document.getElementById('playerControls');
  let isSeeking = false; let hideTimeout;

  addToHistory(CURRENT_FILE, CURRENT_PATH, document.getElementById('titleText')?.textContent || CURRENT_FILE);

  fetch('api.php?action=list').then(r => r.json()).then(data => {
    const vid = data.find(v => v.name === CURRENT_FILE);
    if (vid?.title_custom) {
      const tt = document.getElementById('titleText'); if (tt) tt.textContent = vid.title_custom;
      document.title = 'Playing: ' + vid.title_custom;
      addToHistory(CURRENT_FILE, CURRENT_PATH, vid.title_custom);
    }
    const sidebar = document.getElementById('sidebarSuggests');
    if (sidebar) {
      data.filter(v => v.name !== CURRENT_FILE).sort(() => 0.5 - Math.random()).slice(0, 12).forEach(v => {
        const item = document.createElement('a');
        item.className = 'sidebar-item'; item.href = `player.php?path=${encodeURIComponent(v.path)}`;
        const thumbUrl = v.thumbnail_exists ? `api.php?action=thumbnail&file=${encodeURIComponent(v.name)}` : '';
        item.innerHTML = `<div class="thumb">${thumbUrl ? `<img src="${thumbUrl}">` : `<div style="background:#111;width:100%;height:100%;"></div>`}</div><div class="info"><div class="title">${escHtml(v.title_custom || v.name)}</div><div class="meta">${formatBytes(v.size)} · ${v.ext.toUpperCase()}</div></div>`;
        sidebar.appendChild(item);
      });
    }
  });

  const editBtn = document.getElementById('editTitleBtn');
  if (editBtn) editBtn.addEventListener('click', () => {
    const tt = document.getElementById('titleText');
    if (!tt) return;
    const nv = prompt('Sửa tên video:', tt.textContent);
    if (nv && nv.trim() !== tt.textContent) {
      fetch('api.php?action=update_title', { method: 'POST', body: JSON.stringify({ file: CURRENT_FILE, title: nv.trim() }), headers: { 'Content-Type': 'application/json' } })
        .then(r => r.json()).then(res => { if (res.success) { showToast('Đã lưu tên'); tt.textContent = nv.trim(); } });
    }
  });

  const favBtn = document.getElementById('playerFavBtn');
  if (favBtn) {
    if (getFavs().includes(CURRENT_FILE)) { favBtn.style.color = 'var(--accent)'; const s = favBtn.querySelector('svg'); if (s) s.setAttribute('fill', 'currentColor'); }
    favBtn.addEventListener('click', () => {
      const added = toggleFav(CURRENT_FILE);
      favBtn.style.color = added ? 'var(--accent)' : 'white';
      const s = favBtn.querySelector('svg'); if (s) s.setAttribute('fill', added ? 'currentColor' : 'none');
    });
  }

  const playIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  const pauseIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
  function togglePlay() { if (video && video.paused) { video.play(); if (playPauseBtn) playPauseBtn.innerHTML = pauseIcon; } else if (video) { video.pause(); if (playPauseBtn) playPauseBtn.innerHTML = playIcon; } }
  if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);
  if (video) video.addEventListener('click', togglePlay);

  if (video) {
    video.addEventListener('timeupdate', () => { if (!isSeeking && video.duration) { const pct = (video.currentTime / video.duration) * 100; if (seekBarFill) seekBarFill.style.width = pct + '%'; if (currentTimeDisplay) currentTimeDisplay.textContent = formatTime(video.currentTime); } });
    video.addEventListener('loadedmetadata', () => {
      if (durationDisplay) durationDisplay.textContent = formatTime(video.duration);
      const prog = getProgress(CURRENT_PATH);
      if (prog && prog.currentTime > 0 && prog.currentTime < video.duration - 5) { video.currentTime = prog.currentTime; showToast(`Tiếp tục từ ${formatTime(video.currentTime)}`, 'info'); }
    });
  }

  if (seekBarContainer) seekBarContainer.addEventListener('mousedown', e => { isSeeking = true; updateSeek(e); document.addEventListener('mousemove', updateSeek); document.addEventListener('mouseup', stopSeek); });
  function updateSeek(e) { if (!seekBarContainer) return; const r = seekBarContainer.getBoundingClientRect(); let p = (e.clientX - r.left) / r.width; p = Math.max(0, Math.min(1, p)); if (seekBarFill) seekBarFill.style.width = (p * 100) + '%'; if (video && video.duration) video.currentTime = p * video.duration; }
  function stopSeek() { isSeeking = false; document.removeEventListener('mousemove', updateSeek); document.removeEventListener('mouseup', stopSeek); }

  if (volumeSlider) volumeSlider.addEventListener('input', e => { if (video) { video.volume = e.target.value; video.muted = video.volume === 0; updateMuteIcon(); } });
  if (muteBtn) muteBtn.addEventListener('click', () => { if (video) { video.muted = !video.muted; if (!video.muted && video.volume === 0) video.volume = 1; if (volumeSlider) volumeSlider.value = video.muted ? 0 : video.volume; updateMuteIcon(); } });
  function updateMuteIcon() {
    if (!muteBtn || !video) return;
    if (video.muted || video.volume === 0) muteBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
    else muteBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  }

  const speeds = [0.5, 1, 1.25, 1.5, 2]; let speedIdx = 1;
  if (speedBtn) speedBtn.addEventListener('click', () => { speedIdx = (speedIdx + 1) % speeds.length; if (video) video.playbackRate = speeds[speedIdx]; speedBtn.textContent = speeds[speedIdx] + 'x'; });
  if (pipBtn) pipBtn.addEventListener('click', async () => { try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else if (video) await video.requestPictureInPicture(); } catch (e) { showToast('PIP không được hỗ trợ', 'error'); } });
  if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => { if (!document.fullscreenElement) { if (playerWrapper) playerWrapper.requestFullscreen().catch(() => { }); } else document.exitFullscreen(); });

  setInterval(() => { if (video && !video.paused && video.currentTime > 0) localStorage.setItem('video_progress_' + CURRENT_PATH, video.currentTime + '|' + video.duration); }, 4000);
  if (video) video.addEventListener('ended', () => localStorage.removeItem('video_progress_' + CURRENT_PATH));

  function resetHide() { if (playerControls) playerControls.classList.add('active'); clearTimeout(hideTimeout); hideTimeout = setTimeout(() => { if (video && !video.paused) { if (playerControls) playerControls.classList.remove('active'); } }, 2500); }
  if (playerWrapper) {
    playerWrapper.addEventListener('mousemove', resetHide);
    playerWrapper.addEventListener('mouseleave', () => { if (video && !video.paused) { if (playerControls) playerControls.classList.remove('active'); } });
  }
  if (video) {
    video.addEventListener('play', resetHide);
    video.addEventListener('pause', () => { if (playerControls) playerControls.classList.add('active'); });
  }
}
