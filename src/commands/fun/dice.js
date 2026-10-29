const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Roll a random dice')
    .addIntegerOption(opt =>
      opt.setName('sides')
        .setDescription('Number of sides on the dice (Default: 6)')
        .setMinValue(2)
        .setMaxValue(100)
        .setRequired(false)
    ),

  async execute(interaction) {
    const sides = interaction.options.getInteger('sides') || 6;
    const roll = Math.floor(Math.random() * sides) + 1;

    const embed = new EmbedBuilder()
      .setColor(config.colors.gaming)
      .setTitle('🎲 DICE ROLL')
      .setDescription(`You rolled a **d${sides}** dice and got: **${roll}**! 🎲`)
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/3394/3394469.png')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

