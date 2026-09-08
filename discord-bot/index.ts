/**
 * Discord bot — Railway process entry point.
 *
 * Env vars:
 *   DISCORD_BOT_TOKEN   required
 *   DISCORD_GUILD_ID    required — only messages from this guild are processed
 *   DISCORD_CHANNEL_IDS optional — comma-separated allow-list; if unset, all channels
 *
 * Run with: npx tsx discord-bot/index.ts
 */

import { Client, GatewayIntentBits, Events } from 'discord.js';
import { db } from '../src/lib/db';
import { processDiscordMessage } from './handler';

const token   = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token)   { console.error('[discord-bot] DISCORD_BOT_TOKEN is required'); process.exit(1); }
if (!guildId) { console.error('[discord-bot] DISCORD_GUILD_ID is required');  process.exit(1); }

const allowedChannels: Set<string> | null =
  process.env.DISCORD_CHANNEL_IDS
    ? new Set(process.env.DISCORD_CHANNEL_IDS.split(',').map(s => s.trim()).filter(Boolean))
    : null;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`[discord-bot] Ready as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.guildId !== guildId) return;
  if (allowedChannels && !allowedChannels.has(message.channelId)) return;

  const event = {
    authorBot:       message.author.bot,
    authorWebhookId: message.webhookId,
    authorUsername:  message.author.username,
    guildId:         message.guildId,
    channelId:       message.channelId,
  };

  try {
    const result = await processDiscordMessage(db, event);
    if (!result.skipped) {
      console.log(
        `[discord-bot] user=${event.authorUsername} day=${new Date().toISOString().slice(0, 10)}` +
        ` created=${result.created}`,
      );
    }
  } catch (err) {
    console.error('[discord-bot] processDiscordMessage error:', err);
  }
});

client.login(token).catch((err) => {
  console.error('[discord-bot] Login failed:', err);
  process.exit(1);
});
