const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('View the official weekly gaming stream schedule'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(config.colors.gaming)
      .setTitle(`📅 ${config.streamer.name}'s STREAM SCHEDULE`)
      .setDescription('Catch the live streams on our official channels! Here is our standard weekly timetable:')
      .addFields(
        { name: '🔥 Monday - Wednesday', value: '`08:00 PM - 11:30 PM` • Competitive Ranked Grind', inline: false },
        { name: '🎮 Thursday', value: '`08:30 PM - 11:00 PM` • Variety Games / Viewer Lobbies', inline: false },
        { name: '🚀 Friday & Saturday', value: '`09:00 PM - Late Night` • Weekend Special & Tournaments', inline: false },
        { name: '☕ Sunday', value: '`07:30 PM - 10:30 PM` • Community Night & Q&A', inline: false }
      )
      .setImage('https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1000&q=80')
      .setFooter({ text: 'All times are in local time. Turn on notifications so you never miss out!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

