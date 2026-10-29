/**
 * AnDiX Music Manager — DisTube v5 + SoundCloud Plugin
 * Handles music playback through SoundCloud (primary) via DisTube.
 * YouTube is also supported as fallback if not blocked by host.
 */

const logger = require('../utils/logger');

const musicManager = {
  /**
   * Play a song/search query using DisTube.
   * @param {import('discord.js').VoiceChannel} voiceChannel
   * @param {string} query - Song title or SoundCloud/YouTube URL
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  play: async (voiceChannel, query, interaction) => {
    const distube = interaction.client.distube;

    if (!distube) {
      throw new Error('Music system is not initialized. Please contact an admin.');
    }

    // Prefix SoundCloud search if it's not a URL (forces SC results)
    let resolvedQuery = query;
    const isUrl = /^https?:\/\//i.test(query);

    if (!isUrl) {
      // Use SoundCloud search prefix for reliable results
      resolvedQuery = `scsearch:${query}`;
    }

    logger.info(`Attempting to play: ${resolvedQuery}`);

    // Play via DisTube — it handles joining VC automatically
    await distube.play(voiceChannel, resolvedQuery, {
      member: interaction.member,
      textChannel: interaction.channel,
    });

    // Get current queue state
    const queue = distube.getQueue(voiceChannel.guildId);

    if (queue && queue.songs.length > 0) {
      const currentSong = queue.songs[0];
      const isQueued = queue.songs.length > 1;

      return {
        status: isQueued ? 'queued' : 'playing',
        song: {
          title: currentSong.name || query,
          url: currentSong.url || '',
          duration: currentSong.formattedDuration || 'Unknown',
          thumbnail: currentSong.thumbnail || null,
          requestedBy: interaction.user.tag,
        },
        position: isQueued ? queue.songs.length : 1,
      };
    }

    // Fallback return if queue state not immediately available
    return {
      status: 'playing',
      song: {
        title: query,
        url: '',
        duration: 'Unknown',
        thumbnail: null,
        requestedBy: interaction.user.tag,
      },
    };
  },

  /**
   * Skip the current song.
   * @param {string} guildId
   * @param {import('discord.js').Client} client
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
   * Stop playback and leave voice channel.
   * @param {string} guildId
   * @param {import('discord.js').Client} client
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

  /**
   * Get current queue for a guild.
   * @param {string} guildId
   * @param {import('discord.js').Client} client
   */
  getQueue: (guildId, client) => {
    return client?.distube?.getQueue(guildId) || null;
  },
};

module.exports = musicManager;
