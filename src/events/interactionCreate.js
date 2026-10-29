const logger = require('../utils/logger');
const embeds = require('../modules/embeds');
const { EmbedBuilder } = require('discord.js');
const giveawayCommand = require('../commands/fun/giveaway');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // 1. Slash Command handling
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        logger.warn(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Error executing /${interaction.commandName}:`, error);

        const errorReply = {
          embeds: [embeds.error('Command Execution Error', 'There was an error while executing this command!')],
          ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorReply).catch(() => {});
        } else {
          await interaction.reply(errorReply).catch(() => {});
        }
      }
      return;
    }

    // 2. Button interactions
    if (interaction.isButton()) {
      const db = require('../modules/database');
      const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

      // Verification Gate Handler
      if (interaction.customId === 'btn_verify_member') {
        const settings = db.getGuildSettings(interaction.guild.id);
        const roleId = settings.verificationRole || settings.autoRoleId;

        if (!roleId) {
          return interaction.reply({
            content: '⚠️ Verification role is not configured by the admin yet!',
            ephemeral: true
          });
        }

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
          return interaction.reply({
            content: '⚠️ The verification role cannot be found.',
            ephemeral: true
          });
        }

        if (interaction.member.roles.cache.has(roleId)) {
          return interaction.reply({
            content: '✔ You are already a verified member of this server!',
            ephemeral: true
          });
        }

        try {
          await interaction.member.roles.add(role);
          return interaction.reply({
            content: `🛡️ **Verification Successful!** You have been granted the **${role.name}** role. Enjoy the server! 🚀`,
            ephemeral: true
          });
        } catch (err) {
          return interaction.reply({
            content: `❌ Could not assign role: ${err.message}`,
            ephemeral: true
          });
        }
      }

      // Ticket System: Create Ticket
      if (interaction.customId === 'ticket_create') {
        const settings = db.getGuildSettings(interaction.guild.id);
        const categoryId = settings.ticketCategory;
        const guild = interaction.guild;
        const user = interaction.user;

        // Check for existing ticket
        const existing = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase().slice(0, 15)}`);
        if (existing) {
          return interaction.reply({
            content: `❌ You already have an open ticket in ${existing}!`,
            ephemeral: true
          });
        }

        try {
          const everyoneRole = guild.roles.everyone;
          const ticketChannel = await guild.channels.create({
            name: `ticket-${user.username.slice(0, 15)}`,
            type: ChannelType.GuildText,
            parent: categoryId || undefined,
            topic: `Support ticket for ${user.tag} (ID: ${user.id})`,
            permissionOverwrites: [
              {
                id: everyoneRole.id,
                deny: [PermissionFlagsBits.ViewChannel]
              },
              {
                id: user.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles
                ]
              },
              {
                id: guild.members.me.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
              }
            ]
          });

          db.saveTicket(guild.id, ticketChannel.id, {
            userId: user.id,
            userTag: user.tag
          });

          const ticketEmbed = new EmbedBuilder()
            .setColor('#9945FF')
            .setTitle(`🎫 SUPPORT TICKET: ${user.username.toUpperCase()}`)
            .setDescription(
              `Hey ${user}! Welcome to your private support channel.\n\n` +
              `• Staff has been notified and will be with you shortly.\n` +
              `• Please describe your question, issue, or giveaway prize details in full.\n\n` +
              `Click the button below when your inquiry is resolved to close this ticket.`
            )
            .setFooter({ text: 'AnDiX Ticket Management System' })
            .setTimestamp();

          const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_close')
              .setLabel('Close Ticket')
              .setEmoji('🔒')
              .setStyle(ButtonStyle.Danger)
          );

          await ticketChannel.send({
            content: `👋 ${user} Staff is here to assist you!`,
            embeds: [ticketEmbed],
            components: [closeRow]
          });

          return interaction.reply({
            content: `✔ Your support ticket has been created: ${ticketChannel}`,
            ephemeral: true
          });
        } catch (err) {
          return interaction.reply({
            content: `Failed to create ticket: ${err.message}`,
            ephemeral: true
          });
        }
      }

      // Ticket System: Close Ticket
      if (interaction.customId === 'ticket_close') {
        const ticketData = db.getTicket(interaction.guild.id, interaction.channel.id);

        await interaction.reply({
          content: '🔒 **Closing ticket in 5 seconds...** Thank you for contacting staff!'
        });

        setTimeout(async () => {
          try {
            db.closeTicket(interaction.guild.id, interaction.channel.id);
            await interaction.channel.delete('Ticket resolved and closed');
          } catch (e) {}
        }, 5000);
        return;
      }

      // Self-Assign Roles Handler
      if (interaction.customId.startsWith('selfrole_')) {
        const roleId = interaction.customId.replace('selfrole_', '');
        const role = interaction.guild.roles.cache.get(roleId);

        if (!role) {
          return interaction.reply({ content: '❌ Role not found or has been deleted.', ephemeral: true });
        }

        const member = interaction.member;
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(role).catch(() => {});
          return interaction.reply({
            content: `➖ Removed **${role.name}** role from your profile!`,
            ephemeral: true
          });
        } else {
          await member.roles.add(role).catch(() => {});
          return interaction.reply({
            content: `➕ Added **${role.name}** role to your profile! 🚀`,
            ephemeral: true
          });
        }
      }

      // Giveaway Enter Button
      if (interaction.customId === 'giveaway_enter') {
        const giveawayData = giveawayCommand.activeGiveaways.get(interaction.message.id);

        if (!giveawayData) {
          return interaction.reply({
            content: '❌ This giveaway has already ended!',
            ephemeral: true
          });
        }

        const userId = interaction.user.id;
        if (giveawayData.entrants.has(userId)) {
          // Toggle entry (leave giveaway)
          giveawayData.entrants.delete(userId);
          
          // Update embed entrant count
          const originalEmbed = interaction.message.embeds[0];
          if (originalEmbed) {
            const updated = EmbedBuilder.from(originalEmbed)
              .setFooter({ text: `Total Entrants: ${giveawayData.entrants.size} • Good luck!` });
            await interaction.message.edit({ embeds: [updated] }).catch(() => {});
          }

          return interaction.reply({
            content: '🚪 You have left the giveaway entry pool.',
            ephemeral: true
          });
        } else {
          // Enter giveaway
          giveawayData.entrants.add(userId);

          // Update embed entrant count
          const originalEmbed = interaction.message.embeds[0];
          if (originalEmbed) {
            const updated = EmbedBuilder.from(originalEmbed)
              .setFooter({ text: `Total Entrants: ${giveawayData.entrants.size} • Good luck!` });
            await interaction.message.edit({ embeds: [updated] }).catch(() => {});
          }

          return interaction.reply({
            content: '🎉 **You successfully entered the giveaway!** Good luck gamer!',
            ephemeral: true
          });
        }
      }
    }
  }
};

