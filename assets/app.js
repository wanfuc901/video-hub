function showLoader() { }
function updateLoader(pct) { }
function hideLoader() { }

// ============================================================
// MULTI-FILE CHUNKED UPLOADER
// ============================================================
(function () {
    const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB per chunk
    const MAX_PARALLEL = 2;              // upload 2 files đồng thời

    let queue = [];       // { file, id, status, progress, resolve, reject }
    let running = 0;

    // ---- DOM refs ----
    const modal       = document.getElementById('uploadModal');
    const dropZone    = document.getElementById('uploadDropZone');
    const fileInput   = document.getElementById('videoFileInput');
    const browseLink  = document.getElementById('uploadBrowseLink');
    const queueEl     = document.getElementById('uploadQueue');
    const startBtn    = document.getElementById('uploadStartBtn');
    const clearBtn    = document.getElementById('uploadClearBtn');
    const summaryEl   = document.getElementById('uploadSummary');
    const openBtn     = document.getElementById('openUploadBtn');
    const closeBtn    = document.getElementById('closeUploadBtn');
    const conflictDlg = document.getElementById('conflictDialog');

    if (!openBtn) return; // not on index page

    // ---- Modal open/close ----
    openBtn.addEventListener('click', () => { modal.style.display = 'block'; });
    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    function closeModal() {
        if (running > 0) return; // don't close while uploading
        modal.style.display = 'none';
        resetQueue();
    }

    // ---- Drop zone ----
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; dropZone.style.background = 'rgba(124,108,252,0.06)'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; dropZone.style.background = ''; });
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.style.borderColor = ''; dropZone.style.background = '';
        addFiles(Array.from(e.dataTransfer.files));
    });
    dropZone.addEventListener('click', e => { if (e.target !== browseLink) fileInput.click(); });
    browseLink.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
    fileInput.addEventListener('change', () => { addFiles(Array.from(fileInput.files)); fileInput.value = ''; });

    // ---- Add files to queue ----
    function addFiles(files) {
        const videoExts = ['mp4','mkv','avi','mov','webm','m4v','flv','wmv','ts'];
        files.forEach(f => {
            const ext = f.name.split('.').pop().toLowerCase();
            if (!videoExts.includes(ext)) return;
            if (queue.find(q => q.file.name === f.name && q.status === 'pending')) return; // dedupe
            queue.push({ file: f, id: crypto.randomUUID(), status: 'pending', progress: 0, conflictAction: null });
        });
        renderQueue();
    }

    function renderQueue() {
        if (queue.length === 0) {
            queueEl.style.display = 'none';
            startBtn.style.display = 'none';
            clearBtn.style.display = 'none';
            summaryEl.textContent = '';
            return;
        }
        queueEl.style.display = 'flex';
        startBtn.style.display = running > 0 ? 'none' : 'flex';
        clearBtn.style.display = running > 0 ? 'none' : 'block';
        queueEl.innerHTML = queue.map(item => `
            <div id="qi-${item.id}" style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="flex:1;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(item.file.name)}">${escHtml(item.file.name)}</span>
                    <span style="font-size:11px;color:var(--text-gray);white-space:nowrap;">${fmtSize(item.file.size)}</span>
                    <span id="qi-status-${item.id}" style="font-size:11px;font-weight:600;${statusColor(item.status)}">${statusLabel(item.status)}</span>
                    ${item.status === 'pending' ? `<button onclick="removeQueueItem('${item.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-gray);font-size:16px;line-height:1;padding:0 2px;">×</button>` : ''}
                </div>
                <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden;">
                    <div id="qi-bar-${item.id}" style="height:100%;background:var(--accent);width:${item.progress}%;transition:width 0.15s;border-radius:2px;"></div>
                </div>
            </div>
        `).join('');

        const total = queue.length;
        const done  = queue.filter(q => q.status === 'done').length;
        const err   = queue.filter(q => q.status === 'error').length;
        summaryEl.textContent = running > 0
            ? `Đang upload... ${done}/${total} xong`
            : total > 0 ? `${total} file · ${fmtSize(queue.reduce((s,q)=>s+q.file.size,0))}` : '';
    }

    window.removeQueueItem = function(id) {
        queue = queue.filter(q => q.id !== id);
        renderQueue();
    };

    function resetQueue() {
        queue = [];
        renderQueue();
    }

    // ---- Start uploads ----
    startBtn.addEventListener('click', startUploads);
    clearBtn.addEventListener('click', resetQueue);

    async function startUploads() {
        const pending = queue.filter(q => q.status === 'pending');
        if (pending.length === 0) return;
        startBtn.style.display = 'none';
        clearBtn.style.display = 'none';
        running = pending.length;

        // Process with max parallel limit
        const semaphore = new Array(MAX_PARALLEL).fill(null).map(() => Promise.resolve());
        let idx = 0;
        const results = pending.map(() => {
            const slot = idx % MAX_PARALLEL;
            idx++;
            semaphore[slot] = semaphore[slot].then(async () => {
                const item = pending[idx - MAX_PARALLEL + slot] || pending.find(p => p.status === 'pending');
                if (!item || item.status !== 'pending') return;
                await uploadFile(item);
            });
            return semaphore[slot];
        });

        // Simpler sequential-with-parallelism approach
        await uploadQueue(pending);

        running = 0;
        const done = queue.filter(q => q.status === 'done').length;
        const err  = queue.filter(q => q.status === 'error').length;
        summaryEl.textContent = `Hoàn tất: ${done} thành công${err > 0 ? `, ${err} lỗi` : ''}`;
        clearBtn.style.display = 'block';
        if (done > 0) loadVideos();
    }

    async function uploadQueue(items) {
        const active = new Set();
        let i = 0;
        return new Promise(resolve => {
            function next() {
                while (active.size < MAX_PARALLEL && i < items.length) {
                    const item = items[i++];
                    const p = uploadFile(item).finally(() => {
                        active.delete(p);
                        next();
                        if (active.size === 0 && i >= items.length) resolve();
                    });
                    active.add(p);
                }
                if (items.length === 0) resolve();
            }
            next();
        });
    }

    // ---- Conflict resolution ----
    function askConflict(fileName) {
        return new Promise(resolve => {
            document.getElementById('conflictFileName').textContent = fileName;
            conflictDlg.style.display = 'flex';
            const onOverwrite  = () => { cleanup(); resolve('overwrite'); };
            const onKeepBoth   = () => { cleanup(); resolve('keepboth'); };
            const onSkip       = () => { cleanup(); resolve('skip'); };
            document.getElementById('conflictOverwrite').addEventListener('click', onOverwrite,  { once: true });
            document.getElementById('conflictKeepBoth').addEventListener('click', onKeepBoth,   { once: true });
            document.getElementById('conflictSkip').addEventListener('click', onSkip,       { once: true });
            function cleanup() { conflictDlg.style.display = 'none'; }
        });
    }

    // ---- Upload single file via chunks ----
    async function uploadFile(item) {
        item.status = 'checking';
        updateItemUI(item);

        // 1. Check conflict
        const checkRes = await fetch(`api.php?action=check_exists&file=${encodeURIComponent(item.file.name)}`).then(r => r.json()).catch(() => ({ exists: false }));
        let overwrite = false, keepBoth = false;
        if (checkRes.exists) {
            const action = await askConflict(item.file.name);
            if (action === 'skip')     { item.status = 'skipped'; updateItemUI(item); running--; return; }
            if (action === 'overwrite') overwrite = true;
            if (action === 'keepboth') keepBoth = true;
        }

        // 2. Chunked upload
        item.status = 'uploading';
        updateItemUI(item);

        const file       = item.file;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadId   = item.id;

        try {
            for (let ci = 0; ci < totalChunks; ci++) {
                const start = ci * CHUNK_SIZE;
                const chunk = file.slice(start, start + CHUNK_SIZE);

                const fd = new FormData();
                fd.append('chunk', chunk, 'chunk');
                fd.append('fileName', file.name);
                fd.append('chunkIndex', ci);
                fd.append('totalChunks', totalChunks);
                fd.append('uploadId', uploadId);
                fd.append('overwrite', overwrite ? 'true' : 'false');
                fd.append('keepBoth',  keepBoth  ? 'true' : 'false');

                const res = await xhrChunk('api.php?action=upload_chunk', fd, pct => {
                    item.progress = ((ci / totalChunks) + pct / 100 / totalChunks) * 100;
                    updateItemUI(item);
                });

                if (!res.success) throw new Error(res.error || 'Chunk failed');
            }
            item.status = 'done';
            item.progress = 100;
        } catch (e) {
            item.status = 'error';
            item.errorMsg = e.message;
        }
        updateItemUI(item);
        running--;
        renderQueue(); // refresh summary
    }

    function xhrChunk(url, fd, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.upload.onprogress = ev => { if (ev.lengthComputable) onProgress((ev.loaded / ev.total) * 100); };
            xhr.onload = () => {
                try { resolve(JSON.parse(xhr.responseText)); }
                catch (e) { reject(new Error('JSON parse error')); }
            };
            xhr.onerror = () => reject(new Error('Network error'));
            xhr.send(fd);
        });
    }

    function updateItemUI(item) {
        const bar    = document.getElementById(`qi-bar-${item.id}`);
        const status = document.getElementById(`qi-status-${item.id}`);
        if (bar)    bar.style.width = item.progress + '%';
        if (status) { status.textContent = statusLabel(item.status); status.style.cssText = statusColor(item.status); }
        summaryEl.textContent = running > 0 ? `Đang upload... ${queue.filter(q=>q.status==='done').length}/${queue.length} xong` : summaryEl.textContent;
    }

    // ---- Helpers ----
    function statusLabel(s) {
        return { pending:'Chờ', checking:'Kiểm tra', uploading:'Đang up', done:'✓ Xong', error:'✗ Lỗi', skipped:'Bỏ qua' }[s] || s;
    }
    function statusColor(s) {
        const map = { done:'color:#4ade80;', error:'color:#f87171;', uploading:'color:var(--accent);', skipped:'color:var(--text-gray);' };
        return map[s] || 'color:var(--text-gray);';
    }
    function fmtSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024**2) return (bytes/1024).toFixed(1) + ' KB';
        if (bytes < 1024**3) return (bytes/1024**2).toFixed(1) + ' MB';
        return (bytes/1024**3).toFixed(2) + ' GB';
    }
    function escHtml(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})();

function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes) {
    if (!+bytes) return '0 B';
    const k = 1024, dm = 1, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const FAV_KEY = 'vhub_favorites';
const HIST_KEY = 'vhub_history';

function getFavs() { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
function setFavs(favs) { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); updateFavBadge(); }
function toggleFav(filename) {
    let favs = getFavs();
    if(favs.includes(filename)) { favs = favs.filter(f => f !== filename); showToast('Đã xóa khỏi yêu thích', 'info'); }
    else { favs.push(filename); showToast('Đã thêm vào yêu thích', 'success'); }
    setFavs(favs);
    return favs.includes(filename);
}
function updateFavBadge() {
    const badge = document.getElementById('favCount');
    if(badge) badge.textContent = getFavs().length;
}

function getHistory() { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); }
function addToHistory(filename, path, title) {
    let hist = getHistory();
    hist = hist.filter(h => h.name !== filename);
    hist.unshift({ name: filename, path: path, title: title, time: Date.now() });
    if(hist.length > 50) hist = hist.slice(0, 50);
    localStorage.setItem(HIST_KEY, JSON.stringify(hist));
}
function getProgress(path) {
    const p = localStorage.getItem('video_progress_' + path);
    if (!p) return null;
    try {
        const parts = p.split('|');
        if(parts.length === 2) return { currentTime: parseFloat(parts[0]), duration: parseFloat(parts[1]) };
        return { currentTime: parseFloat(p), duration: 0 };
    } catch(e) { return null; }
}

// ---- INDEX.PHP LOGIC ----
if (document.getElementById('videoGrid')) {
    let allVideos = [];
    let currentTab = 'all';
    
    updateFavBadge();

    // Mobile search toggle
    const mobSearchBtn = document.getElementById('mobileSearchBtn');
    const searchBarContainer = document.getElementById('searchBarContainer');
    if (mobSearchBtn) {
        mobSearchBtn.addEventListener('click', () => {
            searchBarContainer.classList.toggle('active');
            if(searchBarContainer.classList.contains('active')) document.getElementById('searchInput').focus();
        });
    }

    window.addEventListener('scroll', () => {
        if(window.scrollY > 10) document.getElementById('mainHeader').classList.add('scrolled');
        else document.getElementById('mainHeader').classList.remove('scrolled');
    });

    function renderSkeleton() {
        const grid = document.getElementById('videoGrid');
        grid.style.display = 'grid';
        document.getElementById('emptyState').style.display = 'none';
        grid.innerHTML = '';
        for(let i=0; i<8; i++) {
            grid.innerHTML += `<div class="skeleton-card skeleton"><div class="thumb skeleton"></div><div class="line1 skeleton"></div><div class="line2 skeleton"></div></div>`;
        }
    }

    function loadVideos() {
        renderSkeleton();
        fetch('api.php?action=list')
            .then(r => r.json())
            .then(data => {
                if(data.error) { showToast(data.error, 'error'); return; }
                allVideos = data;
                renderByTab();
                generateMissingThumbnails();
            }).catch(e => { showToast('Error loading videos', 'error'); });
    }
    loadVideos();

    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(t => {
        t.addEventListener('click', () => {
            tabs.forEach(tx => tx.classList.remove('active'));
            t.classList.add('active');
            currentTab = t.dataset.tab;
            document.getElementById('searchInput').value = '';
            renderByTab();
        });
    });

    document.getElementById('tabFavBtn').addEventListener('click', () => { document.querySelector('[data-tab="favorites"]').click(); });
    document.getElementById('tabHistoryBtn').addEventListener('click', () => { document.querySelector('[data-tab="history"]').click(); });

    document.getElementById('searchInput').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        let filtered = getFilteredVideos(currentTab);
        filtered = filtered.filter(v => 
            (v.title_custom || v.name).toLowerCase().includes(term) || 
            v.name.toLowerCase().includes(term)
        );
        renderGrid(filtered, 'videoGrid');
    });

    document.getElementById('sortSelect').addEventListener('change', () => {
        renderByTab();
    });

    function getFilteredVideos(tab) {
        let filtered = [];
        if (tab === 'all') filtered = [...allVideos];
        else if (tab === 'favorites') {
            const favs = getFavs();
            filtered = allVideos.filter(v => favs.includes(v.name));
        }
        else if (tab === 'history') {
            const hist = getHistory().map(h => h.name);
            hist.forEach(hname => {
                const vid = allVideos.find(v => v.name === hname);
                if(vid) filtered.push(vid);
            });
        }
        else if (tab === 'suggest') {
            filtered = allVideos.filter(v => {
                const prog = getProgress(v.path);
                return !prog || prog.currentTime < 10;
            }).sort(() => 0.5 - Math.random()).slice(0, 8);
        }

        if (tab === 'all' || tab === 'favorites') {
            const sortVal = document.getElementById('sortSelect').value;
            filtered.sort((a, b) => {
                if(sortVal === 'newest') return b.mtime - a.mtime;
                if(sortVal === 'oldest') return a.mtime - b.mtime;
                if(sortVal === 'largest') return b.size - a.size;
                if(sortVal === 'smallest') return a.size - b.size;
                const nameA = (a.title_custom || a.name).toLowerCase();
                const nameB = (b.title_custom || b.name).toLowerCase();
                if(sortVal === 'az') return nameA.localeCompare(nameB);
                if(sortVal === 'za') return nameB.localeCompare(nameA);
                return 0;
            });
        }
        return filtered;
    }

    function renderByTab() { 
        renderGrid(getFilteredVideos(currentTab), 'videoGrid'); 
        
        const cwSec = document.getElementById('continueWatchingSection');
        if(currentTab === 'all' && !document.getElementById('searchInput').value) {
            let cwVids = allVideos.filter(v => {
                const prog = getProgress(v.path);
                if(prog && prog.duration > 0) {
                    const pct = (prog.currentTime / prog.duration) * 100;
                    return pct >= 10 && pct <= 90;
                }
                return false;
            });
            // Sort by history time
            const hist = getHistory();
            cwVids.sort((a, b) => {
                const ha = hist.find(h => h.name === a.name);
                const hb = hist.find(h => h.name === b.name);
                return (hb ? hb.time : 0) - (ha ? ha.time : 0);
            });
            cwVids = cwVids.slice(0, 4);
            
            if(cwVids.length > 0) {
                cwSec.style.display = 'block';
                renderGrid(cwVids, 'continueWatchingGrid', true);
            } else {
                cwSec.style.display = 'none';
            }
        } else {
            cwSec.style.display = 'none';
        }
    }

    function renderGrid(videos, targetId, isCompact = false) {
        const grid = document.getElementById(targetId);
        const empty = document.getElementById('emptyState');
        grid.innerHTML = '';
        if(videos.length === 0 && targetId === 'videoGrid') { grid.style.display = 'none'; empty.style.display = 'block'; return; }
        if(targetId === 'videoGrid') { grid.style.display = 'grid'; empty.style.display = 'none'; }

        const favs = getFavs();

        videos.forEach((v, index) => {
            const isFav = favs.includes(v.name);
            const card = document.createElement('div');
            card.className = 'video-card';
            card.style.opacity = '0';
            card.style.animation = `slideIn 0.4s ease forwards ${index * 0.05}s`;

            const displayName = v.title_custom || v.name;
            const thumbUrl = v.thumbnail_exists ? `api.php?action=thumbnail&file=${encodeURIComponent(v.name)}` : '';
            const prog = getProgress(v.path);
            let pct = 0;
            let isWatched = false;
            if(prog && prog.duration > 0) {
                pct = (prog.currentTime / prog.duration) * 100;
                if(pct > 90) isWatched = true;
            }

            card.innerHTML = `
                <div class="thumbnail-wrapper" onclick="window.location.href='player.php?path=${encodeURIComponent(v.path)}'">
                    ${thumbUrl ? `<img src="${thumbUrl}" alt="Thumb">` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#111;color:#666;position:absolute;top:0;width:100%;">No Thumb</div>`}
                    ${isWatched ? `<div class="watched-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>` : ''}
                    <div class="duration-badge mono-font">${v.ext.toUpperCase()}</div>
                    <button class="fav-btn ${isFav ? 'active' : ''}" data-name="${v.name}" onclick="event.stopPropagation();">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    </button>
                </div>
                ${pct > 0 ? `<div class="progress-bar-container"><div class="progress-bar" style="width:${pct}%"></div></div>` : ''}
                <div class="card-info">
                    <div class="video-title" data-name="${v.name}" style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <span style="flex:1; padding-right:8px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;" title="${displayName}">${displayName}</span>
                        <button class="edit-title-btn-small" style="background:none; border:none; cursor:pointer; color:var(--text-gray);" title="Sửa tên">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                    </div>
                    <div class="video-meta">${formatBytes(v.size)}</div>
                </div>
            `;

            grid.appendChild(card);

            const titleEl = card.querySelector('.video-title');
            const editBtn = titleEl.querySelector('.edit-title-btn-small');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const input = document.createElement('input');
                input.className = 'title-edit-input';
                input.value = displayName;
                titleEl.replaceWith(input);
                input.focus();
                
                const save = () => {
                    const newVal = input.value.trim();
                    if(newVal && newVal !== displayName) {
                        fetch('api.php?action=update_title', {
                            method: 'POST', body: JSON.stringify({file: v.name, title: newVal}),
                            headers: {'Content-Type': 'application/json'}
                        }).then(r=>r.json()).then(res => {
                            if(res.success) { showToast('Đã lưu tên'); v.title_custom = newVal; renderByTab(); }
                        });
                    } else {
                        renderByTab();
                    }
                };
                input.addEventListener('blur', save);
                input.addEventListener('keydown', (ek) => { if(ek.key === 'Enter') save(); if(ek.key === 'Escape') renderByTab(); });
            });

            card.querySelector('.fav-btn').addEventListener('click', (e) => {
                const isNowFav = toggleFav(v.name);
                const svg = e.currentTarget.querySelector('svg');
                if(isNowFav) { e.currentTarget.classList.add('active'); svg.setAttribute('fill', 'currentColor'); }
                else { e.currentTarget.classList.remove('active'); svg.setAttribute('fill', 'none'); }
                if(currentTab === 'favorites') renderByTab();
            });
        });
    }

    function generateMissingThumbnails() {
        const missing = allVideos.filter(v => !v.thumbnail_exists).slice(0, 5);
        if (missing.length === 0) return;
        missing.forEach((v, idx) => {
            setTimeout(() => {
                const video = document.createElement('video');
                video.crossOrigin = 'anonymous';
                video.muted = true;
                video.playsInline = true;
                video.preload = 'auto'; 
                video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;top:-9999px;width:160px;height:90px;';
                document.body.appendChild(video);
                
                const cleanup = () => { try { video.pause(); video.src = ''; video.parentNode?.removeChild(video); } catch(e){} };
                let captured = false;

                const captureFrame = () => {
                    if (captured) return;
                    if (video.videoWidth === 0) return;
                    
                    try {
                        const canvas = document.createElement('canvas');
                        const maxDim = 640;
                        let w = video.videoWidth;
                        let h = video.videoHeight;
                        if (w > h) {
                            if (w > maxDim) { h = h * (maxDim / w); w = maxDim; }
                        } else {
                            if (h > maxDim) { w = w * (maxDim / h); h = maxDim; }
                        }
                        canvas.width = w;
                        canvas.height = h;
                        
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(video, 0, 0, w, h);
                        
                        // Check center pixel for black frame
                        const pixel = ctx.getImageData(w/2, h/2, 1, 1).data;
                        if (pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0 && pixel[3] === 255) {
                            if (video.currentTime < 10) {
                                video.currentTime = Math.min(video.duration * 0.3, 15);
                                return;
                            }
                        }

                        captured = true;
                        canvas.toBlob(blob => {
                            const fd = new FormData();
                            fd.append('file', v.name);
                            fd.append('image', canvas.toDataURL('image/jpeg', 0.85));
                            fetch('api.php?action=upload_thumbnail', { method: 'POST', body: fd })
                                .then(r => r.json()).then(res => {
                                    if (res.success) {
                                        v.thumbnail_exists = true;
                                        const img = document.querySelector(`[data-file="${CSS.escape(v.name)}"] .thumbnail-wrapper img`);
                                        if (img) img.src = `api.php?action=thumbnail&file=${encodeURIComponent(v.name)}&t=${Date.now()}`;
                                        else renderByTab();
                                    }
                                    cleanup();
                                }).catch(cleanup);
                        }, 'image/jpeg', 0.85);
                    } catch(e) {
                        console.warn('Thumbnail capture failed for', v.name, e);
                        cleanup();
                    }
                };

                video.addEventListener('loadedmetadata', () => {
                    const seekTo = Math.min(video.duration * 0.1, 5);
                    video.currentTime = seekTo > 0 ? seekTo : 1;
                });
                
                video.addEventListener('seeked', () => {
                    setTimeout(captureFrame, 300);
                });

                video.addEventListener('error', (e) => {
                    console.warn('Video load error for thumbnail:', v.name, e);
                    cleanup();
                });
                
                video.src = `api.php?action=stream&path=${encodeURIComponent(v.path)}`;
                video.load();
            }, idx * 800);
        });
    }
}

// ---- PLAYER.PHP LOGIC ----
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

    let isSeeking = false;
    let hideControlsTimeout;
    
    // Save history
    addToHistory(CURRENT_FILE, CURRENT_PATH, document.getElementById('titleText').textContent);

    fetch('api.php?action=list').then(r=>r.json()).then(data => {
        const vid = data.find(v => v.name === CURRENT_FILE);
        if(vid && vid.title_custom) {
            document.getElementById('titleText').textContent = vid.title_custom;
            document.title = "Playing: " + vid.title_custom;
            addToHistory(CURRENT_FILE, CURRENT_PATH, vid.title_custom);
        }

        const sidebar = document.getElementById('sidebarSuggests');
        const suggests = data.filter(v => v.name !== CURRENT_FILE).sort(() => 0.5 - Math.random()).slice(0, 10);
        suggests.forEach(v => {
            const item = document.createElement('a');
            item.className = 'sidebar-item';
            item.href = `player.php?path=${encodeURIComponent(v.path)}`;
            const thumbUrl = v.thumbnail_exists ? `api.php?action=thumbnail&file=${encodeURIComponent(v.name)}` : '';
            item.innerHTML = `
                <div class="thumb">${thumbUrl ? `<img src="${thumbUrl}">` : `<div style="background:#111;width:100%;height:100%;"></div>`}</div>
                <div class="info">
                    <div class="title">${v.title_custom || v.name}</div>
                    <div class="meta">${formatBytes(v.size)} • ${v.ext.toUpperCase()}</div>
                </div>
            `;
            sidebar.appendChild(item);
        });
    });

    document.getElementById('editTitleBtn').addEventListener('click', () => {
        const titleText = document.getElementById('titleText');
        const current = titleText.textContent;
        const newVal = prompt("Sửa tên video:", current);
        if(newVal && newVal.trim() !== current) {
            fetch('api.php?action=update_title', {
                method:'POST', body: JSON.stringify({file:CURRENT_FILE, title:newVal.trim()}), headers:{'Content-Type':'application/json'}
            }).then(r=>r.json()).then(res => {
                if(res.success) { showToast('Đã lưu tên'); titleText.textContent = newVal.trim(); }
            });
        }
    });

    const favBtn = document.getElementById('playerFavBtn');
    const isFav = getFavs().includes(CURRENT_FILE);
    if(isFav) { favBtn.style.color = 'var(--accent)'; favBtn.querySelector('svg').setAttribute('fill', 'currentColor'); }
    favBtn.addEventListener('click', () => {
        const nowFav = toggleFav(CURRENT_FILE);
        if(nowFav) { favBtn.style.color = 'var(--accent)'; favBtn.querySelector('svg').setAttribute('fill', 'currentColor'); }
        else { favBtn.style.color = 'white'; favBtn.querySelector('svg').setAttribute('fill', 'none'); }
    });

    const playIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    const pauseIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;

    function togglePlay() {
        if(video.paused) { video.play(); playPauseBtn.innerHTML = pauseIcon; }
        else { video.pause(); playPauseBtn.innerHTML = playIcon; }
    }
    playPauseBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);

    video.addEventListener('timeupdate', () => {
        if(!isSeeking && video.duration) {
            const pct = (video.currentTime / video.duration) * 100;
            seekBarFill.style.width = pct + '%';
            currentTimeDisplay.textContent = formatTime(video.currentTime);
        }
    });

    video.addEventListener('loadedmetadata', () => {
        durationDisplay.textContent = formatTime(video.duration);
        const prog = getProgress(CURRENT_PATH);
        if(prog && prog.currentTime > 0 && prog.currentTime < video.duration - 5) {
            video.currentTime = prog.currentTime;
            showToast(`Tiếp tục từ ${formatTime(video.currentTime)}`, 'info');
        }
    });

    seekBarContainer.addEventListener('mousedown', (e) => {
        isSeeking = true;
        updateSeek(e);
        document.addEventListener('mousemove', updateSeek);
        document.addEventListener('mouseup', stopSeek);
    });

    function updateSeek(e) {
        const rect = seekBarContainer.getBoundingClientRect();
        let pos = (e.clientX - rect.left) / rect.width;
        pos = Math.max(0, Math.min(1, pos));
        seekBarFill.style.width = (pos * 100) + '%';
        if(video.duration) video.currentTime = pos * video.duration;
    }
    function stopSeek() {
        isSeeking = false;
        document.removeEventListener('mousemove', updateSeek);
        document.removeEventListener('mouseup', stopSeek);
    }

    volumeSlider.addEventListener('input', (e) => {
        video.volume = e.target.value;
        video.muted = video.volume === 0;
        updateMuteIcon();
    });
    muteBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        if(!video.muted && video.volume === 0) video.volume = 1;
        volumeSlider.value = video.muted ? 0 : video.volume;
        updateMuteIcon();
    });
    function updateMuteIcon() {
        if(video.muted || video.volume === 0) muteBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
        else muteBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
    }

    const speeds = [0.5, 1, 1.25, 1.5, 2];
    let speedIdx = 1;
    speedBtn.addEventListener('click', () => {
        speedIdx = (speedIdx + 1) % speeds.length;
        video.playbackRate = speeds[speedIdx];
        speedBtn.textContent = speeds[speedIdx] + 'x';
    });

    pipBtn.addEventListener('click', async () => {
        try { if(document.pictureInPictureElement) await document.exitPictureInPicture(); else await video.requestPictureInPicture(); } catch(e) { showToast('PIP not supported', 'error'); }
    });

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) playerWrapper.requestFullscreen().catch(err => {});
        else document.exitFullscreen();
    });

    setInterval(() => {
        if(!video.paused && video.currentTime > 0) {
            localStorage.setItem('video_progress_' + CURRENT_PATH, video.currentTime + '|' + video.duration);
        }
    }, 5000);
    video.addEventListener('ended', () => localStorage.removeItem('video_progress_' + CURRENT_PATH));

    function resetHideControls() {
        playerControls.classList.add('active');
        clearTimeout(hideControlsTimeout);
        hideControlsTimeout = setTimeout(() => { if(!video.paused) playerControls.classList.remove('active'); }, 3000);
    }
    playerWrapper.addEventListener('mousemove', resetHideControls);
    playerWrapper.addEventListener('mouseleave', () => { if(!video.paused) playerControls.classList.remove('active'); });
    video.addEventListener('play', resetHideControls);
    video.addEventListener('pause', () => playerControls.classList.add('active'));
}