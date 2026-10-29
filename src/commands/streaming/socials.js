const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('socials')
    .setDescription('Get direct links to official stream and social media pages'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`🌟 ${config.streamer.name}'S OFFICIAL SOCIALS`)
      .setDescription('Connect with the stream across all platforms! Follow and subscribe to stay updated with highlights, clips, and live streams.')
      .addFields(
        { name: '📺 YouTube', value: `[Subscribe on YouTube](${config.streamer.youtube})`, inline: true },
        { name: '🟣 Twitch', value: `[Follow on Twitch](${config.streamer.twitch})`, inline: true },
        { name: '🟢 Kick', value: `[Watch on Kick](${config.streamer.kick})`, inline: true },
        { name: '🎵 TikTok', value: `[Follow TikTok Clips](${config.streamer.tiktok})`, inline: true }
      )
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setFooter({ text: 'Thank you for supporting the stream!' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('YouTube')
        .setStyle(ButtonStyle.Link)
        .setURL(config.streamer.youtube)
        .setEmoji('📺'),
      new ButtonBuilder()
        .setLabel('Twitch')
        .setStyle(ButtonStyle.Link)
        .setURL(config.streamer.twitch)
        .setEmoji('🟣'),
      new ButtonBuilder()
        .setLabel('Kick')
        .setStyle(ButtonStyle.Link)
        .setURL(config.streamer.kick)
        .setEmoji('🟢')
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};

