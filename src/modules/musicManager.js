const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');
const yts = require('yt-search');
const play = require('play-dl');
const logger = require('../utils/logger');

const queues = new Map();
let soundCloudInitialized = false;

async function initSoundCloud() {
  if (!soundCloudInitialized) {
    try {
      const client_id = await play.getFreeClientID();
      await play.setToken({ soundcloud: { client_id } });
      soundCloudInitialized = true;
      logger.info('SoundCloud client token initialized successfully.');
    } catch (e) {
      logger.warn('SoundCloud init warning:', e.message);
    }
  }
}

const musicManager = {
  getQueue: (guildId) => queues.get(guildId),

  play: async (voiceChannel, query, interaction) => {
    await initSoundCloud();
    const guildId = voiceChannel.guild.id;
    let queue = queues.get(guildId);
    let song = null;
    const cleanQuery = query.trim();

    // 1. YouTube metadata search (for title, duration, thumbnail)
    try {
      const searchResult = await yts(cleanQuery);
      const topVideo = searchResult?.videos?.[0];

      if (topVideo) {
        song = {
          title: topVideo.title,
          url: topVideo.url,
          duration: topVideo.timestamp || 'Unknown',
          thumbnail: topVideo.thumbnail || topVideo.image,
          requestedBy: interaction.user.tag,
          cleanTitle: topVideo.title.replace(/[\[\(].*?[\]\)]/g, '').trim()
        };
      }
    } catch (e) {
      logger.error('Metadata search error:', e);
    }

    if (!song) {
      throw new Error('No song found for your query. Please provide a song name or link.');
    }

    // 2. Initialize Voice Connection
    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true
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
        logger.error(`Music player error in guild ${guildId}:`, error);
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

    let stream = null;

    // Strategy 1: Fast & Clean SoundCloud Audio Stream (Bypasses YouTube 429 Bot Check)
    try {
      const scSearch = await play.search(song.cleanTitle || song.title, {
        source: { soundcloud: 'tracks' },
        limit: 1
      });

      if (scSearch && scSearch.length > 0) {
        stream = await play.stream(scSearch[0].url);
      }
    } catch (e) {
      logger.warn('SoundCloud stream attempt failed, attempting fallback...');
    }

    // Strategy 2: Direct YouTube Stream fallback
    if (!stream) {
      try {
        stream = await play.stream(song.url);
      } catch (e) {
        logger.error('YouTube direct stream error:', e.message);
      }
    }

    if (!stream) {
      logger.error(`Could not stream audio for track: ${song.title}`);
      return musicManager.playNext(guildId);
    }

    try {
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true
      });
      resource.volume?.setVolume(1.0);
      queue.player.play(resource);
      logger.success(`Playing audio: ${song.title}`);
    } catch (err) {
      logger.error('Audio play error:', err);
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
