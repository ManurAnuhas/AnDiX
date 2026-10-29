const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../modules/embeds');
const db = require('../../modules/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Manage warnings for server members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Warn a server member')
        .addUserOption(opt => opt.setName('target').setDescription('The member to warn').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View warnings for a member')
        .addUserOption(opt => opt.setName('target').setDescription('The member to check').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Clear all warnings for a member')
        .addUserOption(opt => opt.setName('target').setDescription('The member to clear warnings for').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('target');
    const guildId = interaction.guild.id;

    if (subcommand === 'add') {
      const reason = interaction.options.getString('reason');
      const warnings = db.addWarning(guildId, targetUser.id, {
        reason,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag
      });

      // Send mod log
      const logEmbed = embeds.modLog('MEMBER WARNED', targetUser, interaction.user, reason, [
        { name: 'Total Warnings', value: `${warnings.length}`, inline: true }
      ]);
      const settings = db.getGuildSettings(guildId);
      if (settings.modLogChannel) {
        const logChan = interaction.guild.channels.cache.get(settings.modLogChannel);
        if (logChan) logChan.send({ embeds: [logEmbed] }).catch(() => {});
      }

      // DM user if possible
      targetUser.send({
        embeds: [embeds.warning('You Received a Warning', `You were warned in **${interaction.guild.name}**\n**Reason:** ${reason}`)]
      }).catch(() => {});

      return interaction.reply({
        embeds: [embeds.success('Member Warned', `Successfully warned **${targetUser.tag}**.\n**Reason:** ${reason}\nTotal warnings: **${warnings.length}**`)]
      });
    }

    if (subcommand === 'list') {
      const warnings = db.getWarnings(guildId, targetUser.id);
      if (warnings.length === 0) {
        return interaction.reply({
          embeds: [embeds.default(`Warnings for ${targetUser.username}`, `${targetUser} has a clean record with 0 warnings! 🌟`)],
          ephemeral: true
        });
      }

      const listDesc = warnings.map((w, i) => {
        const date = new Date(w.timestamp).toLocaleDateString();
        return `**#${i + 1}** • **${w.reason}**\n↳ By: \`${w.moderatorTag || 'Mod'}\` on *${date}*`;
      }).join('\n\n');

      return interaction.reply({
        embeds: [embeds.warning(`Warnings for ${targetUser.tag} (${warnings.length})`, listDesc)],
        ephemeral: true
      });
    }

    if (subcommand === 'clear') {
      db.clearWarnings(guildId, targetUser.id);
      return interaction.reply({
        embeds: [embeds.success('Warnings Cleared', `Successfully cleared all warnings for **${targetUser.tag}**.`)]
      });
    }
  }
};

