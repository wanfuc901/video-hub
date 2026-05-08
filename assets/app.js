function showLoader() { document.getElementById('pageLoader').style.display = 'block'; document.querySelector('#pageLoader .bar').style.width = '30%'; }
function updateLoader(pct) { document.querySelector('#pageLoader .bar').style.width = pct + '%'; }
function hideLoader() { document.querySelector('#pageLoader .bar').style.width = '100%'; setTimeout(() => { document.getElementById('pageLoader').style.display = 'none'; }, 200); }

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
        const missing = allVideos.filter(v => !v.thumbnail_exists).slice(0, 3);
        if(missing.length === 0) return;

        missing.forEach(v => {
            const video = document.createElement('video');
            video.src = `api.php?action=stream&path=${encodeURIComponent(v.path)}`;
            video.preload = 'auto'; 
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('webkit-playsinline', 'true');
            video.style.display = 'none';
            document.body.appendChild(video);

            const cleanup = () => { if(video.parentNode) video.parentNode.removeChild(video); };

            video.addEventListener('loadedmetadata', () => {
                video.currentTime = Math.min(3, video.duration / 2 || 1);
            });

            video.addEventListener('seeked', () => {
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
                    
                    canvas.width = w || 640;
                    canvas.height = h || 360;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    
                    const fd = new FormData();
                    fd.append('file', v.name);
                    fd.append('image', dataUrl);
                    fetch('api.php?action=upload_thumbnail', { method: 'POST', body: fd })
                        .then(r => r.json()).then(res => {
                            if(res.success) {
                                v.thumbnail_exists = true;
                                renderByTab(); 
                            }
                            cleanup();
                        }).catch(cleanup);
                } catch(e) { cleanup(); }
            });
            video.addEventListener('error', cleanup);
            video.load();
        });
    }

    const uploadModal = document.getElementById('uploadModal');
    if (document.getElementById('openUploadBtn')) {
        document.getElementById('openUploadBtn').addEventListener('click', () => {
            uploadModal.style.display = 'block';
            document.getElementById('uploadStatus').textContent = '';
            document.getElementById('uploadForm').reset();
            document.getElementById('uploadProgressContainer').style.display = 'none';
        });
        document.getElementById('closeUploadBtn').addEventListener('click', () => uploadModal.style.display = 'none');
        window.addEventListener('click', (e) => { if (e.target == uploadModal) uploadModal.style.display = 'none'; });

        document.getElementById('uploadForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const file = document.getElementById('videoFile').files[0];
            if (!file) return;

            const btn = document.getElementById('submitUploadBtn');
            const status = document.getElementById('uploadStatus');
            const pCont = document.getElementById('uploadProgressContainer');
            const pBar = document.getElementById('uploadProgressBar');

            btn.disabled = true; status.textContent = 'Uploading...'; status.style.color = 'var(--text-gray)';
            pCont.style.display = 'block'; pBar.style.width = '0%';

            const fd = new FormData(); fd.append('video', file);
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'api.php?action=upload', true);

            xhr.upload.onprogress = (ev) => {
                if (ev.lengthComputable) {
                    const pct = (ev.loaded / ev.total) * 100;
                    pBar.style.width = pct + '%';
                }
            };
            xhr.onload = () => {
                btn.disabled = false;
                if (xhr.status === 200) {
                    try {
                        const res = JSON.parse(xhr.responseText);
                        if (res.success) {
                            status.textContent = 'Upload thành công!'; status.style.color = 'var(--success)';
                            setTimeout(() => { uploadModal.style.display = 'none'; loadVideos(); }, 1500);
                        } else { status.textContent = 'Lỗi: ' + res.error; status.style.color = 'var(--error)'; }
                    } catch (e) { status.textContent = 'Lỗi phản hồi'; status.style.color = 'var(--error)'; }
                } else { status.textContent = 'Lỗi server: ' + xhr.status; status.style.color = 'var(--error)'; }
            };
            xhr.onerror = () => { btn.disabled = false; status.textContent = 'Lỗi mạng'; status.style.color = 'var(--error)'; };
            xhr.send(fd);
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