const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../modules/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock or unlock the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt =>
      opt.setName('action')
        .setDescription('Lock or unlock')
        .setRequired(true)
        .addChoices(
          { name: '🔒 Lock Channel', value: 'lock' },
          { name: '🔓 Unlock Channel', value: 'unlock' }
        )
    ),

  async execute(interaction) {
    const action = interaction.options.getString('action');
    const channel = interaction.channel;
    const everyoneRole = interaction.guild.roles.everyone;

    try {
      if (action === 'lock') {
        await channel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false
        });
        return interaction.reply({
          embeds: [embeds.warning('Channel Locked 🔒', 'This channel has been locked down by moderators. Members cannot send messages.')]
        });
      } else {
        await channel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: null
        });
        return interaction.reply({
          embeds: [embeds.success('Channel Unlocked 🔓', 'This channel has been unlocked. Members can send messages again!')]
        });
      }
    } catch (err) {
      return interaction.reply({
        embeds: [embeds.error('Action Failed', err.message)],
        ephemeral: true
      });
    }
  }
};

