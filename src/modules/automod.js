const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config.json');
const db = require('./database');
const embeds = require('./embeds');
const logger = require('../utils/logger');

// Sliding window cache for message flooding: userId -> [timestamp, timestamp, ...]
const userMessageHistory = new Map();

// Recent messages for duplicate detection: userId -> [ { content, timestamp } ]
const userLastMessages = new Map();

// Strike tracking for repeated spam offenders: userId -> { strikes: number, lastStrike: number }
const userSpamStrikes = new Map();

// Discord invite regex
const DISCORD_INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;

// Clean old cache entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, history] of userMessageHistory.entries()) {
    const valid = history.filter(ts => now - ts < 10000);
    if (valid.length === 0) userMessageHistory.delete(userId);
    else userMessageHistory.set(userId, valid);
  }
  for (const [userId, messages] of userLastMessages.entries()) {
    const valid = messages.filter(m => now - m.timestamp < 30000);
    if (valid.length === 0) userLastMessages.delete(userId);
    else userLastMessages.set(userId, valid);
  }
  for (const [userId, strikeData] of userSpamStrikes.entries()) {
    if (now - strikeData.lastStrike > 60 * 60 * 1000) {
      userSpamStrikes.delete(userId);
    }
  }
}, 5 * 60 * 1000);

async function sendModLog(guild, embed) {
  try {
    const settings = db.getGuildSettings(guild.id);
    if (!settings.modLogChannel) return;
    const channel = guild.channels.cache.get(settings.modLogChannel);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    logger.error('Failed to dispatch mod log:', error);
  }
}

async function notifyUserAndCleanup(message, reasonText, deleteMessage = true) {
  try {
    if (deleteMessage && message.deletable) {
      await message.delete().catch(() => {});
    }

    const warnMsg = await message.channel.send({
      content: `⚠️ ${message.author}, ${reasonText}`
    }).catch(() => {});

    if (warnMsg) {
      setTimeout(() => {
        warnMsg.delete().catch(() => {});
      }, 5000);
    }
  } catch (err) {
    // Ignore message deletion race conditions
  }
}

async function handleSpamMemberPunishment(message, reason) {
  const member = message.member;
  if (!member || !member.moderatable) return;

  const userId = message.author.id;
  const now = Date.now();
  let strikeInfo = userSpamStrikes.get(userId) || { strikes: 0, lastStrike: 0 };
  
  strikeInfo.strikes += 1;
  strikeInfo.lastStrike = now;
  userSpamStrikes.set(userId, strikeInfo);

  logger.automod(`Spam strike #${strikeInfo.strikes} for ${message.author.tag} in ${message.guild.name}: ${reason}`);

  if (strikeInfo.strikes >= 3) {
    // 3rd strike: Auto-kick spam member / spam bot
    try {
      await member.kick(`AutoMod: Exceeded maximum spam strikes (${reason})`);
      logger.automod(`Auto-kicked spam member ${message.author.tag} from ${message.guild.name}`);
      
      const logEmbed = embeds.modLog(
        'AUTO-KICK (SPAMMER/RAID BOT)',
        message.author,
        message.client.user,
        `Exceeded 3 spam strikes. Last infraction: ${reason}`
      );
      await sendModLog(message.guild, logEmbed);

      await message.channel.send({
        embeds: [embeds.error('Spam Member Removed', `🛡️ **${message.author.tag}** was automatically removed for repeated spamming.`)]
      }).catch(() => {});
      return;
    } catch (err) {
      logger.error('Failed to auto-kick spam member:', err);
    }
  }

  // 1st or 2nd strike: Timeout member
  try {
    const timeoutMinutes = config.automod.autoTimeoutMinutes || 5;
    await member.timeout(timeoutMinutes * 60 * 1000, `AutoMod: ${reason}`);

    const logEmbed = embeds.modLog(
      'AUTO-TIMEOUT (SPAM PROTECTION)',
      message.author,
      message.client.user,
      `${reason} (Timeout: ${timeoutMinutes} minutes)`
    );
    await sendModLog(message.guild, logEmbed);

    await message.channel.send({
      embeds: [embeds.warning('Spammer Timed Out', `🔇 **${message.author.tag}** has been placed in timeout for **${timeoutMinutes} minutes** due to spamming.`)]
    }).catch(() => {});
  } catch (err) {
    logger.error('Failed to auto-timeout user:', err);
  }
}

const automod = {
  checkMessage: async (message) => {
    // Ignore bots and webhooks
    if (message.author.bot || message.webhookId) return false;
    if (!message.guild) return false;

    // Check if AutoMod is enabled for this server
    const settings = db.getGuildSettings(message.guild.id);
    if (settings.automodEnabled === false) return false;

    // Bypass check for Admins and Moderators
    if (
      message.member?.permissions.has(PermissionFlagsBits.Administrator) ||
      message.member?.permissions.has(PermissionFlagsBits.ManageMessages)
    ) {
      return false;
    }

    const content = message.content.trim();
    const userId = message.author.id;
    const now = Date.now();

    // 1. Anti-Discord Invite Links
    if (config.automod.blockDiscordInvites && DISCORD_INVITE_REGEX.test(content)) {
      await notifyUserAndCleanup(message, 'Discord invite links are not permitted here!');
      const logEmbed = embeds.modLog(
        'AUTO-DELETE (DISCORD INVITE LINK)',
        message.author,
        message.client.user,
        `Attempted to post a Discord invite link in <#${message.channel.id}>`,
        [{ name: 'Message Content', value: `\`\`\`${content.slice(0, 500)}\`\`\`` }]
      );
      await sendModLog(message.guild, logEmbed);
      await handleSpamMemberPunishment(message, 'Posting unauthorized Discord invite links');
      return true;
    }

    // 2. Mass Mentions Detection
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    if (mentionCount >= config.automod.maxMentions) {
      await notifyUserAndCleanup(message, `Mass-mentioning is not allowed (${mentionCount} mentions detected)!`);
      const logEmbed = embeds.modLog(
        'AUTO-DELETE (MASS MENTIONS)',
        message.author,
        message.client.user,
        `Sent ${mentionCount} mentions in <#${message.channel.id}>`
      );
      await sendModLog(message.guild, logEmbed);
      await handleSpamMemberPunishment(message, `Mass mentions (${mentionCount} mentions)`);
      return true;
    }

    // 3. Blacklisted Words / Scam Links Detection
    const lowerContent = content.toLowerCase();
    for (const badWord of config.automod.bannedWords) {
      if (lowerContent.includes(badWord.toLowerCase())) {
        await notifyUserAndCleanup(message, 'Your message contained prohibited terms or suspicious links!');
        const logEmbed = embeds.modLog(
          'AUTO-DELETE (PROHIBITED TERM / SCAM)',
          message.author,
          message.client.user,
          `Triggered blacklist pattern: "${badWord}" in <#${message.channel.id}>`,
          [{ name: 'Message Content', value: `\`\`\`${content.slice(0, 500)}\`\`\`` }]
        );
        await sendModLog(message.guild, logEmbed);
        await handleSpamMemberPunishment(message, `Prohibited or scam link match (${badWord})`);
        return true;
      }
    }

    // 4. Rapid Message Flooding Spam
    let timestamps = userMessageHistory.get(userId) || [];
    const intervalMs = (config.automod.intervalSeconds || 4) * 1000;
    timestamps = timestamps.filter(ts => now - ts < intervalMs);
    timestamps.push(now);
    userMessageHistory.set(userId, timestamps);

    if (timestamps.length >= config.automod.maxMessagesPerInterval) {
      await notifyUserAndCleanup(message, 'Please slow down! Message flooding is detected.');
      const logEmbed = embeds.modLog(
        'AUTO-MOD (MESSAGE FLOODING)',
        message.author,
        message.client.user,
        `Sent ${timestamps.length} messages in ${config.automod.intervalSeconds}s in <#${message.channel.id}>`
      );
      await sendModLog(message.guild, logEmbed);
      await handleSpamMemberPunishment(message, 'Rapid message flooding / spamming');
      return true;
    }

    // 5. Duplicate Message Spam
    if (content.length > 3) {
      let recentMsgs = userLastMessages.get(userId) || [];
      recentMsgs = recentMsgs.filter(m => now - m.timestamp < 15000);
      recentMsgs.push({ content, timestamp: now });
      userLastMessages.set(userId, recentMsgs);

      const duplicates = recentMsgs.filter(m => m.content.toLowerCase() === lowerContent);
      if (duplicates.length >= config.automod.duplicateMessageThreshold) {
        await notifyUserAndCleanup(message, 'Stop repeating identical messages!');
        const logEmbed = embeds.modLog(
          'AUTO-MOD (DUPLICATE MESSAGE SPAM)',
          message.author,
          message.client.user,
          `Sent duplicate text ${duplicates.length} times in <#${message.channel.id}>`,
          [{ name: 'Repeated Message', value: `\`\`\`${content.slice(0, 300)}\`\`\`` }]
        );
        await sendModLog(message.guild, logEmbed);
        await handleSpamMemberPunishment(message, 'Repeated duplicate message spam');
        return true;
      }
    }

    return false; // Message is clean
  }
};

module.exports = automod;

