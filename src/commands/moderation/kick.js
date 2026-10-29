const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../modules/embeds');
const db = require('../../modules/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt =>
      opt.setName('target')
        .setDescription('The member to kick')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for kicking')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason specified';
    const targetMember = interaction.guild.members.cache.get(targetUser.id);

    if (!targetMember) {
      return interaction.reply({
        embeds: [embeds.error('Member Not Found', 'This user is not currently in the server.')],
        ephemeral: true
      });
    }

    if (!targetMember.kickable) {
      return interaction.reply({
        embeds: [embeds.error('Cannot Kick', 'I do not have permission to kick this member (Their role may be higher than mine).')],
        ephemeral: true
      });
    }

    try {
      await targetMember.kick(reason);

      // Log action
      const logEmbed = embeds.modLog('MEMBER KICKED', targetUser, interaction.user, reason);
      const settings = db.getGuildSettings(interaction.guild.id);
      if (settings.modLogChannel) {
        const logChan = interaction.guild.channels.cache.get(settings.modLogChannel);
        if (logChan) logChan.send({ embeds: [logEmbed] }).catch(() => {});
      }

      await interaction.reply({
        embeds: [embeds.success('Member Kicked', `Successfully kicked **${targetUser.tag}**.\n**Reason:** ${reason}`)]
      });
    } catch (err) {
      await interaction.reply({
        embeds: [embeds.error('Kick Failed', `An error occurred: ${err.message}`)],
        ephemeral: true
      });
    }
  }
};

