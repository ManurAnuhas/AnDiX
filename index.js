require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection
} = require('discord.js');
const { DisTube } = require('distube');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');
const config = require('./config.json');
const { startDashboard } = require('./src/dashboard/server');

// Determine stable ffmpeg path (prefer @ffmpeg-installer to prevent SIGSEGV)
let ffmpegPath = ffmpegInstaller.path;
try {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    const ffmpegStatic = require('ffmpeg-static');
    ffmpegPath = ffmpegStatic;
  }
} catch (e) {
  ffmpegPath = 'ffmpeg';
}
logger.info(`FFmpeg binary active at: ${ffmpegPath}`);

// Initialize Discord Client with required Gateway Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Required for AutoMod & XP
    GatewayIntentBits.GuildMembers,   // Required for Welcomer & AutoRole
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates, // Required for Squad Temp Voice Channels
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

// Initialize DisTube with SoundCloud plugin + low-memory single-thread ffmpeg
client.distube = new DisTube(client, {
  ffmpeg: {
    path: ffmpegPath || 'ffmpeg',
    args: {
      global: {
        threads: '1',
      }
    }
  },
  plugins: [
    new SoundCloudPlugin()
  ],
  emitNewSongOnly: true,
  joinNewVoiceChannel: true,
  nsfw: true,
});

// DisTube event listeners
client.distube
  .on('playSong', (queue, song) => {
    logger.success(`🎵 Now playing: ${song.name} | Duration: ${song.formattedDuration}`);
  })
  .on('addSong', (queue, song) => {
    logger.info(`🎵 Added to queue: ${song.name}`);
  })
  .on('error', (error, queue, song) => {
    logger.error('DisTube Error Event:', error?.stack || error?.message || error);
  })
  .on('empty', queue => {
    logger.info('Voice channel is empty, leaving...');
  })
  .on('searchNoResult', (message, query) => {
    logger.warn(`No results found for: ${query}`);
  })
  .on('finish', queue => {
    logger.info('Queue finished, bot will leave soon.');
  })
  .on('ffmpegDebug', (debug) => {
    logger.info(`FFmpeg debug: ${debug}`);
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

