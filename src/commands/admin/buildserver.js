const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const serverArchitect = require('../../modules/serverArchitect');
const embeds = require('../../modules/embeds');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buildserver')
    .setDescription('⚡ AnDiX 1-Click Server Architect: Auto-build roles, channels, and security')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Only guild owner or administrator can run this
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        embeds: [embeds.error('Access Denied', 'Only Server Owners and Administrators can execute the Server Architect.')],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const summary = await serverArchitect.buildCompleteServer(interaction.guild);

      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('⚡ AnDiX 1-CLICK SERVER SETUP COMPLETE!')
        .setDescription(
          `Your Discord server has been professionally architected and secured with high-grade gaming categories, channels, and roles! 🚀\n\n` +
          `• 👑 **Roles Created:** \`${summary.rolesCreated.length}\` roles\n` +
          `• 📁 **Categories Created:** \`${summary.categoriesCreated.length}\` categories\n` +
          `• 💬 **Channels Created:** \`${summary.channelsCreated.length}\` channels\n\n` +
          `🛡️ **Auto-Configured:**\n` +
          `↳ Welcome: <#${interaction.guild.channels.cache.find(c => c.name.includes('welcome'))?.id || 'Set'}>\n` +
          `↳ Stream Alerts: <#${interaction.guild.channels.cache.find(c => c.name.includes('live-alerts'))?.id || 'Set'}>\n` +
          `↳ Mod Logs & Audit: <#${interaction.guild.channels.cache.find(c => c.name.includes('mod-logs'))?.id || 'Set'}>\n` +
          `↳ Temp Squad Voice: <#${interaction.guild.channels.cache.find(c => c.name.includes('Join to Create'))?.id || 'Set'}>`
        )
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setFooter({ text: `${config.botName} • Commercial Server Builder` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({
        embeds: [embeds.error('Setup Failed', `An error occurred while building the server: ${err.message}`)]
      });
    }
  }
};

