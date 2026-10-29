const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../modules/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode cooldown for the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(opt =>
      opt.setName('seconds')
        .setDescription('Cooldown in seconds (0 to turn off slowmode, up to 21600)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    ),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds');

    try {
      await interaction.channel.setRateLimitPerUser(seconds);
      if (seconds === 0) {
        return interaction.reply({
          embeds: [embeds.success('Slowmode Disabled', 'Slowmode has been turned off for this channel.')]
        });
      }

      return interaction.reply({
        embeds: [embeds.success('Slowmode Enabled', `Slowmode set to **${seconds} seconds** per user for this channel. ⏱️`)]
      });
    } catch (err) {
      return interaction.reply({
        embeds: [embeds.error('Failed to Set Slowmode', err.message)],
        ephemeral: true
      });
    }
  }
};

