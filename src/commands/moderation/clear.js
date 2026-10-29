const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../modules/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete messages from the channel (Max 100)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(opt =>
      opt.setName('target')
        .setDescription('Only delete messages from this specific user (Optional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const target = interaction.options.getUser('target');

    await interaction.deferReply({ ephemeral: true });

    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });

      let toDelete = messages;
      if (target) {
        toDelete = messages.filter(m => m.author.id === target.id);
      }

      const deleted = await interaction.channel.bulkDelete(toDelete, true);

      await interaction.editReply({
        embeds: [embeds.success('Messages Cleared', `Successfully purged **${deleted.size}** messages${target ? ` from ${target}` : ''}! 🧹`)]
      });
    } catch (err) {
      await interaction.editReply({
        embeds: [embeds.error('Failed to Clear Messages', 'Could not delete messages. Note that messages older than 14 days cannot be bulk deleted by Discord.')]
      });
    }
  }
};

