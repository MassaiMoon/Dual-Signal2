/**
 * deploy-commands.js
 *
 * One-time script: registers slash commands with Discord.
 * Run once after setting env vars:
 *   node deploy-commands.js
 *
 * Required env vars:
 *   DISCORD_BOT_TOKEN
 *   DISCORD_CLIENT_ID
 *   DISCORD_GUILD_ID   (optional — omit for global commands, takes up to 1h to propagate)
 */

const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const token    = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId  = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error('Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('signal')
    .setDescription('Show your DUAL // SIGNAL score and badge link'),

  new SlashCommandBuilder()
    .setName('signal-check')
    .setDescription('Check another member\'s SIGNAL score')
    .addUserOption(opt =>
      opt.setName('member').setDescription('Discord member to look up').setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Link your wallet address and mint your DUAL // SIGNAL badge')
    .addStringOption(opt =>
      opt.setName('wallet')
        .setDescription('Your EVM wallet address (0x...)')
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top DUAL // SIGNAL members in this server'),
].map(c => c.toJSON());

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash commands…`);
    const route = guildId
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);
    await rest.put(route, { body: commands });
    console.log('Commands registered.');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
