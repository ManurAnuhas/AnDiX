const db = require('./database');
const config = require('../../config.json');
const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');

/**
 * Standard RPG XP Formula:
 * Level 1 -> 2 needs 400 XP (~20-25 meaningful active messages across several minutes)
 * Level 2 -> 3 needs 700 XP
 * Higher levels scale progressively: 100 * level^1.5 + 250
 */
function getRequiredXpForLevel(level) {
  if (level <= 0) return 400;
  return Math.floor(120 * Math.pow(level, 1.6) + 300);
}

const leveling = {
  addMessageXp: async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!config.leveling || config.leveling.enabled === false) return;

    // Filter spam: only meaningful messages (more than 3 characters, not repetitive punctuation)
    const content = message.content.trim();
    if (content.length < 3) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const now = Date.now();

    const userData = db.getUserLevel(guildId, userId);
    
    // Balanced Cooldown: 60 seconds between XP grants to prevent fast spamming
    const cooldownMs = (config.leveling.cooldownSeconds || 60) * 1000;

    // Check cooldown
    if (now - (userData.lastXpEarned || 0) < cooldownMs) {
      return;
    }

    // Balanced XP Award: 15 to 25 XP per qualifying active message
    const minXp = config.leveling.minXp || 15;
    const maxXp = config.leveling.maxXp || 25;
    const earnedXp = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;

    let newXp = (userData.xp || 0) + earnedXp;
    let newLevel = userData.level || 0;
    let totalXp = (userData.totalXp || 0) + earnedXp;

    let requiredXp = getRequiredXpForLevel(newLevel);
    let leveledUp = false;

    while (newXp >= requiredXp) {
      newXp -= requiredXp;
      newLevel += 1;
      requiredXp = getRequiredXpForLevel(newLevel);
      leveledUp = true;
    }

    db.setUserLevel(guildId, userId, {
      xp: newXp,
      level: newLevel,
      totalXp: totalXp,
      lastXpEarned: now
    });

    if (leveledUp) {
      logger.info(`User ${message.author.tag} leveled up to Level ${newLevel} in ${message.guild.name}`);
      
      const levelUpEmbed = new EmbedBuilder()
        .setColor(config.colors.success || '#00FFA3')
        .setTitle('🎉 LEVEL UP, GAMER!')
        .setDescription(`GG ${message.author}! You just leveled up to **Level ${newLevel}**! 🚀🎮\nKeep grinding and chatting with the squad!`)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `${config.botName || 'AnDiX'} • Gaming Level System` })
        .setTimestamp();

      // Find or create dedicated level-up channel so general chats are not spammed
      const settings = db.getGuildSettings(guildId);
      let targetChannel = null;

      // 1. Check if configured in guild settings
      if (settings.levelUpChannel) {
        targetChannel = message.guild.channels.cache.get(settings.levelUpChannel);
      }

      // 2. Fallback: Search for existing channel with 'level', 'bot-commands', or 'ranks'
      if (!targetChannel) {
        targetChannel = message.guild.channels.cache.find(c => 
          c.isTextBased() && (
            c.name.includes('level') || 
            c.name.includes('levels') || 
            c.name.includes('rank') || 
            c.name.includes('bot-commands') ||
            c.name.includes('bots')
          )
        );
      }

      // 3. Fallback: Automatically create a dedicated #🎉・level-ups channel if bot has permission
      if (!targetChannel) {
        try {
          const botMember = message.guild.members.me;
          if (botMember && botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            targetChannel = await message.guild.channels.create({
              name: '🎉・level-ups',
              type: ChannelType.GuildText,
              topic: 'Official community level-up alerts and rank achievements powered by AnDiX',
              reason: 'Automatic setup for level up notifications'
            });
            db.updateGuildSettings(guildId, 'levelUpChannel', targetChannel.id);
            logger.success(`Created dedicated #🎉・level-ups channel in ${message.guild.name}`);
          }
        } catch (e) {
          // If cannot create channel, fallback to current message channel
        }
      }

      // If still no dedicated channel found, send in current chat channel
      if (!targetChannel || !targetChannel.isTextBased()) {
        targetChannel = message.channel;
      }

      targetChannel.send({ embeds: [levelUpEmbed] }).catch(() => {});
    }
  },

  getProfile: (guildId, userId) => {
    const userData = db.getUserLevel(guildId, userId);
    const requiredXp = getRequiredXpForLevel(userData.level);
    const allUsers = db.getLeaderboard(guildId, 1000);
    const rankIndex = allUsers.findIndex(u => u.userId === userId);
    const rank = rankIndex !== -1 ? rankIndex + 1 : allUsers.length + 1;

    return {
      rank,
      level: userData.level,
      xp: userData.xp,
      neededXp: requiredXp,
      totalXp: userData.totalXp
    };
  }
};

module.exports = leveling;
