require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

function loadCommandFiles(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      loadCommandFiles(fullPath);
    } else if (item.endsWith('.js')) {
      const command = require(fullPath);
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        logger.info(`Found command: /${command.data.name}`);
      } else {
        logger.warn(`The command at ${fullPath} is missing a required "data" or "execute" property.`);
      }
    }
  }
}

loadCommandFiles(commandsPath);

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  logger.error('Missing DISCORD_TOKEN or CLIENT_ID in your .env file!');
  console.log('\n👉 Please open .env file and set your DISCORD_TOKEN and CLIENT_ID first.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    if (guildId && guildId.trim() !== '') {
      // Fast Guild-specific command deployment
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId.trim()),
        { body: commands }
      );
      logger.success(`Successfully reloaded ${data.length} guild (/) commands to guild: ${guildId}`);
    } else {
      // Global command deployment
      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      logger.success(`Successfully reloaded ${data.length} global (/) commands.`);
    }
  } catch (error) {
    logger.error('Failed to deploy application commands:', error);
  }
})();

