const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const musicManager = require('../../modules/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube or Spotify in your Voice Channel')
    .addStringOption(option =>
      option.setName('song')
        .setDescription('Song title, YouTube URL, or Spotify track link')
        .setRequired(true)
    ),

  async execute(interaction) {
    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: '❌ You must be in a Voice Channel to play music!',
        ephemeral: true
      });
    }

    const query = interaction.options.getString('song');
    await interaction.deferReply();

    try {
      const result = await musicManager.play(voiceChannel, query, interaction);

      if (result.status === 'playing') {
        const embed = new EmbedBuilder()
          .setColor('#00FFA3')
          .setTitle('🎶 Now Playing')
          .setDescription(`[**${result.song.title}**](${result.song.url})`)
          .addFields(
            { name: '⏱️ Duration', value: result.song.duration || 'Live / Unknown', inline: true },
            { name: '👤 Requested By', value: result.song.requestedBy, inline: true }
          )
          .setThumbnail(result.song.thumbnail)
          .setFooter({ text: 'AnDiX High-Fidelity Music System' });

        return interaction.editReply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor('#9945FF')
          .setTitle('🎵 Added to Queue')
          .setDescription(`[**${result.song.title}**](${result.song.url})`)
          .addFields(
            { name: '🔢 Queue Position', value: `#${result.position}`, inline: true },
            { name: '👤 Requested By', value: result.song.requestedBy, inline: true }
          )
          .setThumbnail(result.song.thumbnail);

        return interaction.editReply({ embeds: [embed] });
      }
    } catch (err) {
      return interaction.editReply({
        content: `❌ ${err.message || 'Error occurred while searching or playing the track.'}`
      });
    }
  }
};
