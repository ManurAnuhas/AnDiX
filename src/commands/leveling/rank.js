const { SlashCommandBuilder } = require('discord.js');
const leveling = require('../../modules/leveling');
const embeds = require('../../modules/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your current gamer rank and level progression')
    .addUserOption(opt =>
      opt.setName('target')
        .setDescription('The user whose rank you want to check (Optional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target') || interaction.user;
    const profile = leveling.getProfile(interaction.guild.id, targetUser.id);

    const rankEmbed = embeds.rank(
      targetUser,
      profile.rank,
      profile.level,
      profile.xp,
      profile.neededXp,
      profile.totalXp
    );

    await interaction.reply({ embeds: [rankEmbed] });
  }
};

