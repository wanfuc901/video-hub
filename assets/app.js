document.addEventListener('DOMContentLoaded', () => {
    const videoGrid = document.getElementById('videoGrid');
    const searchInput = document.getElementById('searchInput');
    let allVideos = [];

    // Fetch video list
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

    // Real-time search
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allVideos.filter(video => video.name.toLowerCase().includes(term));
        renderVideos(filtered);
    });

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

            // Add progress bar if exists in localStorage
            const progressKey = 'video_progress_' + video.path;
            const savedProgress = localStorage.getItem(progressKey);
            // We don't have total duration to calculate percentage accurately here,
            // but we can show a minimal indicator if they started watching
            if (savedProgress) {
                const progContainer = document.createElement('div');
                progContainer.className = 'progress-bar-container';
                const progBar = document.createElement('div');
                progBar.className = 'progress-bar';
                // Just a visual cue that it's partially watched (e.g., 50%)
                progBar.style.width = '50%'; 
                progContainer.appendChild(progBar);
                card.appendChild(progContainer);
            }

            videoGrid.appendChild(card);
        });
    }
});
