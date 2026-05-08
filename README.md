# Video Hub

A lightweight, local PHP video streaming server optimized for Termux on Android.

## Features
- Streams videos from local directories directly to web browser.
- Supports seeking and resuming (watch progress saved locally).
- Real-time search without reloading.
- Responsive dark mode interface.

## Installation on Termux

1. **Install required packages:**
   ```bash
   pkg install php git
   ```
2. **Setup Storage Access:**
   ```bash
   termux-setup-storage
   ```
3. **Clone the repository:**
   ```bash
   cd ~
   git clone https://github.com/wanfuc901/video-hub.git
   cd video-hub
   ```
4. **Start the PHP server:**
   ```bash
   php -S 0.0.0.0:8080
   ```
5. **Access the Web UI:**
   Open a browser on any device in the same network and navigate to `http://<your-android-ip>:8080`.
