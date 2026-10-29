const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

const responses = [
  'It is certain! 🎯',
  'Without a doubt, 100%! 🚀',
  'Yes – definitely! 🏆',
  'You may rely on it! 🕹️',
  'As I see it, yes! GG! 🔥',
  'Most likely, pro gamer move! ⚡',
  'Reply hazy, try again after this match... ⏳',
  'Ask again later, I am in a 1v1 clutch! 🎮',
  'Better not tell you now... 👀',
  'Cannot predict now, high ping! 📶',
  'Concentrate and ask again! 💭',
  'Don’t count on it, buddy! ❌',
  'My sources say no! 🚫',
  'Outlook not so good... GG go next. 💀',
  'Very doubtful! 🛑'
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magical gaming 8-ball a question')
    .addStringOption(opt =>
      opt.setName('question')
        .setDescription('Your question')
        .setRequired(true)
    ),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const answer = responses[Math.floor(Math.random() * responses.length)];

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('🎱 THE MAGIC 8-BALL')
      .addFields(
        { name: '❓ Question', value: question, inline: false },
        { name: '🔮 Answer', value: `**${answer}**`, inline: false }
      )
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/2953/2953406.png')
      .setFooter({ text: `Asked by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

