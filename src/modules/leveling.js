const db = require('./database');
const config = require('../../config.json');
const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

function getRequiredXpForLevel(level) {
  return (level + 1) * 150;
}

const leveling = {
  addMessageXp: async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!config.leveling.enabled) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const now = Date.now();

    const userData = db.getUserLevel(guildId, userId);
    const cooldownMs = (config.leveling.cooldownSeconds || 60) * 1000;

    // Check cooldown
    if (now - userData.lastXpEarned < cooldownMs) {
      return;
    }

    // Calculate XP
    const minXp = config.leveling.minXp || 15;
    const maxXp = config.leveling.maxXp || 25;
    const earnedXp = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;

    let newXp = userData.xp + earnedXp;
    let newLevel = userData.level;
    let totalXp = userData.totalXp + earnedXp;

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
        .setColor(config.colors.success)
        .setTitle('🎉 LEVEL UP, GAMER!')
        .setDescription(`GG ${message.author}! You just leveled up to **Level ${newLevel}**! 🚀🎮\nKeep grinding and chatting with the squad!`)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `${config.botName} • Gaming Level System` })
        .setTimestamp();

      message.channel.send({ embeds: [levelUpEmbed] }).catch(() => {});
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

