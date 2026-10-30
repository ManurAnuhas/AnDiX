const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} = require('discord.js');
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
      const result = await musicManager.play(voiceChannel, query, interaction, interaction.client);

      // Create Interactive Control Buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('music_pause')
          .setLabel('Pause / Resume')
          .setEmoji('⏯️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('music_skip')
          .setLabel('Skip')
          .setEmoji('⏭️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('music_stop')
          .setLabel('Stop')
          .setEmoji('⏹️')
          .setStyle(ButtonStyle.Danger)
      );

      let responseMessage;
      if (result.status === 'playing') {
        const embed = new EmbedBuilder()
          .setColor('#00FFA3')
          .setTitle('🎶 Now Playing')
          .setDescription(`[**${result.song.title}**](${result.song.url})`)
          .addFields(
            { name: '⏱️ Duration', value: result.song.duration || 'Live / Audio', inline: true },
            { name: '👤 Requested By', value: result.song.requestedBy, inline: true }
          )
          .setThumbnail(result.song.thumbnail)
          .setFooter({ text: 'AnDiX High-Fidelity Music System • Use buttons below to control' });

        responseMessage = await interaction.editReply({ embeds: [embed], components: [row] });
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

        responseMessage = await interaction.editReply({ embeds: [embed], components: [row] });
      }

      // Component Collector for Interactive Buttons
      const collector = responseMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300_000 // 5 minutes active buttons
      });

      collector.on('collect', async i => {
        if (!i.member.voice?.channel || i.member.voice.channel.id !== voiceChannel.id) {
          return i.reply({ content: '❌ You must be in the same voice channel to use these controls!', ephemeral: true });
        }

        if (i.customId === 'music_pause') {
          const state = musicManager.pause(interaction.guildId);
          await i.reply({ content: state === 'paused' ? '⏸️ Music paused.' : '▶️ Music resumed.', ephemeral: true });
        } else if (i.customId === 'music_skip') {
          const skipped = musicManager.skip(interaction.guildId);
          await i.reply({ content: skipped ? '⏭️ Track skipped!' : 'ℹ️ No track to skip.', ephemeral: true });
        } else if (i.customId === 'music_stop') {
          musicManager.stop(interaction.guildId);
          await i.reply({ content: '⏹️ Playback stopped and queue cleared.', ephemeral: true });
        }
      });

    } catch (err) {
      return interaction.editReply({
        content: `❌ ${err.message || 'Error occurred while searching or playing the track.'}`
      });
    }
  }
};
