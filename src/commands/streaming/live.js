const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const embeds = require('../../modules/embeds');
const db = require('../../modules/database');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stream')
    .setDescription('Manage streaming alerts and notifications')
    .addSubcommand(sub =>
      sub.setName('live')
        .setDescription('Broadcast a 🔴 GOING LIVE announcement to the server')
        .addStringOption(opt =>
          opt.setName('title')
            .setDescription('Title of your stream')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('game')
            .setDescription('Name of the game (e.g. Valorant, GTA V, Free Fire)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('platform')
            .setDescription('Streaming platform')
            .setRequired(true)
            .addChoices(
              { name: '📺 YouTube', value: 'YouTube' },
              { name: '🟣 Twitch', value: 'Twitch' },
              { name: '🟢 Kick', value: 'Kick' },
              { name: '🔵 Facebook Gaming', value: 'Facebook Gaming' }
            )
        )
        .addStringOption(opt =>
          opt.setName('url')
            .setDescription('Direct link to your stream')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('image_url')
            .setDescription('Custom stream banner or thumbnail image URL (Optional)')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('ping')
            .setDescription('Who to notify?')
            .setRequired(false)
            .addChoices(
              { name: '🔔 Stream Notification Role', value: 'role' },
              { name: '📢 @everyone', value: 'everyone' },
              { name: '📍 @here', value: 'here' },
              { name: '🔕 None', value: 'none' }
            )
        )
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.MentionEveryone) &&
        !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [embeds.error('Permission Denied', 'Only the Streamer or Admins can broadcast stream alerts.')],
        ephemeral: true
      });
    }

    const title = interaction.options.getString('title');
    const game = interaction.options.getString('game');
    const platform = interaction.options.getString('platform');
    const url = interaction.options.getString('url');
    const imageUrl = interaction.options.getString('image_url');
    const pingType = interaction.options.getString('ping') || 'role';

    const settings = db.getGuildSettings(interaction.guild.id);
    const targetChannelId = settings.streamChannel || interaction.channel.id;
    const targetChannel = interaction.guild.channels.cache.get(targetChannelId);

    if (!targetChannel || !targetChannel.isTextBased()) {
      return interaction.reply({
        embeds: [embeds.error('Channel Error', 'Could not locate the announcement channel. Please run `/setup` first.')],
        ephemeral: true
      });
    }

    // Determine mention content
    let mentionText = '';
    if (pingType === 'everyone') {
      mentionText = '@everyone';
    } else if (pingType === 'here') {
      mentionText = '@here';
    } else if (pingType === 'role' && settings.streamPingRole) {
      mentionText = `<@&${settings.streamPingRole}>`;
    }

    // Build interactive button
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(`Watch on ${platform}`)
        .setStyle(ButtonStyle.Link)
        .setURL(url)
        .setEmoji('🔴')
    );

    // Build embed
    const streamEmbed = embeds.streamLive({
      streamerName: interaction.member.displayName || config.streamer.name,
      title,
      game,
      platform,
      url,
      thumbnailUrl: imageUrl
    });

    try {
      await targetChannel.send({
        content: mentionText ? `${mentionText} 🚨 **STREAM IS LIVE!**` : undefined,
        embeds: [streamEmbed],
        components: [row]
      });

      return interaction.reply({
        embeds: [embeds.success('Stream Alert Sent!', `Successfully posted stream alert to ${targetChannel}! 🚀`)],
        ephemeral: true
      });
    } catch (err) {
      return interaction.reply({
        embeds: [embeds.error('Failed to Send Alert', err.message)],
        ephemeral: true
      });
    }
  }
};

