const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const db = require('./database');
const logger = require('../utils/logger');
const config = require('../../config.json');

const serverArchitect = {
  buildCompleteServer: async (guild) => {
    logger.info(`Starting 1-Click Server Auto-Setup for: ${guild.name} (${guild.id})`);

    const result = {
      rolesCreated: [],
      categoriesCreated: [],
      channelsCreated: [],
      errors: []
    };

    const everyoneRole = guild.roles.everyone;

    // 1. Setup Standard Roles
    const rolesToCreate = [
      { name: '👑 Server Owner', color: '#F1C40F', hoist: true, mentionable: false },
      { name: '🛡️ Admin', color: '#E74C3C', hoist: true, mentionable: true, permissions: [PermissionFlagsBits.Administrator] },
      { name: '⚔️ Moderator', color: '#1ABC9C', hoist: true, mentionable: true, permissions: [
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.DeafenMembers
      ]},
      { name: '🌟 VIP Squad', color: '#E91E63', hoist: true, mentionable: true },
      { name: '🔔 Stream Notifications', color: '#FF0055', hoist: false, mentionable: true },
      { name: '🎮 Gamer', color: '#9945FF', hoist: true, mentionable: false },
      { name: '🔇 Muted', color: '#727C8A', hoist: false, mentionable: false }
    ];

    const roleMap = {};
    for (const rDef of rolesToCreate) {
      try {
        let existing = guild.roles.cache.find(r => r.name === rDef.name);
        if (!existing) {
          existing = await guild.roles.create({
            name: rDef.name,
            color: rDef.color,
            hoist: rDef.hoist,
            mentionable: rDef.mentionable,
            permissions: rDef.permissions || undefined,
            reason: 'AnDiX 1-Click Server Architect'
          });
          result.rolesCreated.push(existing.name);
        }
        roleMap[rDef.name] = existing;
      } catch (err) {
        result.errors.push(`Role ${rDef.name}: ${err.message}`);
      }
    }

    const adminRole = roleMap['🛡️ Admin'];
    const modRole = roleMap['⚔️ Moderator'];
    const gamerRole = roleMap['🎮 Gamer'];

    // 2. Setup Category: INFORMATION
    let infoCategory = null;
    try {
      infoCategory = await guild.channels.create({
        name: '📢 ─── INFORMATION ───',
        type: ChannelType.GuildCategory,
        reason: 'AnDiX Architecture'
      });
      result.categoriesCreated.push(infoCategory.name);

      const infoChannels = [
        { name: '👋・welcome', desc: 'Welcome our new community gamers!' },
        { name: '📜・rules', desc: 'Official server guidelines and community code of conduct' },
        { name: '📢・announcements', desc: 'Important server and stream news' },
        { name: '🔴・live-alerts', desc: 'Live stream broadcasts and notifications' },
        { name: '🎭・get-roles', desc: 'Pick your notification & game roles' }
      ];

      for (const ch of infoChannels) {
        const created = await guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildText,
          parent: infoCategory.id,
          topic: ch.desc,
          permissionOverwrites: [
            {
              id: everyoneRole.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
              deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads]
            }
          ]
        });
        result.channelsCreated.push(created.name);
        if (ch.name === '👋・welcome') db.updateGuildSettings(guild.id, 'welcomeChannel', created.id);
        if (ch.name === '🔴・live-alerts') db.updateGuildSettings(guild.id, 'streamChannel', created.id);
      }
    } catch (err) {
      result.errors.push(`Information Category: ${err.message}`);
    }

    // 3. Setup Category: COMMUNITY CHATS
    try {
      const commCategory = await guild.channels.create({
        name: '💬 ─── COMMUNITY ───',
        type: ChannelType.GuildCategory,
        reason: 'AnDiX Architecture'
      });
      result.categoriesCreated.push(commCategory.name);

      const commChannels = [
        { name: '💬・general-chat', desc: 'Main hangout lobby for all squad members' },
        { name: '🎬・clips-and-highlights', desc: 'Share your ace, clutches, and stream clips' },
        { name: '🤣・memes', desc: 'Gaming memes only' },
        { name: '🤖・bot-commands', desc: 'Check /rank, /leaderboard, /giveaway' }
      ];

      for (const ch of commChannels) {
        const created = await guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildText,
          parent: commCategory.id,
          topic: ch.desc
        });
        result.channelsCreated.push(created.name);
      }
    } catch (err) {
      result.errors.push(`Community Category: ${err.message}`);
    }

    // 4. Setup Category: GAMING LOBBIES
    try {
      const gameCategory = await guild.channels.create({
        name: '🎮 ─── GAMING SQUAD ───',
        type: ChannelType.GuildCategory,
        reason: 'AnDiX Architecture'
      });
      result.categoriesCreated.push(gameCategory.name);

      const gameChannels = [
        { name: '🎯・looking-for-group', desc: 'Find duo, trio or 5-stack teammates' },
        { name: '⚔️・squad-chat', desc: 'Game strategies and coordination' }
      ];

      for (const ch of gameChannels) {
        const created = await guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildText,
          parent: gameCategory.id,
          topic: ch.desc
        });
        result.channelsCreated.push(created.name);
      }
    } catch (err) {
      result.errors.push(`Gaming Category: ${err.message}`);
    }

    // 5. Setup Category: VOICE ROOMS (including "Join to Create" VC Hub)
    try {
      const voiceCategory = await guild.channels.create({
        name: '🔊 ─── VOICE ROOMS ───',
        type: ChannelType.GuildCategory,
        reason: 'AnDiX Architecture'
      });
      result.categoriesCreated.push(voiceCategory.name);

      // Join to Create Hub
      const hubVc = await guild.channels.create({
        name: '➕ Join to Create Squad VC',
        type: ChannelType.GuildVoice,
        parent: voiceCategory.id
      });
      result.channelsCreated.push(hubVc.name);
      db.updateGuildSettings(guild.id, 'tempVoiceHubChannel', hubVc.id);

      // Regular Voice Rooms
      const regularVcs = [
        { name: '🎮 Squad Duo (2)', limit: 2 },
        { name: '🎮 Squad Trio (3)', limit: 3 },
        { name: '🎮 Full 5-Stack (5)', limit: 5 },
        { name: '☕ Community Chill Lounge', limit: 0 },
        { name: '💤 AFK Sleeping', limit: 0 }
      ];

      for (const vc of regularVcs) {
        const created = await guild.channels.create({
          name: vc.name,
          type: ChannelType.GuildVoice,
          parent: voiceCategory.id,
          userLimit: vc.limit
        });
        result.channelsCreated.push(created.name);
      }
    } catch (err) {
      result.errors.push(`Voice Category: ${err.message}`);
    }

    // 6. Setup Category: STAFF & SECURITY AUDIT (Strictly Hidden)
    try {
      const staffCategory = await guild.channels.create({
        name: '🛡️ ─── STAFF & AUDIT ───',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: everyoneRole.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          ...(adminRole ? [{
            id: adminRole.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
          }] : []),
          ...(modRole ? [{
            id: modRole.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
          }] : [])
        ]
      });
      result.categoriesCreated.push(staffCategory.name);

      // Mod logs channel
      const modLogChan = await guild.channels.create({
        name: '🛡️・mod-logs',
        type: ChannelType.GuildText,
        parent: staffCategory.id,
        topic: 'Live audit log of deleted messages, edits, kicks, bans, and automod strikes'
      });
      result.channelsCreated.push(modLogChan.name);
      db.updateGuildSettings(guild.id, 'modLogChannel', modLogChan.id);

      // Staff discussion
      const staffChat = await guild.channels.create({
        name: '💬・staff-chat',
        type: ChannelType.GuildText,
        parent: staffCategory.id,
        topic: 'Private moderation & streamer team channel'
      });
      result.channelsCreated.push(staffChat.name);
    } catch (err) {
      result.errors.push(`Staff Category: ${err.message}`);
    }

    // 7. Auto-configure Bot Roles in Database
    if (gamerRole) db.updateGuildSettings(guild.id, 'autoRoleId', gamerRole.id);
    if (roleMap['🔔 Stream Notifications']) {
      db.updateGuildSettings(guild.id, 'streamPingRole', roleMap['🔔 Stream Notifications'].id);
    }

    logger.success(`1-Click Server Setup completed for ${guild.name}!`);
    return result;
  }
};

module.exports = serverArchitect;

