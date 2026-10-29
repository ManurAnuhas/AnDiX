/**
 * AnDiX Native High-Performance Music Engine
 * Direct Node.js HTTPS Stream Pipeline to bypass container seccomp / FFmpeg network restrictions.
 * Guaranteed audio delivery for both Sinhala & International songs.
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
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
process.env.FFMPEG_PATH = ffmpegInstaller.path;

const play = require('play-dl');
const sc = require('soundcloud-scraper');
const yts = require('yt-search');
const https = require('https');
const logger = require('../utils/logger');

const scClient = new sc.Client();
const queues = new Map();

let cachedClientId = 'ZeISTkUY1Q4so1FsHJKZaJo898iWk0d3';

async function getValidClientId() {
  try {
    const id = await play.getFreeClientID();
    if (id) {
      cachedClientId = id;
      return id;
    }
  } catch (err) {
    logger.warn('Failed to fetch dynamic SoundCloud client ID, using cached fallback');
  }
  return cachedClientId;
}

// Initial fetch on startup
getValidClientId();

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

// Fetch JSON over HTTPS with redirects
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP status ${res.statusCode}`));
      }
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// Get readable audio stream with redirect handling
function fetchAudioStream(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchAudioStream(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Audio stream HTTP status ${res.statusCode}`));
      }
      resolve(res);
    }).on('error', reject);
  });
}

async function resolveDirectAudioStream(trackUrl) {
  const songInfo = await scClient.getSongInfo(trackUrl);
  const progressiveUrl = songInfo.streams?.progressive;
  
  if (!progressiveUrl) {
    throw new Error('Track does not provide a progressive audio stream.');
  }

  const clientId = await getValidClientId();
  const apiEndpoint = `${progressiveUrl}?client_id=${clientId}`;
  const streamPayload = await fetchJson(apiEndpoint);

  if (!streamPayload || !streamPayload.url) {
    throw new Error('Could not retrieve direct playback URL from stream payload.');
  }

  const audioStream = await fetchAudioStream(streamPayload.url);
  return { audioStream, songInfo };
}

const musicManager = {
  getQueue: (guildId) => queues.get(guildId),

  play: async (voiceChannel, query, interaction) => {
    const guildId = voiceChannel.guild.id;
    let queue = queues.get(guildId);
    const cleanQuery = query.trim();

    let song = null;
    let candidateUrls = [];

    if (cleanQuery.includes('soundcloud.com')) {
      candidateUrls.push(cleanQuery);
      song = {
        title: 'SoundCloud Track',
        url: cleanQuery,
        duration: 'Live / Audio',
        requestedBy: interaction.user.tag
      };
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

      // Search SoundCloud
      try {
        const scResults = await scClient.search(searchTerm, 'track');
        if (scResults && scResults.length > 0) {
          candidateUrls = scResults.map(r => r.url);
          if (!song) {
            song = {
              title: scResults[0].title || searchTerm,
              url: scResults[0].url,
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

    if (candidateUrls.length === 0) {
      throw new Error(`Could not find any playable track for "${cleanQuery}".`);
    }

    song.candidateUrls = candidateUrls;
    song.streamUrl = candidateUrls[0];

    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
        logger.success(`Voice connection ready in guild: ${guildId}`);
      } catch (connErr) {
        logger.error('Voice connection handshake timeout:', connErr.message);
        try { connection.destroy(); } catch (e) {}
        throw new Error('Voice connection timed out. Please try again.');
      }

      const player = createAudioPlayer();

      queue = {
        connection,
        player,
        voiceChannel,
        queue: [],
        current: null,
        paused: false
      };

      connection.subscribe(player);
      queues.set(guildId, queue);

      player.on(AudioPlayerStatus.Idle, () => {
        logger.info(`AudioPlayer became Idle in guild ${guildId}`);
        musicManager.playNext(guildId);
      });

      player.on(AudioPlayerStatus.Playing, () => {
        logger.success(`🎵 Audio actively playing in guild ${guildId}`);
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

    let streamed = false;
    const candidates = song.candidateUrls || [song.streamUrl];

    for (const url of candidates) {
      try {
        logger.info(`Streaming via Direct HTTPS Pipe: ${song.title} (${url})`);
        const { audioStream } = await resolveDirectAudioStream(url);

        const resource = createAudioResource(audioStream, {
          inputType: StreamType.Arbitrary,
          inlineVolume: true
        });

        resource.volume?.setVolume(1.0);
        queue.player.play(resource);

        logger.success(`🎵 Audio stream piped directly to voice player!`);
        streamed = true;
        break;
      } catch (err) {
        logger.warn(`Candidate track stream failed (${url}):`, err.message);
      }
    }

    if (!streamed) {
      logger.error(`All audio stream candidates failed for: ${song.title}`);
      musicManager.playNext(guildId);
    }
  },

  pause: (guildId) => {
    const queue = queues.get(guildId);
    if (!queue || !queue.current) return null;
    if (queue.paused) {
      queue.player.unpause();
      queue.paused = false;
      return 'resumed';
    } else {
      queue.player.pause();
      queue.paused = true;
      return 'paused';
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
