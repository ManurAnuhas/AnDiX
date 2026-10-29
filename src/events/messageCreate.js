const automod = require('../modules/automod');
const leveling = require('../modules/leveling');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message || message.author?.bot) return;

    // 1. Run Auto-Moderation & Anti-Spam Engine
    const violated = await automod.checkMessage(message);
    if (violated) {
      // Message was deleted or flagged as spam; don't award XP
      return;
    }

    // 2. Award Chat XP & Check Level Up
    await leveling.addMessageXp(message);
  }
};

