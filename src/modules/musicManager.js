const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType
} = require('@discordjs/voice');
const yts = require('yt-search');
const play = require('play-dl');
const logger = require('../utils/logger');

const queues = new Map();

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

const musicManager = {
  getQueue: (guildId) => queues.get(guildId),

  play: async (voiceChannel, query, interaction) => {
    const guildId = voiceChannel.guild.id;
    let queue = queues.get(guildId);
    let song = null;
    const cleanQuery = query.trim();

    try {
      const videoId = extractVideoId(cleanQuery);

      if (videoId) {
        // Direct YouTube Link (youtube.com / youtu.be)
        const videoData = await yts({ videoId });
        if (videoData) {
          song = {
            title: videoData.title,
            url: videoData.url,
            duration: videoData.timestamp || 'Unknown',
            thumbnail: videoData.thumbnail || videoData.image,
            requestedBy: interaction.user.tag
          };
        }
      } else {
        // Text Search
        const searchResult = await yts(cleanQuery);
        const videos = searchResult?.videos || [];

        if (videos.length > 0) {
          const top = videos[0];
          song = {
            title: top.title,
            url: top.url,
            duration: top.timestamp || top.duration?.toString() || 'Unknown',
            thumbnail: top.thumbnail || top.image,
            requestedBy: interaction.user.tag
          };
        }
      }
    } catch (err) {
      logger.error('yt-search resolution error:', err);
    }

    // Fallback: If yt-search failed, try play-dl
    if (!song) {
      try {
        const searched = await play.search(cleanQuery, { limit: 1 });
        if (searched && searched.length > 0) {
          song = {
            title: searched[0].title,
            url: searched[0].url,
            duration: searched[0].durationRaw || 'Unknown',
            thumbnail: searched[0].thumbnails?.[0]?.url,
            requestedBy: interaction.user.tag
          };
        }
      } catch (err) {
        logger.error('play-dl fallback error:', err);
      }
    }

    if (!song) {
      throw new Error('No song found for your query. Please provide a valid song name or YouTube link.');
    }

    // Initialize Voice Connection & Audio Player
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
        logger.error(`Player error in guild ${guildId}:`, error);
        musicManager.playNext(guildId);
      });

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
          ]);
        } catch (e) {
          try { connection.destroy(); } catch(err){}
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
          try { q.connection.destroy(); } catch(e){}
          queues.delete(guildId);
        }
      }, 120000);
      return;
    }

    const song = queue.queue.shift();
    queue.current = song;

    try {
      // Stream audio with fallback
      const stream = await play.stream(song.url, { quality: 2 });
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true
      });
      resource.volume.setVolume(1.0);
      queue.player.play(resource);
    } catch (err) {
      logger.error('Stream play error:', err);
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
    try { queue.connection.destroy(); } catch(e){}
    queues.delete(guildId);
    return true;
  }
};

module.exports = musicManager;
