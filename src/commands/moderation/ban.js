const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../modules/embeds');
const db = require('../../modules/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt =>
      opt.setName('target')
        .setDescription('The member to ban')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('delete_days')
        .setDescription('Delete messages from the last X days (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason specified';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;
    const targetMember = interaction.guild.members.cache.get(targetUser.id);

    if (targetMember && !targetMember.bannable) {
      return interaction.reply({
        embeds: [embeds.error('Cannot Ban', 'I do not have permission to ban this member (Their role is higher than mine).')],
        ephemeral: true
      });
    }

    try {
      await interaction.guild.members.ban(targetUser.id, {
        reason: `${reason} (Banned by ${interaction.user.tag})`,
        deleteMessageSeconds: deleteDays * 86400
      });

      // Log action
      const logEmbed = embeds.modLog('MEMBER BANNED', targetUser, interaction.user, reason, [
        { name: 'Deleted Messages', value: `${deleteDays} day(s)`, inline: true }
      ]);
      const settings = db.getGuildSettings(interaction.guild.id);
      if (settings.modLogChannel) {
        const logChan = interaction.guild.channels.cache.get(settings.modLogChannel);
        if (logChan) logChan.send({ embeds: [logEmbed] }).catch(() => {});
      }

      await interaction.reply({
        embeds: [embeds.success('Member Banned', `Successfully banned **${targetUser.tag}**.\n**Reason:** ${reason}`)]
      });
    } catch (err) {
      await interaction.reply({
        embeds: [embeds.error('Ban Failed', `An error occurred: ${err.message}`)],
        ephemeral: true
      });
    }
  }
};

