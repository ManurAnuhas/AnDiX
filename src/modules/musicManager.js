/**
 * AnDiX Music Manager — DisTube v5 + SoundCloud Native Engine
 * Resolves all queries to direct SoundCloud tracks to completely bypass YouTube bot-check restrictions.
 */

const sc = require('soundcloud-scraper');
const yts = require('yt-search');
const logger = require('../utils/logger');

const scClient = new sc.Client();

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
  /**
   * Play a song/search query using DisTube.
   * @param {import('discord.js').VoiceChannel} voiceChannel
   * @param {string} query - Song title or URL
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  play: async (voiceChannel, query, interaction) => {
    const distube = interaction.client.distube;

    if (!distube) {
      throw new Error('Music system is not initialized. Please contact an admin.');
    }

    const cleanQuery = query.trim();
    let playTarget = cleanQuery;
    let songMetadata = null;

    // Check if input is a direct SoundCloud URL
    if (cleanQuery.includes('soundcloud.com')) {
      playTarget = cleanQuery;
    } else {
      let searchTerm = cleanQuery;
      const ytVideoId = extractVideoId(cleanQuery);

      if (ytVideoId) {
        try {
          const ytResult = await yts({ videoId: ytVideoId });
          if (ytResult && ytResult.title) {
            searchTerm = cleanTitle(ytResult.title);
            songMetadata = {
              title: ytResult.title,
              thumbnail: ytResult.thumbnail || ytResult.image,
              duration: ytResult.timestamp || 'Unknown'
            };
            logger.info(`Extracted YouTube Video Title: "${searchTerm}" from ID: ${ytVideoId}`);
          }
        } catch (e) {
          logger.warn('YouTube videoId metadata fetch error:', e.message);
        }
      }

      // Search SoundCloud directly for public tracks matching the title
      try {
        const scResults = await scClient.search(searchTerm, 'track');
        if (scResults && scResults.length > 0) {
          const bestTrack = scResults[0];
          playTarget = bestTrack.url;
          logger.info(`Resolved "${searchTerm}" to SoundCloud: ${playTarget}`);
        } else {
          playTarget = `scsearch:${searchTerm}`;
        }
      } catch (err) {
        logger.warn('SoundCloud direct search fallback:', err.message);
        playTarget = `scsearch:${searchTerm}`;
      }
    }

    logger.info(`Initiating playback on target: ${playTarget}`);

    // Play via DisTube SoundCloud plugin
    await distube.play(voiceChannel, playTarget, {
      member: interaction.member,
      textChannel: interaction.channel,
    });

    // Retrieve active queue
    const queue = distube.getQueue(voiceChannel.guildId);

    if (queue && queue.songs.length > 0) {
      const currentSong = queue.songs[queue.songs.length - 1] || queue.songs[0];
      const isQueued = queue.songs.length > 1;

      return {
        status: isQueued ? 'queued' : 'playing',
        song: {
          title: songMetadata?.title || currentSong.name || cleanQuery,
          url: currentSong.url || playTarget,
          duration: songMetadata?.duration || currentSong.formattedDuration || 'Unknown',
          thumbnail: songMetadata?.thumbnail || currentSong.thumbnail || null,
          requestedBy: interaction.user.tag,
        },
        position: queue.songs.length,
      };
    }

    return {
      status: 'playing',
      song: {
        title: songMetadata?.title || cleanQuery,
        url: playTarget,
        duration: 'Unknown',
        thumbnail: null,
        requestedBy: interaction.user.tag,
      },
    };
  },

  /**
   * Skip current track
   */
  skip: async (guildId, client) => {
    const distube = client.distube;
    const queue = distube?.getQueue(guildId);
    if (!queue || !queue.songs.length) return false;

    try {
      await distube.skip(guildId);
      return true;
    } catch (e) {
      logger.error('Skip error:', e.message);
      return false;
    }
  },

  /**
   * Stop playback and leave
   */
  stop: async (guildId, client) => {
    const distube = client.distube;
    const queue = distube?.getQueue(guildId);
    if (!queue) return false;

    try {
      await distube.stop(guildId);
      return true;
    } catch (e) {
      logger.error('Stop error:', e.message);
      return false;
    }
  },

  getQueue: (guildId, client) => {
    return client?.distube?.getQueue(guildId) || null;
  },
};

module.exports = musicManager;
