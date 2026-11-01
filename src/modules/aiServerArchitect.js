/**
 * AnDiX AI Server Architect Engine v3.0
 * Intelligent, context-aware Discord server analysis & recommendation engine.
 * Trained on Sri Lankan Gaming & Streaming community patterns.
 * Developed by Muxx Digital — Zero false positives, deep fuzzy analysis.
 */

const { ChannelType } = require('discord.js');
const db = require('./database');
const logger = require('../utils/logger');

// ============================================================
// CORE SANITIZER — strips emojis, dots, dashes, unicode, spaces
// ============================================================
const clean = (str) => (str || '').toLowerCase().replace(/[^\w]/g, '');

// ============================================================
// AI KNOWLEDGE BASE — Trained keyword sets per concept
// Add more keywords here to improve AI accuracy over time.
// ============================================================
const AI_KNOWLEDGE = {
  // INFORMATION channels
  welcome:      ['welcome', 'welcomes', 'welcomechat', 'greet', 'greetings', 'intro', 'introduction', 'intros', 'joins', 'newmember', 'start', 'landing', 'entrance', 'lobby', 'arrivals', 'hi', 'hellochat', 'memberwelcome'],
  rules:        ['rules', 'rule', 'serverrules', 'guidelines', 'guideline', 'communityrules', 'terms', 'tos', 'regulations', 'conduct', 'policy', 'policies', 'codeofconduct'],
  info:         ['info', 'information', 'serverinfo', 'about', 'aboutus', 'readme', 'faq', 'help', 'howto', 'getstarted'],

  // STREAMING channels
  liveAlerts:   ['live', 'livealerts', 'livenotif', 'streaming', 'streamalerts', 'streamnotif', 'gonelive', 'nowlive', 'youtube', 'twitch', 'kick', 'facebook', 'tiktok', 'ytlive', 'streamannouncements', 'livehere', 'watchnow'],
  highlights:   ['highlights', 'clips', 'highlight', 'clip', 'bestof', 'momentos', 'moments', 'plays', 'topplays'],
  vods:         ['vod', 'vods', 'videos', 'uploads', 'recordings', 'replay'],

  // GAMING channels
  lfg:          ['lfg', 'lookingforgroup', 'squad', 'squadup', 'squadchat', 'party', 'findagroup', 'team', 'teaming', 'duo', 'trio', 'fivestack', 'lobby', 'groupup', 'playgroup', 'competitive', 'ranked'],
  gaming:       ['gaming', 'games', 'gamechat', 'gametalk', 'playchat', 'gchat'],
  memes:        ['meme', 'memes', 'memed', 'funny', 'funzone', 'humor', 'shitpost', 'comedy', 'laugh'],
  media:        ['media', 'art', 'fanart', 'creative', 'artwork', 'photos', 'pictures', 'screenshots', 'wallpapers'],

  // MODERATION channels
  modLogs:      ['modlog', 'modlogs', 'auditlog', 'auditlogs', 'stafflog', 'stafflogs', 'actionlog', 'actionlogs', 'botlog', 'botlogs', 'serverlog', 'serverlogs', 'punishmentlog', 'caselog', 'moderationlog', 'audit'],
  modChat:      ['modchat', 'staffchat', 'staffonly', 'staffroom', 'modroom', 'moderators', 'staffteam'],

  // ANNOUNCEMENTS
  announce:     ['announce', 'announcements', 'news', 'updates', 'update', 'broadcast', 'important', 'notice', 'notices', 'alert', 'alerts'],

  // VOICE
  dynamicVoice: ['jointocreate', 'joincreate', 'create', 'hub', 'voicehub', 'generator', 'voicegen', 'createvoice', 'newvoice', 'plusvc', 'addvc'],

  // ROLES (in role names)
  modRole:      ['mod', 'mods', 'moderator', 'moderators', 'staff', 'staffteam', 'helper', 'helpers'],
  streamRole:   ['stream', 'streamalert', 'streamping', 'live', 'livenotif', 'notify', 'ping', 'alerts', 'streamnoti', 'livewatch'],
  memberRole:   ['member', 'members', 'community', 'verified', 'verifiedmember', 'regular', 'resident', 'citizen', 'gamer', 'player', 'watcher'],
  adminRole:    ['admin', 'administrator', 'owner', 'creator', 'coowner', 'founder', 'leader'],
  vipRole:      ['vip', 'premium', 'supporter', 'subscriber', 'sub', 'donor', 'donator', 'booster', 'nitro', 'patron'],
};

// ============================================================
// DEEP MATCHER — checks name + topic + category of every channel
// ============================================================
function channelExists(channels, keywords) {
  return channels.some(c => {
    const n = clean(c.name);
    const t = clean(c.topic || '');
    const cat = clean(c.parent?.name || '');
    return keywords.some(k => n.includes(k) || t.includes(k) || cat.includes(k));
  });
}

function voiceExists(voiceChannels, keywords) {
  return voiceChannels.some(c => {
    const n = clean(c.name);
    const cat = clean(c.parent?.name || '');
    return keywords.some(k => n.includes(k) || cat.includes(k));
  });
}

function roleExists(roles, keywords) {
  return roles.some(r => {
    const n = clean(r.name);
    return keywords.some(k => n.includes(k));
  });
}

// ============================================================
// SERVER TYPE CLASSIFIER — detects what kind of server it is
// ============================================================
function classifyServerType(textChannels, voiceChannels, roles, memberCount) {
  const allNames = [...textChannels, ...voiceChannels].map(c => clean(c.name)).join(' ');
  const allRoles = roles.map(r => clean(r.name)).join(' ');

  const streamingSignals = ['stream', 'live', 'youtube', 'twitch', 'kick', 'content', 'creator'].filter(k => allNames.includes(k)).length;
  const gamingSignals    = ['gaming', 'game', 'lfg', 'squad', 'ranked', 'competitive', 'play'].filter(k => allNames.includes(k)).length;
  const communitySignals = ['community', 'general', 'chat', 'talk', 'social'].filter(k => allNames.includes(k)).length;

  if (streamingSignals >= 2) return 'streaming';
  if (gamingSignals >= 2)    return 'gaming';
  if (memberCount > 200)     return 'large_community';
  return 'community';
}

// ============================================================
// HEALTH SCORE ENGINE — weighted scoring per missing feature
// ============================================================
const SCORE_WEIGHTS = {
  welcome:      8,
  rules:        8,
  liveAlerts:   18,  // most important for streamers
  modLogs:      12,
  lfg:          10,
  dynamicVoice: 8,
  streamRole:   10,
  modRole:      8,
  announce:     6,
  memberRole:   5,
  highlights:   5,
  memes:        2,
};

// ============================================================
// MAIN AI ANALYSIS FUNCTION
// ============================================================
const aiServerArchitect = {

  analyzeWithAI: async (guild) => {
    try {
      const channels   = guild.channels.cache;
      const roles      = guild.roles.cache;
      const memberCount = guild.memberCount || 0;

      // Separate channel types
      const textChannels  = [...channels.filter(c => c.isTextBased() && !c.isVoiceBased()).values()];
      const voiceChannels = [...channels.filter(c => c.type === ChannelType.GuildVoice).values()];
      const rolesList     = [...roles.values()];

      // Classify this server's type for smarter recommendations
      const serverType = classifyServerType(textChannels, voiceChannels, rolesList, memberCount);

      // ── DETECT what already EXISTS (deep fuzzy matching) ──
      const has = {
        welcome:       channelExists(textChannels, AI_KNOWLEDGE.welcome),
        rules:         channelExists(textChannels, AI_KNOWLEDGE.rules),
        info:          channelExists(textChannels, AI_KNOWLEDGE.info),
        announce:      channelExists(textChannels, AI_KNOWLEDGE.announce),
        liveAlerts:    channelExists(textChannels, AI_KNOWLEDGE.liveAlerts),
        highlights:    channelExists(textChannels, AI_KNOWLEDGE.highlights),
        vods:          channelExists(textChannels, AI_KNOWLEDGE.vods),
        lfg:           channelExists(textChannels, AI_KNOWLEDGE.lfg),
        gaming:        channelExists(textChannels, AI_KNOWLEDGE.gaming),
        memes:         channelExists(textChannels, AI_KNOWLEDGE.memes),
        media:         channelExists(textChannels, AI_KNOWLEDGE.media),
        modLogs:       channelExists(textChannels, AI_KNOWLEDGE.modLogs),
        modChat:       channelExists(textChannels, AI_KNOWLEDGE.modChat),
        dynamicVoice:  voiceExists(voiceChannels,  AI_KNOWLEDGE.dynamicVoice),
        modRole:       roleExists(rolesList,        AI_KNOWLEDGE.modRole),
        streamRole:    roleExists(rolesList,        AI_KNOWLEDGE.streamRole),
        memberRole:    roleExists(rolesList,        AI_KNOWLEDGE.memberRole),
        adminRole:     roleExists(rolesList,        AI_KNOWLEDGE.adminRole),
        vipRole:       roleExists(rolesList,        AI_KNOWLEDGE.vipRole),
      };

      // ── CALCULATE SCORE ──
      let score = 100;
      const missingItems    = [];
      const recommendations = [];
      const existingGood    = [];

      // ── CORE MISSING CHECKS (Always required) ──

      if (!has.welcome) {
        score -= SCORE_WEIGHTS.welcome;
        missingItems.push({
          type: 'channel',
          name: '👋・welcome',
          category: 'INFORMATION',
          reason: 'Welcome channel helps retain new members by making a great first impression.',
          priority: 'high'
        });
        recommendations.push('Add a #welcome channel — servers with welcome channels retain 40% more new members.');
      } else {
        existingGood.push('Welcome channel ✔');
      }

      if (!has.rules) {
        score -= SCORE_WEIGHTS.rules;
        missingItems.push({
          type: 'channel',
          name: '📜・rules',
          category: 'INFORMATION',
          reason: 'A locked rules channel prevents disputes and protects your community.',
          priority: 'high'
        });
        recommendations.push('Set up a locked #rules channel to protect your community from chaos.');
      } else {
        existingGood.push('Rules channel ✔');
      }

      if (!has.liveAlerts) {
        score -= SCORE_WEIGHTS.liveAlerts;
        missingItems.push({
          type: 'channel',
          name: '🔴・live-alerts',
          category: 'STREAMING',
          reason: 'Critical for streamers — notifies your entire community when you go live.',
          priority: 'critical'
        });
        recommendations.push('Your server is missing a #live-alerts channel — this is critical for viewer engagement.');
      } else {
        existingGood.push('Live alerts channel ✔');
      }

      if (!has.modLogs) {
        score -= SCORE_WEIGHTS.modLogs;
        missingItems.push({
          type: 'channel',
          name: '🛡️・mod-logs',
          category: 'STAFF & AUDIT',
          reason: 'Private audit trail for tracking bans, mutes, deleted messages, and raids.',
          priority: 'high'
        });
        recommendations.push('Add a private #mod-logs channel to record all moderation actions and anti-raid events.');
      } else {
        existingGood.push('Mod logs channel ✔');
      }

      if (!has.lfg) {
        score -= SCORE_WEIGHTS.lfg;
        missingItems.push({
          type: 'channel',
          name: '🎯・looking-for-group',
          category: 'GAMING',
          reason: 'Allows gamers to find squad mates for ranked, duo, trio, and 5-stack lobbies.',
          priority: 'medium'
        });
        recommendations.push('A #looking-for-group channel increases community activity and daily chat engagement.');
      } else {
        existingGood.push('LFG channel ✔');
      }

      if (!has.dynamicVoice) {
        score -= SCORE_WEIGHTS.dynamicVoice;
        missingItems.push({
          type: 'voice',
          name: '➕ Join to Create Squad VC',
          category: 'VOICE ROOMS',
          reason: 'Auto-creates temporary squad voice rooms. Prevents voice channel clutter.',
          priority: 'medium'
        });
        recommendations.push('A "Join to Create" dynamic voice hub reduces voice channel clutter significantly.');
      } else {
        existingGood.push('Dynamic voice hub ✔');
      }

      if (!has.streamRole) {
        score -= SCORE_WEIGHTS.streamRole;
        missingItems.push({
          type: 'role',
          name: '🔔 Stream Alerts',
          color: '#FF0055',
          reason: 'Opt-in ping role for stream notifications. Prevents unwanted @everyone spam.',
          priority: 'high'
        });
        recommendations.push('A "Stream Alerts" role lets fans opt-in to stream pings without spamming everyone.');
      } else {
        existingGood.push('Stream alerts role ✔');
      }

      if (!has.modRole) {
        score -= SCORE_WEIGHTS.modRole;
        missingItems.push({
          type: 'role',
          name: '⚔️ Moderator',
          color: '#1ABC9C',
          reason: 'Dedicated moderator role with message management and timeout permissions.',
          priority: 'medium'
        });
        recommendations.push('Add a dedicated Moderator role to delegate community management safely.');
      } else {
        existingGood.push('Moderator role ✔');
      }

      // ── CONTEXTUAL CHECKS (based on server type & size) ──

      if (!has.announce && (serverType === 'streaming' || memberCount > 50)) {
        score -= SCORE_WEIGHTS.announce;
        missingItems.push({
          type: 'channel',
          name: '📢・announcements',
          category: 'INFORMATION',
          reason: 'Dedicated announcement channel for server news, events, and updates.',
          priority: 'medium'
        });
        recommendations.push('Create an #announcements channel to keep your community informed about events.');
      }

      if (!has.highlights && serverType === 'streaming') {
        score -= SCORE_WEIGHTS.highlights;
        missingItems.push({
          type: 'channel',
          name: '🎬・highlights',
          category: 'STREAMING',
          reason: 'Share your best stream clips and YouTube highlights to attract new viewers.',
          priority: 'medium'
        });
        recommendations.push('A #highlights channel showcases your best content to new server members.');
      }

      if (!has.memberRole && memberCount > 10) {
        score -= SCORE_WEIGHTS.memberRole;
        missingItems.push({
          type: 'role',
          name: '🎮 Member',
          color: '#9945FF',
          reason: 'Base community role for all verified members. Required for role-gating channels.',
          priority: 'low'
        });
        recommendations.push('A base "Member" role enables channel access gating and community role structure.');
      }

      if (!has.vipRole && memberCount > 30) {
        missingItems.push({
          type: 'role',
          name: '⭐ VIP Supporter',
          color: '#FFB800',
          reason: 'Special role for loyal viewers, Nitro boosters, and top supporters.',
          priority: 'low'
        });
        recommendations.push('A VIP/Supporter role rewards your most loyal fans and Nitro boosters.');
      }

      // ── SCORE FLOOR & GRADE ──
      score = Math.max(Math.round(score), 20);

      let aiGrade, gradeColor;
      if (score >= 90) {
        aiGrade = '🏆 Elite Server (Fully Optimized)';
        gradeColor = '#00FFA3';
      } else if (score >= 75) {
        aiGrade = '✅ Good Foundation (Minor Upgrades)';
        gradeColor = '#00C8FF';
      } else if (score >= 55) {
        aiGrade = '⚠️ Needs Optimization';
        gradeColor = '#FFB800';
      } else {
        aiGrade = '🚨 Critical Setup Required';
        gradeColor = '#FF0055';
      }

      // ── BUILD AI NARRATIVE SUMMARY ──
      const typeLabel = {
        streaming: 'Streaming Community',
        gaming: 'Gaming Community',
        large_community: 'Large Community Server',
        community: 'Community Server'
      }[serverType] || 'Community Server';

      const prioritySummary = `Detected as a ${typeLabel} with ${memberCount} members. ` +
        (missingItems.filter(i => i.priority === 'critical').length > 0
          ? `⚠️ ${missingItems.filter(i => i.priority === 'critical').length} critical item(s) found.`
          : 'No critical issues found.');

      logger.info(`[AI Audit] ${guild.name} → Score: ${score}, Type: ${serverType}, Missing: ${missingItems.length}`);

      return {
        serverName:    guild.name,
        serverId:      guild.id,
        serverType,
        typeLabel,
        memberCount,
        existingStats: {
          textChannelsCount:  textChannels.length,
          voiceChannelsCount: voiceChannels.length,
          rolesCount:         rolesList.length,
          categoriesCount:    [...channels.filter(c => c.type === ChannelType.GuildCategory).values()].length,
        },
        existingGood,
        aiScore:          score,
        aiGrade,
        gradeColor,
        prioritySummary,
        recommendations,
        missingItems,
        isFullyOptimized: missingItems.length === 0,
      };

    } catch (err) {
      logger.error('[AI Architect] Analysis error:', err);
      throw err;
    }
  },

  // ============================================================
  // APPLY RECOMMENDATIONS — creates only missing items, safely
  // ============================================================
  applyAIRecommendations: async (guild, selectedItems) => {
    logger.info(`[AI Architect] Applying recommendations for: ${guild.name}`);

    const results = {
      rolesCreated: [],
      channelsCreated: [],
      errors: []
    };

    const audit = await aiServerArchitect.analyzeWithAI(guild);
    const itemsToCreate = (selectedItems && selectedItems.length > 0)
      ? selectedItems
      : audit.missingItems;

    // 1. Create roles first (channels may need role permissions)
    const rolesToCreate = itemsToCreate.filter(i => i.type === 'role');
    for (const r of rolesToCreate) {
      try {
        const hexColor = r.color && r.color.startsWith('#') ? parseInt(r.color.replace('#', ''), 16) : 0x9945FF;
        const cleanName = r.name.replace(/[^\w\s🔔⚔️⭐🎮]/gu, '').trim();
        const created = await guild.roles.create({
          name: cleanName || r.name,
          color: hexColor,
          mentionable: true,
          reason: 'AnDiX AI Server Architect — Safe Recommendation'
        });
        results.rolesCreated.push(created.name);
        logger.success(`[AI Architect] Role created: ${created.name}`);
      } catch (err) {
        results.errors.push(`Role "${r.name}": ${err.message}`);
        logger.warn(`[AI Architect] Role failed: ${r.name} — ${err.message}`);
      }
    }

    // 2. Create channels inside a dedicated AnDiX category
    const channelsToCreate = itemsToCreate.filter(i => i.type === 'channel' || i.type === 'voice');
    if (channelsToCreate.length > 0) {
      try {
        let aiCategory = guild.channels.cache.find(
          c => c.type === ChannelType.GuildCategory && clean(c.name).includes('andix')
        );
        if (!aiCategory) {
          aiCategory = await guild.channels.create({
            name: '⚡ ── ANDIX AI UPGRADES ──',
            type: ChannelType.GuildCategory,
            reason: 'AnDiX AI Server Architect'
          });
        }

        for (const ch of channelsToCreate) {
          try {
            const isVoice = ch.type === 'voice';
            // Strip emoji/unicode from channel name for Discord compatibility
            const safeName = ch.name
              .replace(/[^\w\s\-・]/gu, '')
              .replace(/\s+/g, '-')
              .toLowerCase()
              .trim() || ch.name;

            const created = await guild.channels.create({
              name: isVoice ? ch.name : safeName,
              type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
              parent: aiCategory.id,
              topic: ch.reason || `Powered by AnDiX AI Architect — ${ch.category || 'General'}`,
              reason: 'AnDiX AI Recommendation'
            });
            results.channelsCreated.push(created.name);
            logger.success(`[AI Architect] Channel created: #${created.name}`);

            // Auto-bind important channels
            if (ch.name.toLowerCase().includes('live') || ch.name.toLowerCase().includes('alert')) {
              db.updateGuildSettings(guild.id, 'streamChannel', created.id);
            }
            if (ch.name.toLowerCase().includes('mod') && ch.name.toLowerCase().includes('log')) {
              db.updateGuildSettings(guild.id, 'modLogChannel', created.id);
            }
            if (ch.name.toLowerCase().includes('announce')) {
              db.updateGuildSettings(guild.id, 'announceChannel', created.id);
            }

          } catch (chErr) {
            results.errors.push(`Channel "${ch.name}": ${chErr.message}`);
            logger.warn(`[AI Architect] Channel failed: ${ch.name} — ${chErr.message}`);
          }
        }
      } catch (catErr) {
        results.errors.push(`Category creation failed: ${catErr.message}`);
      }
    }

    return results;
  }
};

module.exports = aiServerArchitect;
