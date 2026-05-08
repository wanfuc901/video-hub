<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Video Hub</title>
    <link rel="stylesheet" href="assets/style.css?v=<?= time() ?>">
</head>
<body>
    <div id="pageLoader"><div class="bar"></div></div>
    <div id="toastContainer"></div>

    <header id="mainHeader">
        <a href="index.php" class="logo">
            <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 6l5 10H7l5-10z"/></svg>
            <span class="syne-font">VH<span style="color:var(--brand-900)">Hub</span></span>
        </a>
        <div class="header-controls">
            <button class="mobile-search-toggle" id="mobileSearchBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <div class="search-bar" id="searchBarContainer">
                <input type="text" id="searchInput" placeholder="Search videos...">
            </div>
            <button class="btn btn-ghost" id="tabHistoryBtn" title="Lịch sử">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </button>
            <button class="btn btn-ghost" id="tabFavBtn" title="Yêu thích" style="position: relative;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span class="fav-count-badge" id="favCount">0</span>
            </button>
            <button class="btn btn-accent" id="openUploadBtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload
            </button>
        </div>
    </header>
    
    <div id="uploadModal" class="modal">
        <div class="modal-content">
            <span class="close-btn" id="closeUploadBtn">&times;</span>
            <h2 class="syne-font" style="margin-bottom:20px;">Upload Video</h2>
            <form id="uploadForm">
                <div style="margin-bottom: 20px;">
                    <label style="display:block; margin-bottom:8px; font-weight:500;">Select Video (Max 10GB):</label>
                    <input type="file" id="videoFile" name="video" accept="video/*" required style="width:100%; padding:10px; border:1px dashed var(--border);">
                </div>
                <button type="submit" id="submitUploadBtn" class="btn btn-primary" style="width:100%;">Start Upload</button>
                <div id="uploadStatus" style="margin-top: 10px; font-size:14px; text-align:center;"></div>
                <div class="progress-bar-container" id="uploadProgressContainer" style="display:none; height: 4px; margin-top: 15px; background:var(--border);">
                    <div class="progress-bar" id="uploadProgressBar" style="width: 0%; background:var(--accent);"></div>
                </div>
            </form>
        </div>
    </div>

    <main class="container">
        <section class="hero">
            <h1 class="syne-font">Video Hub</h1>
            <p>Your minimalist local video streaming center.</p>
        </section>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
            <div class="tabs" id="mainTabs" style="margin-bottom: 0; border-bottom: none; display: flex; gap: 24px;">
                <div class="tab active" data-tab="all">Tất cả</div>
                <div class="tab" data-tab="favorites">Yêu thích</div>
                <div class="tab" data-tab="history">Đã xem gần đây</div>
                <div class="tab" data-tab="suggest">Đề xuất</div>
            </div>
            <div class="sort-container" style="display: flex; align-items: center; gap: 8px;">
                <span class="mono-font" style="font-size: 14px; color: var(--text-gray);">Sắp xếp:</span>
                <select id="sortSelect" style="padding: 8px 12px; border: 1px solid var(--border); border-radius: 0; font-family: 'DM Sans'; outline: none; background: var(--white); color: var(--brand-900); cursor: pointer;">
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="az">Tên (A-Z)</option>
                    <option value="za">Tên (Z-A)</option>
                    <option value="largest">Dung lượng (Lớn nhất)</option>
                    <option value="smallest">Dung lượng (Nhỏ nhất)</option>
                </select>
            </div>
        </div>

        <div id="continueWatchingSection" style="display: none; margin-bottom: 32px;">
            <h2 class="syne-font" style="font-size: 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
                Tiếp tục xem
            </h2>
            <div class="video-grid" id="continueWatchingGrid"></div>
        </div>

        <div class="video-grid" id="videoGrid">
            <!-- Videos injected via JS -->
        </div>
        <div id="emptyState" style="display:none; padding:48px 0; text-align:center; color:var(--text-gray);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:16px; opacity:0.5;"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
            <p>Không có video nào ở đây.</p>
        </div>
    </main>
    <script src="assets/app.js?v=<?= time() ?>"></script>
</body>
</html>
