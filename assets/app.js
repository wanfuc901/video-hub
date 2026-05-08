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
function setFavs(favs) { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); }
function toggleFav(filename) {
    let favs = getFavs();
    if(favs.includes(filename)) { favs = favs.filter(f => f !== filename); showToast('Đã bỏ yêu thích', 'info'); }
    else { favs.push(filename); showToast('Đã thêm vào yêu thích', 'success'); }
    setFavs(favs);
    return favs.includes(filename);
}

function getHistory() { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); }
function addToHistory(filename, path) {
    let hist = getHistory();
    hist = hist.filter(h => h.name !== filename); // remove existing
    hist.unshift({ name: filename, path: path, time: Date.now() }); // add to top
    if(hist.length > 50) hist = hist.slice(0, 50); // limit 50
    localStorage.setItem(HIST_KEY, JSON.stringify(hist));
}

// ---- INDEX.PHP LOGIC ----
if (document.getElementById('videoGrid')) {
    let allVideos = [];
    let currentTab = 'all';

    // Header scroll
    window.addEventListener('scroll', () => {
        if(window.scrollY > 10) document.getElementById('mainHeader').classList.add('scrolled');
        else document.getElementById('mainHeader').classList.remove('scrolled');
    });

    function loadVideos() {
        showLoader();
        fetch('api.php?action=list')
            .then(r => r.json())
            .then(data => {
                hideLoader();
                if(data.error) { showToast(data.error, 'error'); return; }
                allVideos = data;
                renderByTab();
                generateMissingThumbnails();
            }).catch(e => { hideLoader(); showToast('Error loading videos', 'error'); });
    }
    loadVideos();

    // Tabs
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

    // Special header buttons
    document.getElementById('tabFavBtn').addEventListener('click', () => { document.querySelector('[data-tab="favorites"]').click(); });
    document.getElementById('tabHistoryBtn').addEventListener('click', () => { document.querySelector('[data-tab="history"]').click(); });

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        let filtered = getFilteredVideos(currentTab);
        filtered = filtered.filter(v => 
            (v.title_custom || v.name).toLowerCase().includes(term) || 
            v.name.toLowerCase().includes(term)
        );
        renderGrid(filtered);
    });

    function getFilteredVideos(tab) {
        if (tab === 'all') return allVideos;
        if (tab === 'favorites') {
            const favs = getFavs();
            return allVideos.filter(v => favs.includes(v.name));
        }
        if (tab === 'history') {
            const hist = getHistory().map(h => h.name);
            // sort by history order
            let filtered = [];
            hist.forEach(hname => {
                const vid = allVideos.find(v => v.name === hname);
                if(vid) filtered.push(vid);
            });
            return filtered;
        }
        if (tab === 'suggest') {
            return [...allVideos].sort(() => 0.5 - Math.random()).slice(0, 8);
        }
        return allVideos;
    }

    function renderByTab() { renderGrid(getFilteredVideos(currentTab)); }

    function renderGrid(videos) {
        const grid = document.getElementById('videoGrid');
        const empty = document.getElementById('emptyState');
        grid.innerHTML = '';
        if(videos.length === 0) { grid.style.display = 'none'; empty.style.display = 'block'; return; }
        grid.style.display = 'grid'; empty.style.display = 'none';

        const favs = getFavs();

        videos.forEach((v, index) => {
            const isFav = favs.includes(v.name);
            const card = document.createElement('div');
            card.className = 'video-card';
            // Scroll reveal basic
            card.style.opacity = '0';
            card.style.animation = `slideIn 0.4s ease forwards ${index * 0.05}s`;

            const displayName = v.title_custom || v.name;
            const thumbUrl = v.thumbnail_exists ? `api.php?action=thumbnail&file=${encodeURIComponent(v.name)}` : '';
            const progress = localStorage.getItem('video_progress_' + v.path);

            card.innerHTML = `
                <div class="thumbnail-wrapper" onclick="window.location.href='player.php?path=${encodeURIComponent(v.path)}'">
                    ${thumbUrl ? `<img src="${thumbUrl}" alt="Thumb">` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#e0e0e0;color:#999;position:absolute;top:0;width:100%;">No Thumb</div>`}
                    <div class="duration-badge mono-font">${v.ext.toUpperCase()}</div>
                    <button class="fav-btn ${isFav ? 'active' : ''}" data-name="${v.name}" onclick="event.stopPropagation();">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    </button>
                </div>
                ${progress ? `<div class="progress-bar-container"><div class="progress-bar" style="width:50%"></div></div>` : ''}
                <div class="card-info">
                    <div class="video-title" data-name="${v.name}">${displayName}</div>
                    <div class="video-meta">${formatBytes(v.size)}</div>
                </div>
            `;

            grid.appendChild(card);

            // Title inline edit
            const titleEl = card.querySelector('.video-title');
            titleEl.addEventListener('click', (e) => {
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
                input.addEventListener('keydown', (ek) => { if(ek.key === 'Enter') save(); });
            });

            // Fav btn
            card.querySelector('.fav-btn').addEventListener('click', (e) => {
                const isNowFav = toggleFav(v.name);
                const svg = e.currentTarget.querySelector('svg');
                if(isNowFav) { e.currentTarget.classList.add('active'); svg.setAttribute('fill', 'currentColor'); }
                else { e.currentTarget.classList.remove('active'); svg.setAttribute('fill', 'none'); }
                if(currentTab === 'favorites') renderByTab(); // remove instantly if on fav tab
            });
        });
    }

    // Auto generate thumbnails via hidden canvas
    function generateMissingThumbnails() {
        const missing = allVideos.filter(v => !v.thumbnail_exists).slice(0, 5); // process 5 at a time
        if(missing.length === 0) return;

        missing.forEach(v => {
            const video = document.createElement('video');
            video.src = `api.php?action=stream&path=${encodeURIComponent(v.path)}`;
            video.crossOrigin = "anonymous";
            video.currentTime = 3; // 3rd second
            video.muted = true;
            
            video.addEventListener('loadeddata', () => {
                video.addEventListener('seeked', () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 640; canvas.height = 360;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    
                    const fd = new FormData();
                    fd.append('file', v.name);
                    fd.append('image', dataUrl);
                    fetch('api.php?action=upload_thumbnail', { method: 'POST', body: fd })
                        .then(r => r.json()).then(res => {
                            if(res.success) {
                                v.thumbnail_exists = true;
                                renderByTab(); // update UI to show new thumb
                            }
                        });
                }, {once: true});
            });
        });
    }

    // Upload Logic
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

    // History
    if(typeof CURRENT_FILE !== 'undefined') addToHistory(CURRENT_FILE, CURRENT_PATH);

    // Load Title
    fetch('api.php?action=list').then(r=>r.json()).then(data => {
        const vid = data.find(v => v.name === CURRENT_FILE);
        if(vid && vid.title_custom) {
            document.getElementById('titleText').textContent = vid.title_custom;
            document.title = "Playing: " + vid.title_custom;
        }

        // Render Sidebar suggests
        const sidebar = document.getElementById('sidebarSuggests');
        const suggests = data.filter(v => v.name !== CURRENT_FILE).sort(() => 0.5 - Math.random()).slice(0, 10);
        suggests.forEach(v => {
            const item = document.createElement('a');
            item.className = 'sidebar-item';
            item.href = `player.php?path=${encodeURIComponent(v.path)}`;
            const thumbUrl = v.thumbnail_exists ? `api.php?action=thumbnail&file=${encodeURIComponent(v.name)}` : '';
            item.innerHTML = `
                <div class="thumb">${thumbUrl ? `<img src="${thumbUrl}">` : `<div style="background:#333;width:100%;height:100%;"></div>`}</div>
                <div class="info">
                    <div class="title">${v.title_custom || v.name}</div>
                    <div class="meta">${formatBytes(v.size)} • ${v.ext.toUpperCase()}</div>
                </div>
            `;
            sidebar.appendChild(item);
        });
    });

    // Edit Title
    document.getElementById('editTitleBtn').addEventListener('click', () => {
        const titleText = document.getElementById('titleText');
        const current = titleText.textContent;
        const input = document.createElement('input');
        input.type = 'text'; input.value = current;
        input.style.cssText = "background:transparent; border:none; border-bottom:1px solid var(--accent); color:white; font-size:20px; font-family:'Syne'; outline:none; width:300px;";
        titleText.replaceWith(input);
        input.focus();
        const save = () => {
            const newVal = input.value.trim();
            if(newVal && newVal !== current) {
                fetch('api.php?action=update_title', {
                    method:'POST', body: JSON.stringify({file:CURRENT_FILE, title:newVal}), headers:{'Content-Type':'application/json'}
                }).then(r=>r.json()).then(res => {
                    if(res.success) { showToast('Đã lưu tên'); titleText.textContent = newVal; input.replaceWith(titleText); }
                });
            } else { input.replaceWith(titleText); }
        };
        input.addEventListener('blur', save);
        input.addEventListener('keydown', e => { if(e.key==='Enter') save(); });
    });

    // Fav Toggle
    const favBtn = document.getElementById('playerFavBtn');
    const isFav = getFavs().includes(CURRENT_FILE);
    if(isFav) { favBtn.style.color = 'var(--accent)'; favBtn.querySelector('svg').setAttribute('fill', 'currentColor'); }
    favBtn.addEventListener('click', () => {
        const nowFav = toggleFav(CURRENT_FILE);
        if(nowFav) { favBtn.style.color = 'var(--accent)'; favBtn.querySelector('svg').setAttribute('fill', 'currentColor'); }
        else { favBtn.style.color = 'white'; favBtn.querySelector('svg').setAttribute('fill', 'none'); }
    });

    // Player Core Logic
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
        // Resume progress
        const progKey = 'video_progress_' + CURRENT_PATH;
        const saved = localStorage.getItem(progKey);
        if(saved && parseFloat(saved) > 0 && parseFloat(saved) < video.duration - 5) {
            video.currentTime = parseFloat(saved);
            showToast(`Đã tiếp tục từ ${formatTime(video.currentTime)}`, 'info');
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

    // Volume
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

    // Speed
    const speeds = [0.5, 1, 1.25, 1.5, 2];
    let speedIdx = 1;
    speedBtn.addEventListener('click', () => {
        speedIdx = (speedIdx + 1) % speeds.length;
        video.playbackRate = speeds[speedIdx];
        speedBtn.textContent = speeds[speedIdx] + 'x';
    });

    // PIP
    pipBtn.addEventListener('click', async () => {
        try { if(document.pictureInPictureElement) await document.exitPictureInPicture(); else await video.requestPictureInPicture(); } catch(e) { showToast('PIP not supported', 'error'); }
    });

    // Fullscreen
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) playerWrapper.requestFullscreen().catch(err => {});
        else document.exitFullscreen();
    });

    // Save Progress every 5s
    setInterval(() => {
        if(!video.paused && video.currentTime > 0) {
            localStorage.setItem('video_progress_' + CURRENT_PATH, video.currentTime);
        }
    }, 5000);
    video.addEventListener('ended', () => localStorage.removeItem('video_progress_' + CURRENT_PATH));

    // Auto hide controls
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
