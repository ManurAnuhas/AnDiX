const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('../../modules/database');
const embeds = require('../../modules/embeds');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure server channels, roles, and bot features')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('channels')
        .setDescription('Set channels for alerts, welcome messages, and moderation logs')
        .addChannelOption(opt =>
          opt.setName('stream_channel')
            .setDescription('Channel for 🔴 Live Stream Announcements')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt.setName('welcome_channel')
            .setDescription('Channel where new members are welcomed')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt.setName('modlog_channel')
            .setDescription('Channel for AutoMod logs and staff audit')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt.setName('goodbye_channel')
            .setDescription('Channel where member leave messages are posted')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('roles')
        .setDescription('Configure auto-role and stream ping notification role')
        .addRoleOption(opt =>
          opt.setName('auto_role')
            .setDescription('Role automatically given to new members on join')
            .setRequired(false)
        )
        .addRoleOption(opt =>
          opt.setName('stream_role')
            .setDescription('Role to ping for live stream announcements')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('automod')
        .setDescription('Enable or disable server-wide AutoMod protection')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable or disable AutoMod')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('voice')
        .setDescription('Configure "Join to Create" temporary squad voice channels')
        .addChannelOption(opt =>
          opt.setName('hub_channel')
            .setDescription('The master voice channel users join to auto-generate a private squad VC')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current server configuration and settings')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'channels') {
      const streamChan = interaction.options.getChannel('stream_channel');
      const welcomeChan = interaction.options.getChannel('welcome_channel');
      const modLogChan = interaction.options.getChannel('modlog_channel');
      const goodbyeChan = interaction.options.getChannel('goodbye_channel');

      if (streamChan) db.updateGuildSettings(guildId, 'streamChannel', streamChan.id);
      if (welcomeChan) db.updateGuildSettings(guildId, 'welcomeChannel', welcomeChan.id);
      if (modLogChan) db.updateGuildSettings(guildId, 'modLogChannel', modLogChan.id);
      if (goodbyeChan) db.updateGuildSettings(guildId, 'goodbyeChannel', goodbyeChan.id);

      return interaction.reply({
        embeds: [embeds.success('Channels Updated', 'Server notification and log channels have been successfully configured! 🚀')]
      });
    }

    if (subcommand === 'roles') {
      const autoRole = interaction.options.getRole('auto_role');
      const streamRole = interaction.options.getRole('stream_role');

      if (autoRole) db.updateGuildSettings(guildId, 'autoRoleId', autoRole.id);
      if (streamRole) db.updateGuildSettings(guildId, 'streamPingRole', streamRole.id);

      return interaction.reply({
        embeds: [embeds.success('Roles Configured', 'Auto-role and stream notification roles have been updated!')]
      });
    }

    if (subcommand === 'automod') {
      const enabled = interaction.options.getBoolean('enabled');
      db.updateGuildSettings(guildId, 'automodEnabled', enabled);

      return interaction.reply({
        embeds: [embeds.success('AutoMod Updated', `Server AutoMod anti-spam protection is now **${enabled ? 'ENABLED 🛡️' : 'DISABLED ⚠️'}**.`)]
      });
    }

    if (subcommand === 'voice') {
      const hubChannel = interaction.options.getChannel('hub_channel');
      db.updateGuildSettings(guildId, 'tempVoiceHubChannel', hubChannel.id);

      return interaction.reply({
        embeds: [embeds.success('Squad Voice Configured', `Members who join ${hubChannel} will now automatically get their own private gaming squad voice channel! 🎙️⚡`)]
      });
    }

    if (subcommand === 'view') {
      const settings = db.getGuildSettings(guildId);

      const embed = new EmbedBuilder()
        .setColor(config.colors.gaming)
        .setTitle(`⚙️ SERVER CONFIGURATION: ${interaction.guild.name}`)
        .addFields(
          { name: '🔴 Stream Alerts Channel', value: settings.streamChannel ? `<#${settings.streamChannel}>` : '`Not set`', inline: true },
          { name: '🔔 Stream Ping Role', value: settings.streamPingRole ? `<@&${settings.streamPingRole}>` : '`Not set`', inline: true },
          { name: '👋 Welcome Channel', value: settings.welcomeChannel ? `<#${settings.welcomeChannel}>` : '`Not set`', inline: true },
          { name: '🚪 Goodbye Channel', value: settings.goodbyeChannel ? `<#${settings.goodbyeChannel}>` : '`Not set`', inline: true },
          { name: '🛡️ Mod Logs Channel', value: settings.modLogChannel ? `<#${settings.modLogChannel}>` : '`Not set`', inline: true },
          { name: '🎙️ Join-to-Create Voice Hub', value: settings.tempVoiceHubChannel ? `<#${settings.tempVoiceHubChannel}>` : '`Not set`', inline: true },
          { name: '🎭 Join Auto-Role', value: settings.autoRoleId ? `<@&${settings.autoRoleId}>` : '`Not set`', inline: true },
          { name: '⚡ AutoMod Protection', value: settings.automodEnabled !== false ? '`Active (On)` 🛡️' : '`Disabled (Off)` ⚠️', inline: true }
        )
        .setFooter({ text: 'Use /setup channels or /setup voice to customize' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }
};

