const { EmbedBuilder } = require('discord.js');
const config = require('../../config.json');

const embeds = {
  default: (title, description) => {
    return new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp()
      .setFooter({ text: `${config.botName} • Gaming Hub`, iconURL: null });
  },

  success: (title, description) => {
    return new EmbedBuilder()
      .setColor(config.colors.success)
      .setTitle(`✔ ${title}`)
      .setDescription(description)
      .setTimestamp();
  },

  error: (title, description) => {
    return new EmbedBuilder()
      .setColor(config.colors.danger)
      .setTitle(`✖ ${title}`)
      .setDescription(description)
      .setTimestamp();
  },

  warning: (title, description) => {
    return new EmbedBuilder()
      .setColor(config.colors.warning)
      .setTitle(`⚠ ${title}`)
      .setDescription(description)
      .setTimestamp();
  },

  streamLive: ({ streamerName, title, game, platform, url, thumbnailUrl }) => {
    const embed = new EmbedBuilder()
      .setColor(config.colors.streamLive)
      .setTitle(`🔴 ${streamerName || config.streamer.name} IS NOW LIVE!`)
      .setURL(url)
      .setDescription(`**${title}**\n\n🎮 **Playing:** \`${game || 'Variety Gaming'}\`\n📡 **Platform:** **${platform}**\n\nGrab your snacks and join the stream squad right now! 🚀`)
      .addFields(
        { name: '📺 Watch Stream', value: `[Click here to watch live!](${url})`, inline: true },
        { name: '🕹️ Category', value: `\`${game || 'Gaming'}\``, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `🔴 Live Stream Alert • ${config.botName}` });

    if (thumbnailUrl) {
      embed.setImage(thumbnailUrl);
    }

    return embed;
  },

  welcome: (member, memberCount) => {
    return new EmbedBuilder()
      .setColor(config.colors.gaming)
      .setTitle(`🎮 WELCOME TO THE SQUAD, ${member.user.username.toUpperCase()}!`)
      .setDescription(
        `Hey ${member}, welcome to our official gaming & streaming community! 🕹️🔥\n\n` +
        `• 📜 Make sure to read the server rules\n` +
        `• 🔔 Grab your stream ping notification role\n` +
        `• 💬 Jump into chat and say hi to the squad!\n\n` +
        `🏆 **You are gamer #${memberCount} to join our server!**`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setImage('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1000&q=80')
      .setTimestamp()
      .setFooter({ text: `Member Joined • ${config.botName}` });
  },

  goodbye: (member, memberCount) => {
    return new EmbedBuilder()
      .setColor(config.colors.danger)
      .setTitle(`👋 GG, ${member.user.username} LEFT THE SERVER`)
      .setDescription(`${member.user.tag} just stepped out of the lobby.\nWe now have **${memberCount}** gamers remaining.`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();
  },

  modLog: (action, target, moderator, reason, extraFields = []) => {
    const embed = new EmbedBuilder()
      .setColor(config.colors.warning)
      .setTitle(`🛡️ Moderation Log: [${action}]`)
      .addFields(
        { name: '👤 Target', value: `${target.tag || target.user?.tag || target.name || target.id} (\`${target.id}\`)`, inline: true },
        { name: '👮 Moderator', value: `${moderator.tag || moderator.user?.tag || moderator.name} (\`${moderator.id}\`)`, inline: true },
        { name: '📝 Reason', value: reason || 'No reason provided', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `AutoMod & Security System` });

    if (extraFields.length > 0) {
      embed.addFields(extraFields);
    }

    return embed;
  },

  rank: (user, rank, level, xp, neededXp, totalXp) => {
    const percentage = Math.min(Math.max(Math.floor((xp / neededXp) * 100), 0), 100);
    const totalBars = 15;
    const filledBars = Math.round((percentage / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

    return new EmbedBuilder()
      .setColor(config.colors.gaming)
      .setTitle(`🎮 GAMER PROFILE & RANK`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(`**${user.username}**'s Gaming Community Status`)
      .addFields(
        { name: '🏆 Server Rank', value: `#${rank}`, inline: true },
        { name: '⭐ Level', value: `${level}`, inline: true },
        { name: '⚡ Total XP', value: `${totalXp.toLocaleString()}`, inline: true },
        { name: `Level Progress (${percentage}%)`, value: `\`${progressBar}\`\n**${xp.toLocaleString()}** / **${neededXp.toLocaleString()} XP**`, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `Chat active to level up! • ${config.botName}` });
  }
};

module.exports = embeds;

