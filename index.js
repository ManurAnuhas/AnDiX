require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');
const config = require('./config.json');
const { startDashboard } = require('./src/dashboard/server');

// Initialize Discord Client with required Gateway Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Required for AutoMod & XP
    GatewayIntentBits.GuildMembers,   // Required for Welcomer & AutoRole
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates, // Required for Squad Temp Voice Channels & Music
    GatewayIntentBits.GuildModeration   // Required for Ban / Moderation audit logs
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember
  ]
});

client.commands = new Collection();

// Recursive command loader
function loadCommands(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      loadCommands(fullPath);
    } else if (item.endsWith('.js')) {
      const command = require(fullPath);
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
      } else {
        logger.warn(`The command at ${fullPath} is missing required data or execute properties.`);
      }
    }
  }
}

const commandsPath = path.join(__dirname, 'src', 'commands');
loadCommands(commandsPath);

// Event loader
const eventsPath = path.join(__dirname, 'src', 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Error handling
process.on('unhandledRejection', error => {
  logger.error('Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
});

// Start Web Dashboard
if (config.dashboard?.enabled !== false) {
  startDashboard(client);
}

// Login check
const token = process.env.DISCORD_TOKEN;
if (!token || token.trim() === '' || token === 'your_bot_token_here') {
  logger.warn('========================================================');
  logger.warn('⚠ DISCORD_TOKEN is missing or not set in your .env file!');
  logger.warn('👉 Please open .env file and paste your Discord Bot Token.');
  logger.warn('👉 Then run: npm run deploy (to register slash commands)');
  logger.warn('👉 Then run: npm start (to start the bot)');
  logger.warn('========================================================');
} else {
  client.login(token).catch(err => {
    logger.error('Failed to login to Discord! Please check your BOT_TOKEN:', err);
  });
}

