const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the currently playing song'),

  async execute(interaction) {
    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: '❌ You must be in a Voice Channel to skip music!',
        ephemeral: true
      });
    }

    const skipped = musicManager.skip(interaction.guildId);
    if (!skipped) {
      return interaction.reply({
        content: 'ℹ️ There is no song currently playing to skip.',
        ephemeral: true
      });
    }

    return interaction.reply('⏭️ Skipped to the next song in the queue!');
  }
};
