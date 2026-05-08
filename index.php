<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Video Hub</title>
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
    <header>
        <h1>Video Hub</h1>
        <div class="header-controls">
            <input type="text" id="searchInput" placeholder="Search videos...">
            <button id="openUploadBtn" class="primary-btn">Upload</button>
        </div>
    </header>
    
    <!-- Upload Modal -->
    <div id="uploadModal" class="modal">
        <div class="modal-content">
            <span class="close-btn" id="closeUploadBtn">&times;</span>
            <h2>Upload Video</h2>
            <form id="uploadForm">
                <div class="form-group">
                    <label for="videoFile">Select Video:</label>
                    <input type="file" id="videoFile" name="video" accept="video/mp4,video/x-m4v,video/*" required>
                </div>
                <button type="submit" id="submitUploadBtn" class="primary-btn">Start Upload</button>
                <div id="uploadStatus"></div>
                <div class="progress-bar-container" id="uploadProgressContainer" style="display:none; height: 10px; margin-top: 15px;">
                    <div class="progress-bar" id="uploadProgressBar" style="width: 0%;"></div>
                </div>
            </form>
        </div>
    </div>

    <main>
        <div class="video-grid" id="videoGrid">
            <!-- Videos will be injected here via JS -->
        </div>
    </main>
    <script src="assets/app.js"></script>
</body>
</html>
