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
const sc = require('soundcloud-scraper');
const prism = require('prism-media');
const ffmpegPath = require('ffmpeg-static');
const logger = require('../utils/logger');

const scClient = new sc.Client();
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
        const videoData = await yts({ videoId });
        if (videoData) {
          song = {
            title: videoData.title,
            url: videoData.url,
            duration: videoData.timestamp || 'Unknown',
            thumbnail: videoData.thumbnail || videoData.image,
            requestedBy: interaction.user.tag,
            searchTerm: videoData.title.replace(/[\[\(].*?[\]\)]/g, '').trim()
          };
        }
      } else {
        const searchResult = await yts(cleanQuery);
        const videos = searchResult?.videos || [];

        if (videos.length > 0) {
          const top = videos[0];
          song = {
            title: top.title,
            url: top.url,
            duration: top.timestamp || top.duration?.toString() || 'Unknown',
            thumbnail: top.thumbnail || top.image,
            requestedBy: interaction.user.tag,
            searchTerm: top.title.replace(/[\[\(].*?[\]\)]/g, '').trim()
          };
        }
      }
    } catch (err) {
      logger.error('Song Search Error:', err);
    }

    if (!song) {
      throw new Error('No song found for your query. Please provide a valid song name or link.');
    }

    // Join Voice Channel
    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false
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

    try {
      logger.info(`Resolving audio stream for: ${song.title}`);
      
      const scSearch = await scClient.search(song.searchTerm || song.title, 'track');
      let progressiveStream = null;

      if (scSearch && scSearch.length > 0) {
        const songInfo = await scClient.getSongInfo(scSearch[0].url);
        progressiveStream = await songInfo.downloadProgressive();
      }

      if (!progressiveStream) {
        throw new Error('Could not download audio stream from provider');
      }

      // Convert stream to Discord 48kHz Stereo PCM via FFmpeg
      const transcoder = new prism.FFmpeg({
        ffmpegPath: ffmpegPath,
        args: [
          '-analyzeduration', '0',
          '-loglevel', '0',
          '-f', 's16le',
          '-ar', '48000',
          '-ac', '2'
        ]
      });

      const audioPipeline = progressiveStream.pipe(transcoder);

      const resource = createAudioResource(audioPipeline, {
        inputType: StreamType.Raw,
        inlineVolume: true
      });

      resource.volume?.setVolume(1.0);
      queue.player.play(resource);
      logger.success(`🎵 Audio playing in Voice Channel: ${song.title}`);

    } catch (err) {
      logger.error('Audio Streaming Pipeline Error:', err.message);
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
