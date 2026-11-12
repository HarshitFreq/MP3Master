# 🎵 MP3Master

> Fast, clean MP3 downloader for YouTube, Spotify, and Apple Music.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![yt-dlp](https://img.shields.io/badge/yt--dlp-latest-red?style=flat-square)](https://github.com/yt-dlp/yt-dlp)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-latest-green?style=flat-square&logo=ffmpeg)](https://ffmpeg.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

---

## Features

- **Multi-Platform**: Download from YouTube, Spotify, and Apple Music.
- **Zero API Keys**: Paste any playlist, album, or track link directly.
- **Uncapped Playlists**: Full batch downloads without the 100-track Spotify limit.
- **Studio Album Art**: Embeds original high-res square covers (640×640+ / 1200×1200) into MP3 ID3 tags.
- **Clean Names**: Preserves original track titles without numeric prefixes (`01.`, `02.`) or underscores.
- **Ordered ZIP Export**: Packages entire playlists into a single archive matching the original tracklist order.
- **Selectable Quality**: Choose between 128kbps, 192kbps, 256kbps, and 320kbps.
- **Real-Time Progress**: Live download and conversion stream powered by Server-Sent Events (SSE).

---

## Prerequisites

- **Node.js** 18+
- **yt-dlp** and **ffmpeg**

```bash
# macOS
brew install yt-dlp ffmpeg

# Linux (Ubuntu / Debian)
sudo apt update && sudo apt install ffmpeg
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp

# Windows
choco install yt-dlp ffmpeg
```

---

## Quick Start

```bash
# Clone
git clone https://github.com/HarshitFreq/MP3Master.git
cd MP3Master

# Install & Run
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## License

[MIT](LICENSE)
