/**
 * AnDiX Enterprise Lavalink Music Engine v3
 * Primary Node: lavalink.nazha.online (supports Spotify, YouTube, SoundCloud, Apple Music)
 * - Spotify/YouTube/SC search + stream via cloud engine (no local FFmpeg needed)
 * - YouTube playlist → SoundCloud re-resolve to avoid 3-min throttling
 * - Auto trackError recovery and full queue continuity
 */

const { LavalinkManager } = require('lavalink-client');
const logger = require('../utils/logger');

let lavalink = null;

/**
 * Detect if query is a URL or plain search term
 */
function isUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

/**
 * Detect YouTube URL
 */
function isYouTubeUrl(str) {
  return /youtu\.be|youtube\.com/i.test(str);
}

/**
 * Detect Spotify URL
 */
function isSpotifyUrl(str) {
  return /open\.spotify\.com/i.test(str);
}

function initLavalink(client) {
  if (lavalink) return lavalink;

  lavalink = new LavalinkManager({
    nodes: [
      {
        // Primary: Nazha — supports Spotify, YouTube, SoundCloud, Apple Music, Deezer
        authorization: 'nazhafreelava',
        host: 'lavalink.nazha.online',
        port: 443,
        secure: true
      },
      {
        // Backup: jirayu — fast, reliable SoundCloud + YouTube
        authorization: 'youshallnotpass',
        host: 'lavalink.jirayu.net',
        port: 443,
        secure: true
      },
      {
        // Backup: Serenetia — LavaSrc Spotify + YouTube
        authorization: 'https://seretia.link/discord',
        host: 'lavalinkv4.serenetia.com',
        port: 443,
        secure: true
      }
    ],
    sendToShard: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
    client: {
      id: client.user?.id || process.env.CLIENT_ID || '1565283272072761424',
      username: 'AnDiX'
    },
    autoSkip: true,
    playerOptions: {
      // Default to SoundCloud so songs play without YouTube IP throttling
      defaultSearchPlatform: 'scsearch',
      onDisconnect: {
        autoReconnect: true,
        destroyPlayer: false
      }
    }
  });

  // ─────── Node Events ───────
  lavalink.nodeManager.on('connect', (node) => {
    logger.success(`🎵 Lavalink Node Connected: ${node.options.host}`);
  });

  lavalink.nodeManager.on('disconnect', (node) => {
    logger.warn(`Lavalink Node Disconnected: ${node.options.host}`);
  });

  lavalink.nodeManager.on('error', () => {
    // Suppress transient reconnect warnings
  });

  // ─────── Track Events ───────
  lavalink.on('trackStart', (player, track) => {
    logger.success(`▶️  Now Playing: ${track.info.title}`);
  });

  lavalink.on('trackEnd', (player, track, payload) => {
    logger.info(`⏹️  Track ended: ${track?.info?.title} — Reason: ${payload.reason}`);
  });

  lavalink.on('trackError', async (player, track, payload) => {
    logger.warn(`⚠️  Track error: ${payload?.exception?.message || payload.reason} — skipping...`);
    if (player.queue.tracks.length > 0) {
      await player.skip().catch(() => {});
    }
  });

  lavalink.on('trackStuck', async (player) => {
    logger.warn(`⚠️  Track stuck — attempting resume...`);
    await player.seek(player.position + 1500).catch(() => {});
  });

  // Forward raw Discord WebSocket packets to Lavalink for voice UDP handshake
  client.on('raw', (data) => lavalink.sendRawData(data));

  return lavalink;
}

const musicManager = {
  init: initLavalink,
  getManager: () => lavalink,

  play: async (voiceChannel, query, interaction, client) => {
    if (!lavalink) initLavalink(client);

    if (!lavalink.initiated) {
      await lavalink.init({ id: client.user.id, username: client.user.username });
    }

    const guildId = voiceChannel.guild.id;
    let player = lavalink.getPlayer(guildId);

    if (!player) {
      player = await lavalink.createPlayer({
        guildId,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channelId,
        selfDeaf: false,
        selfMute: false,
        volume: 100
      });
      await player.connect();
    }

    const cleanQuery = query.trim();
    let res = null;

    // ── Strategy: pick best search source based on query ──
    if (isSpotifyUrl(cleanQuery)) {
      // Spotify links: load via LavaSrc plugin (nazha node supports this)
      res = await player.search({ query: cleanQuery, source: 'spotify' }, interaction.user).catch(() => null);

    } else if (isYouTubeUrl(cleanQuery)) {
      // YouTube URL: load it directly for the playlist metadata, but then
      // re-resolve each track via SoundCloud to avoid 3-min throttling
      const ytRes = await player.search({ query: cleanQuery, source: 'youtube' }, interaction.user).catch(() => null);

      if (ytRes && ytRes.tracks && ytRes.tracks.length > 0) {
        // For each YT track, search SoundCloud equivalent to prevent stream cuts
        logger.info(`Re-resolving ${ytRes.tracks.length} YouTube track(s) via SoundCloud...`);
        const resolvedTracks = [];

        for (const track of ytRes.tracks) {
          const title = track.info.title
            .replace(/\(.*?\)|\[.*?\]/g, '')
            .replace(/official|music|video|lyrics|hd|4k/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

          const scSearch = await player.search({ query: `scsearch:${title}`, source: 'scsearch' }, interaction.user).catch(() => null);
          if (scSearch && scSearch.tracks && scSearch.tracks.length > 0) {
            resolvedTracks.push(scSearch.tracks[0]);
          } else {
            // Fallback: keep original YT track
            resolvedTracks.push(track);
          }
        }

        // Build fake result with re-resolved tracks
        res = {
          loadType: ytRes.loadType,
          tracks: resolvedTracks,
          playlist: ytRes.playlist
        };
      } else {
        // YT URL load failed, try SC search
        res = await player.search({ query: `scsearch:${cleanQuery}`, source: 'scsearch' }, interaction.user).catch(() => null);
      }

    } else {
      // Plain text search: SoundCloud first (uninterrupted), YouTube as fallback
      res = await player.search({ query: `scsearch:${cleanQuery}`, source: 'scsearch' }, interaction.user).catch(() => null);

      if (!res || !res.tracks || res.tracks.length === 0) {
        res = await player.search({ query: cleanQuery, source: 'ytsearch' }, interaction.user).catch(() => null);
      }
    }

    if (!res || !res.tracks || res.tracks.length === 0) {
      throw new Error(`Could not find any song matching "${cleanQuery}". Try a different search term or paste a SoundCloud / Spotify link.`);
    }

    let songInfo;

    if (res.loadType === 'playlist') {
      for (const track of res.tracks) {
        await player.queue.add(track);
      }
      songInfo = {
        title: res.playlist?.title || 'Playlist',
        url: cleanQuery,
        duration: `${res.tracks.length} Tracks`,
        thumbnail: res.tracks[0]?.info?.artworkUrl || null,
        requestedBy: interaction.user.tag
      };
      if (!player.playing) await player.play();
      return { status: 'queued_playlist', song: songInfo, count: res.tracks.length };
    }

    const track = res.tracks[0];
    songInfo = {
      title: track.info.title,
      url: track.info.uri,
      duration: track.info.duration ? formatDuration(track.info.duration) : 'Live',
      thumbnail: track.info.artworkUrl || null,
      requestedBy: interaction.user.tag
    };

    if (player.playing || player.paused) {
      await player.queue.add(track);
      return { status: 'queued', song: songInfo, position: player.queue.tracks.length };
    }

    await player.queue.add(track);
    await player.play();
    return { status: 'playing', song: songInfo };
  },

  pause: (guildId) => {
    if (!lavalink) return null;
    const player = lavalink.getPlayer(guildId);
    if (!player) return null;
    if (player.paused) { player.resume(); return 'resumed'; }
    player.pause(); return 'paused';
  },

  skip: async (guildId) => {
    if (!lavalink) return false;
    const player = lavalink.getPlayer(guildId);
    if (!player || (!player.playing && !player.queue.tracks.length)) return false;
    await player.skip();
    return true;
  },

  stop: async (guildId) => {
    if (!lavalink) return false;
    const player = lavalink.getPlayer(guildId);
    if (!player) return false;
    await player.destroy();
    return true;
  }
};

function formatDuration(ms) {
  if (!ms || isNaN(ms)) return 'Live';
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

module.exports = musicManager;
