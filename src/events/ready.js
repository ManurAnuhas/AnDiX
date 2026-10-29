const { ActivityType, Events } = require('discord.js');
const logger = require('../utils/logger');
const config = require('../../config.json');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.success(`Logged in and operational as ${client.user.tag}!`);
    logger.info(`Loaded ${client.commands.size} slash commands across ${client.guilds.cache.size} server(s).`);

    // Professional Server Management Presence
    client.user.setPresence({
      activities: [{
        name: 'Managing Discord Communities | /help',
        type: ActivityType.Custom
      }],
      status: 'online'
    });
  }
};

