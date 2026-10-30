/**
 * AnDiX High-Performance Enterprise Lavalink Music Engine
 * Uses reliable Lavalink v4 cloud nodes for 100% stable Discord Voice playback.
 */

const { LavalinkManager } = require('lavalink-client');
const logger = require('../utils/logger');

let lavalink = null;

function initLavalink(client) {
  if (lavalink) return lavalink;

  lavalink = new LavalinkManager({
    nodes: [
      {
        authorization: 'youshallnotpass',
        host: 'lavalink.jirayu.net',
        port: 443,
        secure: true
      },
      {
        authorization: 'youshallnotpass',
        host: 'nodelink.gdjkhp.com',
        port: 443,
        secure: true
      },
      {
        authorization: 'https://seretia.link/discord',
        host: 'lavalinkv4.serenetia.com',
        port: 443,
        secure: true
      }
    ],
    sendToShard: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
    client: {
      id: client.user?.id || process.env.CLIENT_ID || '1565283272072761424',
      username: 'AnDiX'
    },
    autoSkip: true,
    playerOptions: {
      defaultSearchPlatform: 'ytsearch',
      onDisconnect: {
        autoReconnect: true,
        destroyPlayer: false
      }
    }
  });

  lavalink.nodeManager.on('connect', (node) => {
    logger.success(`🎵 Lavalink Cloud Audio Node Connected: ${node.options.host}`);
  });

  lavalink.nodeManager.on('disconnect', (node, reason) => {
    logger.warn(`Lavalink Node Disconnected: ${node.options.host}`);
  });

  lavalink.nodeManager.on('error', (node, error) => {
    // Suppress spammy log outputs for transient node disconnects
  });

  client.on('raw', (data) => lavalink.sendRawData(data));

  return lavalink;
}

const musicManager = {
  init: initLavalink,
  getManager: () => lavalink,

  play: async (voiceChannel, query, interaction, client) => {
    if (!lavalink) {
      initLavalink(client);
    }

    if (!lavalink.initiated) {
      await lavalink.init({ id: client.user.id, username: client.user.username });
    }

    const guildId = voiceChannel.guild.id;
    let player = lavalink.getPlayer(guildId);

    if (!player) {
      player = await lavalink.createPlayer({
        guildId: guildId,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channelId,
        selfDeaf: false,
        selfMute: false,
        volume: 100
      });
      await player.connect();
    }

    const res = await player.search({
      query: query.trim()
    }, interaction.user);

    if (!res || !res.tracks || res.tracks.length === 0) {
      throw new Error(`Could not find any song matching "${query}".`);
    }

    let songInfo = null;

    if (res.loadType === 'playlist') {
      for (const track of res.tracks) {
        await player.queue.add(track);
      }
      songInfo = {
        title: res.playlist?.title || 'Playlist',
        url: query,
        duration: `${res.tracks.length} Tracks`,
        thumbnail: res.tracks[0]?.info?.artworkUrl || res.tracks[0]?.info?.uri,
        requestedBy: interaction.user.tag
      };
      if (!player.playing) await player.play();
      return { status: 'queued_playlist', song: songInfo, count: res.tracks.length };
    }

    const track = res.tracks[0];
    songInfo = {
      title: track.info.title,
      url: track.info.uri,
      duration: track.info.duration ? formatDuration(track.info.duration) : 'Live / Audio',
      thumbnail: track.info.artworkUrl,
      requestedBy: interaction.user.tag
    };

    if (player.playing || player.paused) {
      await player.queue.add(track);
      return { status: 'queued', song: songInfo, position: player.queue.tracks.length };
    } else {
      await player.queue.add(track);
      await player.play();
      return { status: 'playing', song: songInfo };
    }
  },

  pause: (guildId) => {
    if (!lavalink) return null;
    const player = lavalink.getPlayer(guildId);
    if (!player) return null;

    if (player.paused) {
      player.resume();
      return 'resumed';
    } else {
      player.pause();
      return 'paused';
    }
  },

  skip: async (guildId) => {
    if (!lavalink) return false;
    const player = lavalink.getPlayer(guildId);
    if (!player || (!player.playing && player.queue.tracks.length === 0)) return false;
    await player.skip();
    return true;
  },

  stop: async (guildId) => {
    if (!lavalink) return false;
    const player = lavalink.getPlayer(guildId);
    if (!player) return false;
    await player.destroy();
    return true;
  }
};

function formatDuration(ms) {
  if (!ms || isNaN(ms)) return 'Live';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

module.exports = musicManager;
