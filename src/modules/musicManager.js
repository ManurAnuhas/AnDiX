const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');
const play = require('play-dl');
const logger = require('../utils/logger');

// Store active guild music queues
// guildId -> { connection, player, queue: [], current: null, loop: false }
const queues = new Map();

const musicManager = {
  getQueue: (guildId) => queues.get(guildId),

  play: async (voiceChannel, query, interaction) => {
    const guildId = voiceChannel.guild.id;
    let queue = queues.get(guildId);

    // Search song via play-dl (YouTube, Spotify, SoundCloud)
    let song = null;
    const cleanQuery = query.trim();

    try {
      if (cleanQuery.includes('spotify.com/')) {
        if (play.is_expired()) {
          await play.refreshToken();
        }
        const spData = await play.spotify(cleanQuery);
        if (spData && (spData.type === 'track' || spData.name)) {
          const searchTitle = `${spData.name} ${spData.artists?.[0]?.name || ''}`.trim();
          const searched = await play.search(searchTitle, { limit: 1, source: { youtube: 'video' } });
          if (searched.length > 0) {
            song = {
              title: spData.name,
              url: searched[0].url,
              duration: searched[0].durationRaw || 'Unknown',
              thumbnail: spData.thumbnail?.url || searched[0].thumbnails?.[0]?.url,
              requestedBy: interaction.user.tag
            };
          }
        }
      } else if (play.yt_validate(cleanQuery) === 'video') {
        // Direct YouTube URL
        const info = await play.video_info(cleanQuery);
        if (info && info.video_details) {
          song = {
            title: info.video_details.title,
            url: info.video_details.url,
            duration: info.video_details.durationRaw,
            thumbnail: info.video_details.thumbnails?.[0]?.url,
            requestedBy: interaction.user.tag
          };
        }
      } else {
        // Standard text search (search both video and general)
        let searched = await play.search(cleanQuery, { limit: 1, source: { youtube: 'video' } });
        if (!searched || searched.length === 0) {
          searched = await play.search(cleanQuery, { limit: 1 });
        }
        if (searched && searched.length > 0) {
          song = {
            title: searched[0].title,
            url: searched[0].url,
            duration: searched[0].durationRaw || 'Unknown',
            thumbnail: searched[0].thumbnails?.[0]?.url,
            requestedBy: interaction.user.tag
          };
        }
      }
    } catch (err) {
      logger.error('Music Search Error:', err);
    }

    if (!song) {
      throw new Error('No song found for your query.');
    }

    // Initialize queue if not present
    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator
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
          connection.destroy();
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
          q.connection.destroy();
          queues.delete(guildId);
        }
      }, 120000); // Leave VC after 2 minutes of idle
      return;
    }

    const song = queue.queue.shift();
    queue.current = song;

    try {
      const stream = await play.stream(song.url);
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type
      });
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
    queue.connection.destroy();
    queues.delete(guildId);
    return true;
  }
};

module.exports = musicManager;

