/**
 * AnDiX Native High-Performance Music Engine
 * Uses Direct Progressive MP3 streams transcoded into Discord 48kHz Stereo PCM.
 * With libsodium-wrappers AEAD encryption & explicit Ready handshake.
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
const prism = require('prism-media');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const logger = require('../utils/logger');

const scClient = new sc.Client();
const queues = new Map();

// Initialize SoundCloud token
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
    logger.warn('Auto-fetch SoundCloud client ID failed, using static token fallback:', err.message);
  }

  try {
    await play.setToken({ soundcloud: { client_id: 'ZeISTkUY1Q4so1FsHJKZaJo898iWk0d3' } });
    soundCloudInitialized = true;
  } catch (e) {}
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

    if (cleanQuery.includes('soundcloud.com')) {
      targetUrl = cleanQuery;
      song = {
        title: 'SoundCloud Track',
        url: targetUrl,
        duration: 'Live',
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

    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });

      // Explicitly await UDP Handshake (Ready state) before accepting audio packets
      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
        logger.success(`Voice connection established and ready in guild: ${guildId}`);
      } catch (connErr) {
        logger.error('Voice connection handshake timeout:', connErr.message);
        try { connection.destroy(); } catch (e) {}
        throw new Error('Could not establish secure voice handshake with Discord. Please try again.');
      }

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
        logger.info(`AudioPlayer became Idle in guild ${guildId}`);
        musicManager.playNext(guildId);
      });

      player.on(AudioPlayerStatus.Playing, () => {
        logger.success(`AudioPlayer status: PLAYING in guild ${guildId}`);
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

      // 1. Fetch progressive MP3 audio stream
      try {
        const songInfo = await scClient.getSongInfo(song.streamUrl);
        audioStream = await songInfo.downloadProgressive();
        if (audioStream) {
          logger.success(`Direct progressive stream obtained for: ${song.title}`);
        }
      } catch (scErr) {
        logger.warn('Progressive stream fetch fallback:', scErr.message);
      }

      // 2. Fallback to play-dl
      if (!audioStream) {
        await initSoundCloud();
        const streamSource = await play.stream(song.streamUrl, {
          quality: 1,
          discordPlayerCompatibility: true
        });
        audioStream = streamSource.stream;
      }

      if (!audioStream) {
        throw new Error('Unable to resolve audio stream');
      }

      // 3. Transcode incoming MP3 stream into Discord 48kHz Stereo 16-bit PCM
      const transcoder = new prism.FFmpeg({
        ffmpegPath: ffmpegInstaller.path || 'ffmpeg',
        args: [
          '-analyzeduration', '0',
          '-loglevel', '0',
          '-f', 's16le',
          '-ar', '48000',
          '-ac', '2'
        ]
      });

      const pcmPipeline = audioStream.pipe(transcoder);

      const resource = createAudioResource(pcmPipeline, {
        inputType: StreamType.Raw,
        inlineVolume: true
      });

      resource.volume?.setVolume(1.0);
      queue.player.play(resource);

      logger.success(`🎵 Audio successfully piped to player for: ${song.title}`);
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
