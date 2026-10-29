const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin (Heads or Tails)')
    .addStringOption(opt =>
      opt.setName('choice')
        .setDescription('Choose Heads or Tails (Optional)')
        .setRequired(false)
        .addChoices(
          { name: '🪙 Heads', value: 'Heads' },
          { name: '🪙 Tails', value: 'Tails' }
        )
    ),

  async execute(interaction) {
    const userChoice = interaction.options.getString('choice');
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    const isWinner = userChoice ? (userChoice === result) : null;

    let desc = `The coin landed on **${result.toUpperCase()}**! 🪙`;
    if (userChoice) {
      desc += isWinner
        ? `\n\n🎉 **GG! You guessed correctly (${userChoice})!**`
        : `\n\n😢 **Unlucky! You guessed ${userChoice}, but it was ${result}!**`;
    }

    const embed = new EmbedBuilder()
      .setColor(result === 'Heads' ? config.colors.warning : config.colors.info)
      .setTitle('🪙 COIN FLIP RESULT')
      .setDescription(desc)
      .setThumbnail(result === 'Heads' 
        ? 'https://cdn-icons-png.flaticon.com/512/217/217853.png' 
        : 'https://cdn-icons-png.flaticon.com/512/217/217854.png')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

