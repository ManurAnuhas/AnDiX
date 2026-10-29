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
    .replace(/official|music|video|audio|lyrics|hd|4k/gi, '')
    .trim();
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
      // If it's a YouTube URL or query string, extract search term
      let searchTerm = cleanQuery;
      const isYoutube = /(?:youtu\.be\/|youtube\.com)/i.test(cleanQuery);

      if (isYoutube) {
        try {
          const ytResult = await yts(cleanQuery);
          if (ytResult && ytResult.title) {
            searchTerm = cleanTitle(ytResult.title);
            songMetadata = {
              title: ytResult.title,
              thumbnail: ytResult.thumbnail || ytResult.image,
              duration: ytResult.timestamp || 'Unknown'
            };
          }
        } catch (e) {
          logger.warn('YouTube search metadata fallback:', e.message);
        }
      }

      // Search SoundCloud directly for public tracks
      try {
        const scResults = await scClient.search(searchTerm, 'track');
        if (scResults && scResults.length > 0) {
          // Find first track that contains a valid url
          const bestTrack = scResults[0];
          playTarget = bestTrack.url;
          logger.info(`Resolved "${cleanQuery}" to SoundCloud: ${playTarget}`);
        } else {
          // If search returned empty, pass as SoundCloud query
          playTarget = `scsearch:${searchTerm}`;
        }
      } catch (err) {
        logger.warn('SoundCloud direct search fallback:', err.message);
        playTarget = `scsearch:${cleanQuery}`;
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
