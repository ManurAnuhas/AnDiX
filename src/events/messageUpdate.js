const db = require('../modules/database');
const embeds = require('../modules/embeds');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (!newMessage || !newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return; // Ignore embed updates

    const settings = db.getGuildSettings(newMessage.guild.id);
    if (!settings.modLogChannel) return;

    try {
      const logChan = newMessage.guild.channels.cache.get(settings.modLogChannel);
      if (!logChan || !logChan.isTextBased()) return;

      const logEmbed = embeds.modLog(
        'MESSAGE EDITED',
        newMessage.author,
        newMessage.guild.members.me.user,
        `Message edited in <#${newMessage.channel.id}> [Jump to Message](${newMessage.url})`,
        [
          { name: 'Before', value: oldMessage.content ? `\`\`\`${oldMessage.content.slice(0, 500)}\`\`\`` : '*Unknown*' },
          { name: 'After', value: newMessage.content ? `\`\`\`${newMessage.content.slice(0, 500)}\`\`\`` : '*Empty*' }
        ]
      );

      // Save to audit log buffer for web dashboard
      db.logEvent(newMessage.guild.id, {
        action: 'Message Edited',
        target: newMessage.author.tag,
        channel: newMessage.channel.name,
        details: `From: "${oldMessage.content?.slice(0, 50)}" -> To: "${newMessage.content?.slice(0, 50)}"`
      });

      await logChan.send({ embeds: [logEmbed] });
    } catch (err) {
      // ignore
    }
  }
};

