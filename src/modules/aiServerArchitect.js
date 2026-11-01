/**
 * AnDiX AI Server Architect Engine
 * Analyzes Discord servers and generates intelligent, custom gaming & streamer recommendations.
 * Developed by Muxx Digital
 */

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('./database');
const logger = require('../utils/logger');

const aiServerArchitect = {
  /**
   * Deep AI Audit of a Discord Guild
   */
  analyzeWithAI: async (guild) => {
    const channels = guild.channels.cache;
    const roles = guild.roles.cache;
    const memberCount = guild.memberCount || 0;

    const textChannels = channels.filter(c => c.isTextBased() && !c.isVoiceBased()).map(c => c.name.toLowerCase());
    const voiceChannels = channels.filter(c => c.isVoiceBased()).map(c => c.name.toLowerCase());
    const roleNames = roles.map(r => r.name.toLowerCase());

    // 1. Audit Checks
    const hasWelcome = textChannels.some(c => c.includes('welcome') || c.includes('joins') || c.includes('start'));
    const hasRules = textChannels.some(c => c.includes('rules') || c.includes('guidelines') || c.includes('terms'));
    const hasAnnounce = textChannels.some(c => c.includes('announce') || c.includes('news') || c.includes('updates'));
    const hasLiveAlerts = textChannels.some(c => c.includes('live') || c.includes('stream') || c.includes('twitch') || c.includes('youtube'));
    const hasModLogs = textChannels.some(c => c.includes('log') || c.includes('audit') || c.includes('mod-logs') || c.includes('staff'));
    const hasMemes = textChannels.some(c => c.includes('meme') || c.includes('clips') || c.includes('media'));
    const hasLobby = textChannels.some(c => c.includes('lfg') || c.includes('group') || c.includes('squad') || c.includes('looking'));

    const hasAdminRole = roleNames.some(r => r.includes('admin') || r.includes('owner'));
    const hasModRole = roleNames.some(r => r.includes('mod') || r.includes('staff'));
    const hasGamerRole = roleNames.some(r => r.includes('gamer') || r.includes('member') || r.includes('squad'));
    const hasStreamPingRole = roleNames.some(r => r.includes('stream') || r.includes('live') || r.includes('notify'));

    const hasDynamicVoice = voiceChannels.some(c => c.includes('join') || c.includes('create') || c.includes('hub'));

    // 2. Calculate AI Health Score
    let score = 100;
    const missingItems = [];
    const recommendations = [];

    if (!hasWelcome) {
      score -= 10;
      missingItems.push({ type: 'channel', name: '👋・welcome', category: 'INFORMATION', reason: 'Welcome lobby for greeting new community members.' });
      recommendations.push('Add an automated Welcome channel to increase member retention.');
    }
    if (!hasRules) {
      score -= 10;
      missingItems.push({ type: 'channel', name: '📜・rules', category: 'INFORMATION', reason: 'Crucial for server safety and community guidelines.' });
      recommendations.push('Setup a locked Rules channel to set community standards and prevent disputes.');
    }
    if (!hasLiveAlerts) {
      score -= 15;
      missingItems.push({ type: 'channel', name: '🔴・live-alerts', category: 'STREAMING', reason: 'Instant notifications when the streamer goes live on YouTube/Twitch.' });
      recommendations.push('Create a dedicated Live Alerts channel so viewers never miss your stream.');
    }
    if (!hasModLogs) {
      score -= 15;
      missingItems.push({ type: 'channel', name: '🛡️・mod-logs', category: 'STAFF & AUDIT', reason: 'Hidden audit trail tracking deleted messages, raids, and timeouts.' });
      recommendations.push('Add a private Mod Logs channel to record AutoMod strikes and deleted chats.');
    }
    if (!hasLobby) {
      score -= 10;
      missingItems.push({ type: 'channel', name: '🎯・looking-for-group', category: 'GAMING', reason: 'Squad finding room for duo, trio, and 5-stack multiplayer games.' });
      recommendations.push('Give gamers a Squad Finding (LFG) chat to play games together.');
    }
    if (!hasDynamicVoice) {
      score -= 10;
      missingItems.push({ type: 'voice', name: '➕ Join to Create Squad VC', category: 'VOICE ROOMS', reason: 'Smart dynamic voice generator (auto-creates temporary squad rooms).' });
      recommendations.push('Add a "Join to Create" temporary voice hub to prevent voice channel clutter.');
    }
    if (!hasStreamPingRole) {
      score -= 10;
      missingItems.push({ type: 'role', name: '🔔 Stream Alerts', color: '#FF0055', reason: 'Notification role pinged during YouTube/Twitch streams.' });
      recommendations.push('Create a Stream Notification Role so viewers can opt-in to stream pings.');
    }
    if (!hasModRole) {
      score -= 10;
      missingItems.push({ type: 'role', name: '⚔️ Moderator', color: '#1ABC9C', reason: 'Community moderation role with mute and message management.' });
      recommendations.push('Add a dedicated Moderator role with balanced staff permissions.');
    }

    score = Math.max(score, 35);

    // AI Health Grade
    let grade = 'A+ (Optimal)';
    let gradeColor = '#00FFA3';
    if (score < 60) {
      grade = 'Needs Optimization';
      gradeColor = '#FF0055';
    } else if (score < 85) {
      grade = 'Good Foundation (Upgrades Suggested)';
      gradeColor = '#FFB800';
    }

    return {
      serverName: guild.name,
      serverId: guild.id,
      memberCount,
      existingStats: {
        textChannelsCount: textChannels.length,
        voiceChannelsCount: voiceChannels.length,
        rolesCount: roleNames.length
      },
      aiScore: score,
      aiGrade: grade,
      gradeColor,
      recommendations,
      missingItems,
      isFullyOptimized: missingItems.length === 0
    };
  },

  /**
   * Apply ONLY the AI-Approved Missing Items (Leaves everything else intact!)
   */
  applyAIRecommendations: async (guild, selectedItems) => {
    logger.info(`Applying AnDiX AI Recommendations for: ${guild.name}`);
    const results = {
      rolesCreated: [],
      channelsCreated: [],
      errors: []
    };

    // If user passed specific items, use them; otherwise auto-audit and apply
    const audit = await aiServerArchitect.analyzeWithAI(guild);
    const itemsToCreate = selectedItems && selectedItems.length > 0 ? selectedItems : audit.missingItems;

    // Create missing roles
    const rolesToCreate = itemsToCreate.filter(i => i.type === 'role');
    for (const r of rolesToCreate) {
      try {
        const created = await guild.roles.create({
          name: r.name,
          color: r.color || '#9945FF',
          reason: 'AnDiX AI Server Architect Recommendation'
        });
        results.rolesCreated.push(created.name);
      } catch (err) {
        results.errors.push(`Role ${r.name}: ${err.message}`);
      }
    }

    // Create missing channels
    const channelsToCreate = itemsToCreate.filter(i => i.type === 'channel' || i.type === 'voice');
    if (channelsToCreate.length > 0) {
      try {
        // Find or create AI Upgrades Category
        let aiCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.includes('ANDIX RECOMMENDED'));
        if (!aiCategory) {
          aiCategory = await guild.channels.create({
            name: '⚡ ─── ANDIX SQUAD UPGRADES ───',
            type: ChannelType.GuildCategory,
            reason: 'AnDiX AI Server Architect'
          });
        }

        for (const ch of channelsToCreate) {
          const isVoice = ch.type === 'voice';
          const created = await guild.channels.create({
            name: ch.name,
            type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
            parent: aiCategory.id,
            topic: ch.reason || 'Created by AnDiX AI Architect',
            reason: 'AnDiX AI Recommendation'
          });
          results.channelsCreated.push(created.name);

          // Auto-bind settings if it's a live-alert or mod-log
          if (ch.name.includes('live-alerts')) db.updateGuildSettings(guild.id, 'streamChannel', created.id);
          if (ch.name.includes('mod-logs')) db.updateGuildSettings(guild.id, 'modLogChannel', created.id);
        }
      } catch (err) {
        results.errors.push(`Channels Error: ${err.message}`);
      }
    }

    return results;
  }
};

module.exports = aiServerArchitect;

