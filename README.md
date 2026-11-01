# 🎮 AnDiX — Ultimate Streamer & Gaming Discord Bot Suite

<div align="center">

[![Discord](https://img.shields.io/badge/Add%20to%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/oauth2/authorize?client_id=1565283272072761424&permissions=8&integration_type=0&scope=bot+applications.commands)
[![Website](https://img.shields.io/badge/Website-Live-00FFA3?style=for-the-badge&logo=googlechrome&logoColor=white)](https://szdtp6vg4h.apps.bot-hosting.cloud)
[![Node.js](https://img.shields.io/badge/Node.js-v20-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-Proprietary-FF0055?style=for-the-badge)](LICENSE)

**Commercial SaaS Discord Bot Suite built for Sri Lankan Gaming Streamers & Server Owners.**

[🌐 Website](https://szdtp6vg4h.apps.bot-hosting.cloud) • [➕ Add Bot](https://discord.com/oauth2/authorize?client_id=1565283272072761424&permissions=8&integration_type=0&scope=bot+applications.commands) • [🔑 Client Portal](https://szdtp6vg4h.apps.bot-hosting.cloud/auth.html)

</div>

---

## ✨ Features

### 🎵 High-Fidelity Music System
- Powered by **Lavalink v4** (cloud audio engine) — no FFmpeg required
- Supports **Spotify**, **YouTube**, **SoundCloud**, **Apple Music**, **Deezer**, and 40+ more platforms
- Commands: `/play`, `/pause`, `/resume`, `/skip`, `/stop`, `/queue`
- Full-length playback (SoundCloud primary to bypass YouTube's 3-min cloud throttle)
- Interactive Pause/Resume/Skip buttons on Now Playing embed
- YouTube playlist support — each track re-resolved via SoundCloud for full playback

### 🏗️ 1-Click Server Architect
- Build a complete professional gaming server in **under 10 seconds**
- Creates 7 hierarchical roles (Owner → Muted), 5 categories, 17+ pre-configured channels
- All permissions pre-tuned for streamer communities

### 📡 Multi-Platform Stream Alerts
- Broadcast rich live alerts for **YouTube**, **Twitch**, **Facebook Gaming**, **Kick**
- Send from the Web Dashboard — no bot commands needed
- Includes Watch button, role mention, and game/title display

### 🛡️ AutoMod & Raid Shield
- Anti-spam, anti-flood, anti-invite link, mass mention blocker
- Real-time threat detection and automated timeout

### 📋 Full Audit Logs
- Message delete/edit tracker
- Join/Leave logs with avatar
- Moderation action logs

### 🌐 Client Web Dashboard
- Each client gets their own login (Email or Discord OAuth)
- Manage stream alerts, server settings, announcements
- Submit support tickets, view subscription status

### 🎫 SaaS Admin System
- Multi-client management from admin panel
- Payment approval workflow (bank transfer slip upload)
- Admin can approve/reject and trigger server setup per client

---

## 🤖 Slash Commands

| Command | Description |
|---------|-------------|
| `/play song:<query or URL>` | Play a song from YouTube, Spotify, SoundCloud, etc. |
| `/pause` | Pause current track |
| `/resume` | Resume playback |
| `/skip` | Skip to next track in queue |
| `/stop` | Stop music and leave voice channel |
| `/queue` | Show current playback queue |
| `/clear` | Purge messages from a channel |
| `/announce` | Send a rich announcement embed |
| `/buildserver` | 1-Click server architect (admin/owner only) |
| `/setalert` | Configure stream alert channel |
| `/ping` | Check bot latency |

---

## 🚀 Hosting & Deployment

This bot is hosted on **[Bot-Hosting.net](https://bot-hosting.net)** (Pterodactyl panel, Node.js v20, Linux container).

### Requirements
- Node.js v20+
- MongoDB (Atlas or self-hosted)
- Lavalink v4 node (cloud nodes are pre-configured — no self-hosting needed)

### Environment Variables

Set these in your hosting panel (never commit to Git):

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Your Discord bot token |
| `CLIENT_ID` | Discord application client ID |
| `CLIENT_SECRET` | Discord OAuth2 client secret |
| `ADMIN_EMAIL` | Admin dashboard login email |
| `ADMIN_PASSWORD` | Admin dashboard login password |
| `JWT_SECRET` | Random secret string for JWT tokens (min 32 chars) |
| `MONGODB_URI` | MongoDB connection string |

### Local Development

```bash
# Clone
git clone https://github.com/ManurAnuhas/AnDiX.git
cd AnDiX

# Install dependencies
npm install

# Copy env template
cp .env.example .env
# Edit .env with your values

# Start
npm start
```

### Discord Developer Portal Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application → **OAuth2** → **Redirects**
3. Add redirect URL: `https://<your-domain>/api/auth/discord/callback`

---

## 🎵 Music System Architecture

The music system uses **Lavalink v4** with the following node configuration:

| Node | URL | Features |
|------|-----|----------|
| **Nazha** (Primary) | `lavalink.nazha.online:443` | Spotify, YouTube, SoundCloud, Apple Music, Deezer, 40+ sources via LavaSrc |
| **Jirayu** (Backup) | `lavalink.jirayu.net:443` | General audio, reliable fallback |
| **Serenetia** (Backup) | `lavalinkv4.serenetia.com:443` | Cloud audio node |

**Default search source**: SoundCloud (`scsearch`) — avoids YouTube 3-minute throttle on cloud IPs.

**Spotify playback**: Uses `source: 'spotify'` via LavaSrc plugin on the Nazha node.

---

## 📁 Project Structure

```
AnDiX/
├── src/
│   ├── commands/          # Slash command handlers
│   ├── modules/
│   │   ├── musicManager.js    # Lavalink music engine
│   │   ├── automod.js         # AutoMod & Raid Shield
│   │   └── auth.js            # JWT authentication
│   └── dashboard/
│       ├── server.js          # Express web server + API routes
│       └── public/
│           ├── index.html     # Marketing landing page
│           ├── auth.html      # Login / Register portal
│           ├── client.html    # Client dashboard
│           ├── admin.html     # Admin panel
│           └── styles.css     # Shared styles
├── api/
│   └── index.js               # REST API endpoints
├── config.json                # Bot configuration (no secrets)
├── package.json
└── README.md
```

---

## 🔒 Security Notes

- No secrets are hardcoded in any committed files
- All credentials are loaded from environment variables
- `.env` is git-ignored
- Admin login requires both `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars
- JWT tokens expire after 7 days

---

## 📞 Support

- **WhatsApp**: Contact via the website support link
- **Discord**: Join the community server via the website
- **Email**: Available on the website

---

## 🏷️ Tech Stack

- **Runtime**: Node.js v20
- **Discord Library**: discord.js v14
- **Music Engine**: lavalink-client + Lavalink v4
- **Web Server**: Express.js
- **Database**: MongoDB (Mongoose)
- **Auth**: JWT + Discord OAuth2
- **Frontend**: Vanilla HTML/CSS/JS (gaming dark theme)
- **Hosting**: Bot-Hosting.net (Pterodactyl)

---

<div align="center">
<p>© 2026 <strong>AnDiX Suite</strong> — Built for Sri Lankan Gaming Streamers & Discord Communities</p>

[![Add to Discord](https://img.shields.io/badge/ADD%20BOT%20TO%20SERVER-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/oauth2/authorize?client_id=1565283272072761424&permissions=8&integration_type=0&scope=bot+applications.commands)
</div>
