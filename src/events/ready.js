const { ActivityType, Events } = require('discord.js');
const logger = require('../utils/logger');
const config = require('../../config.json');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.success(`Logged in and operational as ${client.user.tag}!`);
    logger.info(`Loaded ${client.commands.size} slash commands across ${client.guilds.cache.size} server(s).`);

    const statuses = [
      { name: `🔴 LIVE on ${config.streamer.name}`, type: ActivityType.Streaming, url: config.streamer.twitch || 'https://twitch.tv' },
      { name: '🛡️ AutoMod: Protecting Chat', type: ActivityType.Custom },
      { name: '🎮 /stream live | Gaming Hub', type: ActivityType.Playing },
      { name: '🏆 Top Gamers /leaderboard', type: ActivityType.Watching }
    ];

    let current = 0;
    const updatePresence = () => {
      const status = statuses[current];
      client.user.setPresence({
        activities: [{
          name: status.name,
          type: status.type,
          url: status.url
        }],
        status: 'online'
      });
      current = (current + 1) % statuses.length;
    };

    updatePresence();
    setInterval(updatePresence, 30000); // Rotate every 30 seconds
  }
};

