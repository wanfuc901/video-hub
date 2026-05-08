<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VHHub</title>
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<link rel="stylesheet" href="assets/style.css?v=<?= time() ?>">
</head>
<body>
<script src="assets/loader.js"></script>
<div id="toastContainer"></div>

<!-- ════════════════ HEADER ════════════════ -->
<header id="mainHeader">
  <a href="index.php" class="logo">
    <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 6l5 10H7l5-10z"/></svg>
    <span class="syne-font">VH<span style="color:var(--accent)">Hub</span></span>
  </a>
  <div class="header-controls">
    <button class="mobile-search-toggle" id="mobileSearchBtn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </button>
    <div class="search-bar" id="searchBarContainer">
      <input type="text" id="searchInput" placeholder="Tìm kiếm video...">
    </div>
    <button class="btn btn-ghost" id="tabHistoryBtn" title="Lịch sử">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    </button>
    <button class="btn btn-ghost" id="tabFavBtn" title="Yêu thích" style="position:relative;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      <span class="fav-count-badge" id="favCount">0</span>
    </button>
    
    <button class="btn btn-ghost" id="deleteManyBtn" title="Xóa nhiều" style="position:relative;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
    </button>
    <button class="btn btn-accent" id="openUploadBtn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Upload
    </button>
  </div>
</header>

<!-- ════════════════ UPLOAD MODAL ════════════════ -->
<div id="uploadModal" class="modal">
  <div class="modal-content" style="max-width:560px;width:95vw;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h2 class="syne-font">Upload Video</h2>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="btn-mini-tool" id="minimizeUploadBtn" title="Chạy nền (Minimize)" style="font-size:20px;cursor:pointer;user-select:none;opacity:0.7;">&minus;</span>
        <span class="close-btn" id="closeUploadBtn" style="position:static;font-size:24px;cursor:pointer;">&times;</span>
      </div>
    </div>
    <div id="uploadDropZone" class="drop-zone">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom:12px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <div style="font-weight:600;margin-bottom:6px;">Kéo thả video vào đây</div>
      <div style="font-size:13px;color:var(--text-gray);">hoặc <span style="color:var(--accent);text-decoration:underline;cursor:pointer;" id="uploadBrowseLink">chọn file</span> · MP4, MKV, AVI, MOV, WEBM</div>
      <input type="file" id="videoFileInput" accept="video/*" multiple style="display:none;">
    </div>
    <!-- Options -->
    <div id="uploadOptions" style="display:none;margin-bottom:12px;padding:12px;background:var(--brand-50);border:1px solid var(--border);">
      <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--brand-900);">Tùy chọn khi file tồn tại:</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <label class="radio-opt"><input type="radio" name="conflictMode" value="ask" checked> <span>Hỏi từng file</span></label>
        <label class="radio-opt"><input type="radio" name="conflictMode" value="overwrite"> <span>Ghi đè tất cả</span></label>
        <label class="radio-opt"><input type="radio" name="conflictMode" value="keepboth"> <span>Giữ cả hai</span></label>
        <label class="radio-opt"><input type="radio" name="conflictMode" value="skip"> <span>Bỏ qua tất cả</span></label>
      </div>
    </div>
    <div id="uploadQueue" style="display:none;max-height:280px;overflow-y:auto;margin-bottom:16px;display:flex;flex-direction:column;gap:8px;"></div>
    <div style="display:flex;gap:10px;">
      <button id="uploadStartBtn" class="btn btn-accent" style="flex:1;display:none;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Bắt đầu upload
      </button>
      <button id="uploadClearBtn" class="btn btn-ghost" style="display:none;">Xóa danh sách</button>
    </div>
    <div id="uploadSummary" style="margin-top:12px;font-size:13px;color:var(--text-gray);text-align:center;"></div>
  </div>
</div>

<!-- ════════════════ CONFLICT DIALOG ════════════════ -->
<div id="conflictDialog" class="overlay-dialog" style="display:none;">
  <div class="dialog-box">
    <div style="font-size:18px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>File đã tồn tại</span>
    </div>
    <div id="conflictFileName" style="font-weight:600;margin-bottom:8px;word-break:break-all;color:var(--accent);"></div>
    <div style="font-size:13px;color:var(--text-gray);margin-bottom:20px;">File này đã có trên server. Bạn muốn làm gì?</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <button id="conflictOverwrite" class="btn btn-accent" style="width:100%;">Ghi đè (Overwrite)</button>
      <button id="conflictKeepBoth" class="btn btn-outline" style="width:100%;">Giữ cả hai (đổi tên tự động)</button>
      <button id="conflictSkip" class="btn btn-ghost" style="width:100%;opacity:0.6;">Bỏ qua file này</button>
    </div>
  </div>
</div>

<!-- ════════════════ DELETE MANY DIALOG ════════════════ -->
<div id="deleteManyDialog" class="overlay-dialog" style="display:none;">
  <div class="dialog-box">
    <div style="font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        <span>Xóa video</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <button id="dmSelecting" class="btn btn-accent" style="width:100%;">Chọn từng video để xóa</button>
      <button id="dmDeleteAll" class="btn btn-outline" style="width:100%;color:var(--error);border-color:var(--error);">Xóa tất cả video</button>
      <button id="dmCancel" class="btn btn-ghost" style="width:100%;">Hủy</button>
    </div>
  </div>
</div>

<!-- ════════════════ CONFIRM DELETE DIALOG ════════════════ -->
<div id="confirmDeleteDialog" class="overlay-dialog" style="display:none;">
  <div class="dialog-box">
    <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Xác nhận xóa</div>
    <div id="confirmDeleteMsg" style="font-size:14px;color:var(--text-gray);margin-bottom:20px;"></div>
    <div style="display:flex;gap:10px;">
      <button id="confirmDeleteOk" class="btn btn-accent" style="flex:1;background:var(--error);">Xóa</button>
      <button id="confirmDeleteCancel" class="btn btn-ghost" style="flex:1;">Hủy</button>
    </div>
  </div>
</div>

<!-- ════════════════ MAIN ════════════════ -->
<main class="container">
  <section class="hero">
    <h1 class="syne-font">Video Hub</h1>
    <p>Your minimalist local video streaming center.</p>
  </section>

  <div class="toolbar-row">
    <div class="tabs" id="mainTabs">
      <div class="tab active" data-tab="all">Tất cả</div>
      <div class="tab" data-tab="favorites">Yêu thích</div>
      <div class="tab" data-tab="history">Đã xem</div>
      <div class="tab" data-tab="suggest">Đề xuất</div>
    </div>
    
    <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
        <!-- View mode toggle -->
        <div class="view-settings" style="display: flex; align-items: center; gap: 12px; border-right: 1px solid var(--border); padding-right: 16px;">
            <label class="radio-opt" style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 13px;">
                <input type="checkbox" id="globalBlurToggle" style="accent-color: var(--accent);">
                <span>Làm mờ ảnh</span>
            </label>
            <div class="view-toggle" id="viewToggle">
                <button class="view-btn active" data-view="grid" title="Lưới">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                </button>
                <button class="view-btn" data-view="list" title="Danh sách">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
                <button class="view-btn" data-view="none" title="Chỉ văn bản">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
            </div>
        </div>
        
        <div class="sort-container">
          <span class="mono-font" style="font-size:13px;color:var(--text-gray);">Sắp xếp:</span>
          <select id="sortSelect">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="az">Tên A-Z</option>
            <option value="za">Tên Z-A</option>
            <option value="largest">Lớn nhất</option>
            <option value="smallest">Nhỏ nhất</option>
          </select>
        </div>
    </div>
  </div>

  <!-- Selection toolbar -->
  <div id="selectionToolbar" style="display:none;align-items:center;gap:12px;padding:12px 0;margin-bottom:8px;border-bottom:1px solid var(--border);">
    <span id="selectionCount" style="font-size:14px;font-weight:600;color:var(--accent);"></span>
    <button id="selectAllBtn" class="btn btn-ghost" style="font-size:13px;">Chọn tất cả</button>
    <button id="deselectAllBtn" class="btn btn-ghost" style="font-size:13px;">Bỏ chọn</button>
    <button id="deleteSelectedBtn" class="btn btn-accent" style="font-size:13px;background:var(--error);margin-left:auto;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      Xóa đã chọn
    </button>
    <button id="cancelSelectBtn" class="btn btn-ghost" style="font-size:13px;">Hủy</button>
  </div>

  <div id="continueWatchingSection" style="display:none;margin-bottom:32px;">
    <h2 class="syne-font" style="font-size:20px;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
      Tiếp tục xem
    </h2>
    <div class="video-grid" id="continueWatchingGrid"></div>
  </div>

  <div class="video-grid" id="videoGrid"></div>

  <div id="emptyState" style="display:none;padding:64px 0;text-align:center;color:var(--text-gray);">
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:16px;opacity:0.3;"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/></svg>
    <p style="font-size:16px;">Không có video nào ở đây.</p>
  </div>
</main>

<script src="assets/app.js?v=<?= time() ?>"></script>
</body>
</html>
="assets/app.js?v=<?= time() ?>"></script>
</body>
</html>
