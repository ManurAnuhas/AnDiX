/**
 * AnDiX Native High-Performance Music Engine
 * Uses pure Node.js streaming via play-dl & soundcloud-scraper.
 * Bypasses all external FFmpeg binary crashes (SIGSEGV) and container memory limitations.
 */

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType
} = require('@discordjs/voice');
const play = require('play-dl');
const sc = require('soundcloud-scraper');
const yts = require('yt-search');
const logger = require('../utils/logger');

const scClient = new sc.Client();
const queues = new Map();

// Initialize SoundCloud token on boot with bulletproof fallback
let soundCloudInitialized = false;
async function initSoundCloud() {
  if (soundCloudInitialized) return;
  try {
    const clientId = await play.getFreeClientID();
    if (clientId) {
      await play.setToken({ soundcloud: { client_id: clientId } });
      soundCloudInitialized = true;
      logger.success('Play-DL SoundCloud client ID initialized successfully.');
      return;
    }
  } catch (err) {
    logger.warn('Auto-fetch SoundCloud client ID failed, using active static token fallback:', err.message);
  }

  // Known active SoundCloud public API client ID fallback
  try {
    await play.setToken({ soundcloud: { client_id: 'ZeISTkUY1Q4so1FsHJKZaJo898iWk0d3' } });
    soundCloudInitialized = true;
    logger.success('Play-DL static SoundCloud client ID initialized successfully.');
  } catch (e) {
    logger.error('Failed to set SoundCloud fallback token:', e.message);
  }
}
initSoundCloud();

function cleanTitle(title) {
  if (!title) return '';
  return title
    .replace(/[\[\(].*?[\]\)]/g, '')
    .replace(/@[a-zA-Z0-9_]+/g, '')
    .replace(/\b(official|music|video|audio|lyrics|hd|4k|ft\.?|feat\.?)\b/gi, '')
    .replace(/[|•·\-_/\\#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

const musicManager = {
  getQueue: (guildId) => queues.get(guildId),

  play: async (voiceChannel, query, interaction) => {
    await initSoundCloud();
    const guildId = voiceChannel.guild.id;
    let queue = queues.get(guildId);
    const cleanQuery = query.trim();

    let song = null;
    let targetUrl = null;

    // Direct SoundCloud Link
    if (cleanQuery.includes('soundcloud.com')) {
      targetUrl = cleanQuery;
      try {
        const info = await play.soundcloud(targetUrl);
        song = {
          title: info.name,
          url: targetUrl,
          duration: `${Math.floor((info.durationInSec || 0) / 60)}:${((info.durationInSec || 0) % 60).toString().padStart(2, '0')}`,
          thumbnail: info.thumbnail,
          requestedBy: interaction.user.tag
        };
      } catch (e) {
        song = { title: 'SoundCloud Track', url: targetUrl, duration: 'Unknown', requestedBy: interaction.user.tag };
      }
    } else {
      let searchTerm = cleanQuery;
      const ytVideoId = extractVideoId(cleanQuery);

      if (ytVideoId) {
        try {
          const ytResult = await yts({ videoId: ytVideoId });
          if (ytResult && ytResult.title) {
            searchTerm = cleanTitle(ytResult.title);
            song = {
              title: ytResult.title,
              url: ytResult.url,
              duration: ytResult.timestamp || 'Unknown',
              thumbnail: ytResult.thumbnail || ytResult.image,
              requestedBy: interaction.user.tag
            };
          }
        } catch (e) {
          logger.warn('YouTube extraction error:', e.message);
        }
      }

      // Search SoundCloud for direct playable track
      try {
        const scResults = await scClient.search(searchTerm, 'track');
        if (scResults && scResults.length > 0) {
          targetUrl = scResults[0].url;
          if (!song) {
            song = {
              title: scResults[0].title || searchTerm,
              url: targetUrl,
              duration: 'Unknown',
              thumbnail: scResults[0].thumbnail,
              requestedBy: interaction.user.tag
            };
          }
        }
      } catch (err) {
        logger.warn('SoundCloud search error:', err.message);
      }
    }

    if (!targetUrl) {
      throw new Error(`Could not find a playable track for "${cleanQuery}". Please try another name or link.`);
    }

    song.streamUrl = targetUrl;

    // Join Voice Channel with explicit non-deafened mode
    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });

      const player = createAudioPlayer();

      queue = {
        connection,
        player,
        voiceChannel,
        queue: [],
        current: null
      };

      connection.subscribe(player);
      queues.set(guildId, queue);

      player.on(AudioPlayerStatus.Idle, () => {
        musicManager.playNext(guildId);
      });

      player.on('error', error => {
        logger.error(`Music player error in guild ${guildId}:`, error.message);
        musicManager.playNext(guildId);
      });

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
          ]);
        } catch (e) {
          try { connection.destroy(); } catch (err) {}
          queues.delete(guildId);
        }
      });
    }

    queue.queue.push(song);

    if (!queue.current) {
      await musicManager.playNext(guildId);
      return { status: 'playing', song };
    } else {
      return { status: 'queued', song, position: queue.queue.length };
    }
  },

  playNext: async (guildId) => {
    const queue = queues.get(guildId);
    if (!queue) return;

    if (queue.queue.length === 0) {
      queue.current = null;
      setTimeout(() => {
        const q = queues.get(guildId);
        if (q && !q.current && q.queue.length === 0) {
          try { q.connection.destroy(); } catch (e) {}
          queues.delete(guildId);
        }
      }, 120000);
      return;
    }

    const song = queue.queue.shift();
    queue.current = song;

    try {
      logger.info(`Resolving native stream for: ${song.title} (${song.streamUrl})`);
      let audioStream = null;
      let inputType = StreamType.Arbitrary;

      // Primary: Direct progressive MP3 stream via soundcloud-scraper
      try {
        const songInfo = await scClient.getSongInfo(song.streamUrl);
        audioStream = await songInfo.downloadProgressive();
        if (audioStream) {
          logger.success(`Direct progressive stream obtained for: ${song.title}`);
        }
      } catch (scErr) {
        logger.warn('Progressive stream fetch fallback:', scErr.message);
      }

      // Secondary Fallback: play-dl stream
      if (!audioStream) {
        await initSoundCloud();
        const streamSource = await play.stream(song.streamUrl, {
          quality: 1,
          discordPlayerCompatibility: true
        });
        audioStream = streamSource.stream;
        inputType = streamSource.type;
      }

      if (!audioStream) {
        throw new Error('Unable to resolve audio stream');
      }

      const resource = createAudioResource(audioStream, {
        inputType: inputType,
        inlineVolume: true
      });

      resource.volume?.setVolume(1.0);
      queue.player.play(resource);

      logger.success(`🎵 Successfully streaming audio to Voice Channel: ${song.title}`);
    } catch (err) {
      logger.error('Stream Pipeline Error:', err.message);
      musicManager.playNext(guildId);
    }
  },

  skip: (guildId) => {
    const queue = queues.get(guildId);
    if (!queue || !queue.current) return false;
    queue.player.stop();
    return true;
  },

  stop: (guildId) => {
    const queue = queues.get(guildId);
    if (!queue) return false;
    queue.queue = [];
    queue.current = null;
    queue.player.stop();
    try { queue.connection.destroy(); } catch (e) {}
    queues.delete(guildId);
    return true;
  }
};

module.exports = musicManager;
