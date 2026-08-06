# 🎵 MP3Master

A modern, high-performance, minimalist personal web application for searching and downloading high-quality MP3 audio from **YouTube**, **Spotify**, and **Apple Music** with automatic 1:1 square album cover art cropping and ID3 tag metadata embedding.

![MP3Master Light Mode](https://raw.githubusercontent.com/harshit-911/MP3Master/main/public/preview.png)

---

## ✨ Key Features

- **🚀 Smart Song Search**: Search for any track title or artist name, and MP3Master will automatically match and convert the highest quality YouTube audio stream.
- **🟢 Zero-API Spotify & Apple Music Importer**: Paste any public **Spotify** or **Apple Music** playlist, album, or track link to extract the entire track list and download as MP3s without needing API keys.
- **🖼️ 1:1 Square Album Cover Art**: Automatically crops widescreen YouTube thumbnails into standard 1:1 square album art using FFmpeg filters (`crop=ih:ih`) and embeds them into the MP3's ID3 metadata container.
- **⚡ Sequential Batch & ZIP Downloader**: Download multi-track playlists in one click. Tracks inside the ZIP archive are cleanly formatted and numbered (e.g. `01. Artist - Track Name.mp3`).
- **🎯 High-Precision Track Matcher**: Prioritizes YouTube Music official topic channels (`Artist - Topic`), matches exact song duration (±5s tolerance), and filters out live bootlegs or compilation noise.
- **🛡️ Resilient Fallback System**: Automatically catches geo-restrictions or postprocessing errors and retries gracefully to guarantee 100% download reliability.
- **🎚️ Variable Bitrate Quality**: Choose between **320kbps (Extreme Quality)**, **256kbps**, **192kbps**, and **128kbps**.
- **☀️ Light & Dark Mode**: Beautiful minimalist interface with default Light mode and a one-click Dark mode toggle.

---

## 📋 Prerequisites

Before running MP3Master, ensure your system has the following installed:

1. **Node.js**: v18.0.0 or higher
2. **System Binaries**: `yt-dlp` and `ffmpeg`

### Installing System Dependencies

#### macOS (via Homebrew)
```bash
brew install yt-dlp ffmpeg
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install ffmpeg
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

#### Windows (via Chocolatey / Scoop)
```powershell
choco install yt-dlp ffmpeg
```

---

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/harshit-911/MP3Master.git
cd MP3Master
```

### 2. Install Node Dependencies
```bash
npm install
```

### 3. Start the Development Server
```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser to start using MP3Master!

---

## 🏗️ Production Build

To compile an optimized production build:

```bash
npm run build
npm start
```

---

## 📁 Project Architecture

```
MP3Master/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── batch-download/  # Sequential playlist download & ZIP stream
│   │   │   ├── download/        # SSE progress & single track downloader
│   │   │   ├── file/[id]/       # MP3 & ZIP file delivery endpoint
│   │   │   ├── health/          # System binary detector (yt-dlp & ffmpeg)
│   │   │   ├── info/            # YouTube, Spotify & Apple Music metadata parser
│   │   │   └── search/          # YouTube song search API
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx             # Main application page
│   ├── components/              # UI components (Header, UrlDropInput, VideoPreviewCard, ProgressCard, DownloadHistory)
│   └── lib/                     # Core helper modules
│       ├── musicImporter.ts     # Spotify & Apple Music parser
│       ├── types.ts             # TypeScript interfaces
│       ├── utils.ts             # URL parsers & sanitization
│       └── ytdlp.ts             # yt-dlp & FFmpeg execution wrapper
├── public/                      # Static assets
├── README.md
├── package.json
└── tailwind.config.js
```

---

## 📜 License

This project is open-source and intended for personal educational and offline media archiving use. Please respect copyright laws and terms of service of content providers.
