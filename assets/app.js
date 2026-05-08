document.addEventListener('DOMContentLoaded', () => {
    const videoGrid = document.getElementById('videoGrid');
    const searchInput = document.getElementById('searchInput');
    let allVideos = [];

    // Upload Elements
    const uploadModal = document.getElementById('uploadModal');
    const openUploadBtn = document.getElementById('openUploadBtn');
    const closeUploadBtn = document.getElementById('closeUploadBtn');
    const uploadForm = document.getElementById('uploadForm');
    const submitUploadBtn = document.getElementById('submitUploadBtn');
    const uploadStatus = document.getElementById('uploadStatus');
    const uploadProgressContainer = document.getElementById('uploadProgressContainer');
    const uploadProgressBar = document.getElementById('uploadProgressBar');

    // Fetch video list
    function loadVideos() {
        fetch('api.php?action=list')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    videoGrid.innerHTML = `<p>${data.error}</p>`;
                    return;
                }
                allVideos = data;
                renderVideos(allVideos);
            })
            .catch(error => {
                console.error('Error fetching videos:', error);
                videoGrid.innerHTML = '<p>Failed to load videos.</p>';
            });
    }

    loadVideos();

    // Real-time search
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allVideos.filter(video => video.name.toLowerCase().includes(term));
        renderVideos(filtered);
    });

    // Modal Logic
    if (openUploadBtn) {
        openUploadBtn.addEventListener('click', () => {
            uploadModal.style.display = 'block';
            uploadStatus.textContent = '';
            uploadForm.reset();
            uploadProgressContainer.style.display = 'none';
        });
    }

    if (closeUploadBtn) {
        closeUploadBtn.addEventListener('click', () => {
            uploadModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target == uploadModal) {
            uploadModal.style.display = 'none';
        }
    });

    // Upload Logic
    if (uploadForm) {
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('videoFile');
            const file = fileInput.files[0];
            if (!file) return;

            submitUploadBtn.disabled = true;
            uploadStatus.textContent = 'Uploading...';
            uploadStatus.style.color = '#ccc';
            uploadProgressContainer.style.display = 'block';
            uploadProgressBar.style.width = '0%';

            const formData = new FormData();
            formData.append('video', file);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'api.php?action=upload', true);

            xhr.upload.onprogress = function(e) {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    uploadProgressBar.style.width = percentComplete + '%';
                }
            };

            xhr.onload = function() {
                submitUploadBtn.disabled = false;
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            uploadStatus.textContent = 'Upload complete!';
                            uploadStatus.style.color = '#4ade80';
                            setTimeout(() => {
                                uploadModal.style.display = 'none';
                                loadVideos(); // Refresh list
                            }, 1500);
                        } else {
                            uploadStatus.textContent = 'Error: ' + response.error;
                            uploadStatus.style.color = '#f87171';
                        }
                    } catch (err) {
                        uploadStatus.textContent = 'Invalid response from server.';
                        uploadStatus.style.color = '#f87171';
                    }
                } else {
                    let errMsg = 'Upload failed. Status: ' + xhr.status;
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if(response.error) errMsg = response.error;
                    } catch(e) {}
                    uploadStatus.textContent = errMsg;
                    uploadStatus.style.color = '#f87171';
                }
            };

            xhr.onerror = function() {
                submitUploadBtn.disabled = false;
                uploadStatus.textContent = 'Network error occurred during upload.';
                uploadStatus.style.color = '#f87171';
            };

            xhr.send(formData);
        });
    }

    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    function renderVideos(videos) {
        videoGrid.innerHTML = '';
        if (videos.length === 0) {
            videoGrid.innerHTML = '<p>No videos found.</p>';
            return;
        }

        videos.forEach(video => {
            const card = document.createElement('a');
            card.href = `player.php?path=${encodeURIComponent(video.path)}`;
            card.className = 'video-card';

            const title = document.createElement('div');
            title.className = 'video-title';
            title.textContent = video.name;

            const meta = document.createElement('div');
            meta.className = 'video-meta';
            meta.textContent = `${video.ext.toUpperCase()} • ${formatBytes(video.size)}`;

            card.appendChild(title);
            card.appendChild(meta);

            const progressKey = 'video_progress_' + video.path;
            const savedProgress = localStorage.getItem(progressKey);
            if (savedProgress) {
                const progContainer = document.createElement('div');
                progContainer.className = 'progress-bar-container';
                const progBar = document.createElement('div');
                progBar.className = 'progress-bar';
                progBar.style.width = '50%'; 
                progContainer.appendChild(progBar);
                card.appendChild(progContainer);
            }

            videoGrid.appendChild(card);
        });
    }
});