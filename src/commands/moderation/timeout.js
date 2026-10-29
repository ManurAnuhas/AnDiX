const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../modules/embeds');
const db = require('../../modules/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout (mute) a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt.setName('target')
        .setDescription('The member to timeout')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('duration')
        .setDescription('Timeout duration in minutes (0 to remove timeout)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(40320) // up to 28 days
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the timeout')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'No reason specified';
    const targetMember = interaction.guild.members.cache.get(targetUser.id);

    if (!targetMember) {
      return interaction.reply({
        embeds: [embeds.error('Member Not Found', 'This user is not currently in the server.')],
        ephemeral: true
      });
    }

    if (!targetMember.moderatable) {
      return interaction.reply({
        embeds: [embeds.error('Cannot Timeout', 'I do not have permission to moderate this member.')],
        ephemeral: true
      });
    }

    try {
      if (duration === 0) {
        // Remove timeout
        await targetMember.timeout(null, reason);
        return interaction.reply({
          embeds: [embeds.success('Timeout Removed', `Removed timeout for **${targetUser.tag}**.`)]
        });
      }

      await targetMember.timeout(duration * 60 * 1000, reason);

      // Log action
      const logEmbed = embeds.modLog('MEMBER TIMEOUT', targetUser, interaction.user, reason, [
        { name: 'Duration', value: `${duration} minutes`, inline: true }
      ]);
      const settings = db.getGuildSettings(interaction.guild.id);
      if (settings.modLogChannel) {
        const logChan = interaction.guild.channels.cache.get(settings.modLogChannel);
        if (logChan) logChan.send({ embeds: [logEmbed] }).catch(() => {});
      }

      await interaction.reply({
        embeds: [embeds.success('Member Timed Out', `Successfully placed **${targetUser.tag}** in timeout for **${duration} minutes**.\n**Reason:** ${reason}`)]
      });
    } catch (err) {
      await interaction.reply({
        embeds: [embeds.error('Timeout Failed', `An error occurred: ${err.message}`)],
        ephemeral: true
      });
    }
  }
};

