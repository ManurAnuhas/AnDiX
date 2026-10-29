const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playing music, clear the queue, and leave the Voice Channel'),

  async execute(interaction) {
    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: '❌ You must be in a Voice Channel to stop music!',
        ephemeral: true
      });
    }

    const stopped = musicManager.stop(interaction.guildId);
    if (!stopped) {
      return interaction.reply({
        content: 'ℹ️ There is no music playing right now.',
        ephemeral: true
      });
    }

    return interaction.reply('⏹️ Music stopped and queue cleared.');
  }
};
