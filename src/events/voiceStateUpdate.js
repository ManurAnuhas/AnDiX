const { ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../modules/database');
const logger = require('../utils/logger');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const guild = newState.guild || oldState.guild;
    const member = newState.member || oldState.member;
    const settings = db.getGuildSettings(guild.id);

    // 1. Check if member joined the "Join to Create" hub channel
    if (newState.channelId && settings.tempVoiceHubChannel && newState.channelId === settings.tempVoiceHubChannel) {
      try {
        const hubChannel = newState.channel;
        const parentCategory = hubChannel.parent;

        // Create new private/squad voice channel
        const tempVoiceChannel = await guild.channels.create({
          name: `🎮 ${member.displayName}'s Squad`,
          type: ChannelType.GuildVoice,
          parent: parentCategory ? parentCategory.id : undefined,
          userLimit: 5, // Default squad size
          permissionOverwrites: [
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak
              ]
            }
          ]
        });

        // Register temp voice
        db.addTempVoice(tempVoiceChannel.id, member.id);

        // Move member to the newly created room
        await member.voice.setChannel(tempVoiceChannel);
        logger.info(`Created dynamic squad VC [${tempVoiceChannel.name}] for ${member.user.tag}`);
      } catch (err) {
        logger.error('Failed to create dynamic temp voice channel:', err);
      }
    }

    // 2. Check if a temporary voice channel was vacated
    if (oldState.channelId && db.isTempVoice(oldState.channelId)) {
      const channel = oldState.channel;
      if (channel && channel.members.size === 0) {
        try {
          db.removeTempVoice(channel.id);
          await channel.delete('Auto-cleanup empty squad voice channel');
          logger.info(`Cleaned up empty squad VC: ${channel.name}`);
        } catch (err) {
          logger.error('Failed to delete empty temp voice channel:', err);
        }
      }
    }
  }
};

