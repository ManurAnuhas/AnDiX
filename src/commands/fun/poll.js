const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a community poll for your stream')
    .addStringOption(opt =>
      opt.setName('question')
        .setDescription('What do you want to ask? (e.g. Which game should we play tonight?)')
        .setRequired(true)
    )
    .addStringOption(opt => opt.setName('option1').setDescription('First Option').setRequired(true))
    .addStringOption(opt => opt.setName('option2').setDescription('Second Option').setRequired(true))
    .addStringOption(opt => opt.setName('option3').setDescription('Third Option (Optional)').setRequired(false))
    .addStringOption(opt => opt.setName('option4').setDescription('Fourth Option (Optional)').setRequired(false))
    .addStringOption(opt => opt.setName('option5').setDescription('Fifth Option (Optional)').setRequired(false)),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const options = [
      interaction.options.getString('option1'),
      interaction.options.getString('option2'),
      interaction.options.getString('option3'),
      interaction.options.getString('option4'),
      interaction.options.getString('option5')
    ].filter(Boolean);

    const description = options
      .map((opt, i) => `${emojis[i]} **${opt}**`)
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(config.colors.gaming)
      .setTitle(`📊 GAMING POLL: ${question}`)
      .setDescription(`${description}\n\n*React below to cast your vote!* 🗳️`)
      .setFooter({ text: `Poll created by ${interaction.user.tag}` })
      .setTimestamp();

    const pollMessage = await interaction.reply({ embeds: [embed], fetchReply: true });

    for (let i = 0; i < options.length; i++) {
      await pollMessage.react(emojis[i]).catch(() => {});
    }
  }
};

