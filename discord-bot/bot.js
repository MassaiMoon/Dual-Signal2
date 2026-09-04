/**
 * DUAL // SIGNAL Discord Bot
 *
 * Tracks community activity and exposes badge commands.
 *
 * Required env vars:
 *   DISCORD_BOT_TOKEN     — bot token from Discord Developer Portal
 *   DISCORD_CLIENT_ID     — application client ID
 *   DISCORD_GUILD_ID      — server (guild) ID for scoped commands
 *   APP_URL               — https://dual-signal2-production.up.railway.app
 *   ADMIN_TOKEN           — your DUAL // SIGNAL admin token
 *   WELCOME_CHANNEL_ID    — (optional) channel ID for new-member announcements
 */

'use strict';

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  Colors,
} = require('discord.js');
const fetch = require('node-fetch');

// ── Config ────────────────────────────────────────────────────────────────────

const BOT_TOKEN        = process.env.DISCORD_BOT_TOKEN;
const APP_URL          = (process.env.APP_URL ?? '').replace(/\/$/, '');
const ADMIN_TOKEN      = process.env.ADMIN_TOKEN;
const WELCOME_CHANNEL  = process.env.WELCOME_CHANNEL_ID ?? '';
const SYNC_INTERVAL_MS = 60 * 60 * 1000; // sync activity hourly

if (!BOT_TOKEN || !APP_URL || !ADMIN_TOKEN) {
  console.error('[bot] Missing required env vars: DISCORD_BOT_TOKEN, APP_URL, ADMIN_TOKEN');
  process.exit(1);
}

// ── Activity tracker ──────────────────────────────────────────────────────────
// Tracks unique active dates per Discord username since the last sync flush.
// Key: normalised Discord username (lowercase), Value: Set of 'YYYY-MM-DD' strings.

const pendingActivity = new Map(); // username → Set<dateString>

function recordActivity(username) {
  const key  = username.toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  if (!pendingActivity.has(key)) pendingActivity.set(key, new Set());
  pendingActivity.get(key).add(date);
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${APP_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization:  `Bearer ${ADMIN_TOKEN}`,
      ...(options.headers ?? {}),
    },
  });
  return { ok: res.ok, status: res.status, body: await res.json() };
}

async function lookupByDiscord(username) {
  const { ok, body } = await apiFetch(
    `/api/badges/lookup?discord=${encodeURIComponent(username)}`,
    { method: 'GET' },
  );
  return ok ? body : null;
}

async function lookupByWallet(wallet) {
  const { ok, body } = await apiFetch(
    `/api/badges/lookup?wallet=${encodeURIComponent(wallet)}`,
    { method: 'GET' },
  );
  return ok ? body : null;
}

async function mintBadge({ walletAddress, discordHandle }) {
  return apiFetch('/api/admin/mint-badge', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, discordHandle }),
  });
}

async function updateScore(walletAddress, telegramActiveDays) {
  return apiFetch('/api/admin/update-score', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, telegramActiveDays }),
  });
}

// ── Activity sync ─────────────────────────────────────────────────────────────
// Runs hourly. For each Discord user with new activity days, finds their badge
// and updates telegramActiveDays (the community presence track).

async function syncActivity() {
  if (pendingActivity.size === 0) return;
  console.log(`[sync] Flushing activity for ${pendingActivity.size} user(s)`);

  for (const [username, newDays] of pendingActivity) {
    try {
      const badge = await lookupByDiscord(username);
      if (!badge) {
        // No badge yet — skip. They must /register first.
        continue;
      }

      const currentDays = badge.telegramActiveDays ?? 0;
      const updatedDays = currentDays + newDays.size;

      const { ok, body } = await updateScore(badge.walletAddress, updatedDays);
      if (ok) {
        console.log(
          `[sync] @${username} → ${updatedDays} community days | score=${body.signalScore} tier=${body.tier}`,
        );
      } else {
        console.warn(`[sync] update-score failed for @${username}:`, body);
      }
    } catch (err) {
      console.error(`[sync] error for @${username}:`, err.message);
    }
  }

  pendingActivity.clear();
}

// ── Embed builders ────────────────────────────────────────────────────────────

const TIER_COLOR = {
  LEGEND:      0xFFD700,
  GENESIS:     0xF7C873,
  STAKEHOLDER: 0xA8EDF9,
  BUILDER:     0x7FE4F4,
  EXPLORER:    0x5ED3EA,
  INITIATE:    0x4A7A8A,
};

function buildBadgeEmbed(badge, title) {
  const color     = TIER_COLOR[badge.tier] ?? TIER_COLOR.INITIATE;
  const shortWlt  = badge.walletAddress
    ? `${badge.walletAddress.slice(0, 6)}···${badge.walletAddress.slice(-4)}`
    : 'N/A';

  const tracks = [
    `X Signal   L${badge.xSignalLevel ?? 0}`,
    `Telegram   L${badge.telegramLevel ?? 0}`,
    `Governance L${badge.governanceLevel ?? 0}`,
    `Holder     L${badge.holderLevel ?? 0}`,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title ?? 'DUAL // SIGNAL Badge')
    .setDescription(`**${badge.tier}** · ${badge.signalScore?.toLocaleString() ?? 0} SIGNAL`)
    .addFields(
      { name: 'Wallet',       value: `\`${shortWlt}\``,          inline: true  },
      { name: 'Member Since', value: badge.memberSince || 'N/A', inline: true  },
      { name: 'Track Levels', value: `\`\`\`${tracks}\`\`\``,   inline: false },
    )
    .setURL(badge.badgeUrl)
    .setFooter({ text: 'DUAL // SIGNAL · On-chain identity passport' })
    .setTimestamp();
}

// ── Slash command handlers ────────────────────────────────────────────────────

async function handleSignal(interaction) {
  await interaction.deferReply({ ephemeral: false });

  const username = interaction.user.username.toLowerCase();
  const badge    = await lookupByDiscord(username);

  if (!badge) {
    return interaction.editReply({
      content: [
        `You don't have a DUAL // SIGNAL badge yet.`,
        `Use \`/register wallet:0x...\` to link your wallet and mint one.`,
        `Or ask an admin to mint one for you via the admin console.`,
      ].join('\n'),
    });
  }

  const embed = buildBadgeEmbed(badge, `Your DUAL // SIGNAL Passport`);
  await interaction.editReply({ embeds: [embed] });
}

async function handleSignalCheck(interaction) {
  await interaction.deferReply({ ephemeral: false });

  const target   = interaction.options.getUser('member');
  const username = target.username.toLowerCase();
  const badge    = await lookupByDiscord(username);

  if (!badge) {
    return interaction.editReply({
      content: `**@${target.username}** doesn't have a DUAL // SIGNAL badge yet.`,
    });
  }

  const embed = buildBadgeEmbed(badge, `${target.username}'s DUAL // SIGNAL Passport`);
  await interaction.editReply({ embeds: [embed] });
}

async function handleRegister(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const wallet   = interaction.options.getString('wallet').trim();
  const username = interaction.user.username.toLowerCase();

  // Validate wallet format
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return interaction.editReply({
      content: 'Invalid wallet address. Must be a 42-character EVM address starting with `0x`.',
    });
  }

  // Check if they already have a badge (by Discord handle)
  const existingByDiscord = await lookupByDiscord(username);
  if (existingByDiscord) {
    return interaction.editReply({
      content: [
        `You already have a DUAL // SIGNAL badge!`,
        `View it here: ${existingByDiscord.badgeUrl}`,
      ].join('\n'),
    });
  }

  // Check if this wallet already has a badge
  const existingByWallet = await lookupByWallet(wallet);
  if (existingByWallet) {
    return interaction.editReply({
      content: [
        `That wallet already has a badge. If this is your wallet, contact an admin to link your Discord handle.`,
        `Badge: ${existingByWallet.badgeUrl}`,
      ].join('\n'),
    });
  }

  // Mint a new badge
  const { ok, body } = await mintBadge({
    walletAddress: wallet,
    discordHandle: username,
  });

  if (!ok) {
    console.error('[register] mint-badge failed:', body);
    return interaction.editReply({
      content: `Minting failed: ${body.error ?? 'Unknown error'}. Contact an admin.`,
    });
  }

  await interaction.editReply({
    content: [
      `Your DUAL // SIGNAL badge has been minted!`,
      `**Tier:** INITIATE · **Score:** 0 SIGNAL`,
      `**Badge:** ${APP_URL}/badge/${body.dualObjectId}`,
      ``,
      `Your score will grow as you participate in the community.`,
    ].join('\n'),
  });

  console.log(`[register] Minted badge for @${username} wallet=${wallet}`);
}

async function handleLeaderboard(interaction) {
  await interaction.deferReply({ ephemeral: false });

  const embed = new EmbedBuilder()
    .setColor(TIER_COLOR.EXPLORER)
    .setTitle('DUAL // SIGNAL Leaderboard')
    .setDescription(`See the full ranked leaderboard:`)
    .setURL(`${APP_URL}/leaderboard`)
    .setFooter({ text: 'DUAL // SIGNAL · On-chain identity passport' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── Client setup ──────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.once('ready', () => {
  console.log(`[bot] Logged in as ${client.user.tag}`);
  console.log(`[bot] Activity sync every ${SYNC_INTERVAL_MS / 60000} minutes`);

  // Start activity sync loop
  setInterval(syncActivity, SYNC_INTERVAL_MS);
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  recordActivity(message.author.username);
});

client.on('guildMemberAdd', async (member) => {
  console.log(`[bot] New member: ${member.user.username}`);

  // Send welcome message to the designated channel (if configured)
  if (WELCOME_CHANNEL) {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL);
    if (channel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(TIER_COLOR.INITIATE)
        .setTitle('Welcome to DUAL Network')
        .setDescription(
          `Welcome, <@${member.id}>!\n\n` +
          `Mint your **DUAL // SIGNAL** identity badge to track your contribution across the community.\n\n` +
          `Use \`/register wallet:0x...\` to link your wallet and get started.`,
        )
        .setURL(`${APP_URL}/leaderboard`)
        .setFooter({ text: 'DUAL // SIGNAL · On-chain identity passport' });

      channel.send({ embeds: [embed] }).catch(console.error);
    }
  }

  // Also send a DM
  member.send({
    content: [
      `Welcome to the DUAL Network community!`,
      ``,
      `You can earn a DUAL // SIGNAL identity badge that tracks your contribution.`,
      `Use \`/register wallet:0x...\` in the server to get started.`,
      ``,
      `View the leaderboard: ${APP_URL}/leaderboard`,
    ].join('\n'),
  }).catch(() => {/* DMs may be disabled */});
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case 'signal':        return await handleSignal(interaction);
      case 'signal-check':  return await handleSignalCheck(interaction);
      case 'register':      return await handleRegister(interaction);
      case 'leaderboard':   return await handleLeaderboard(interaction);
      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  } catch (err) {
    console.error(`[bot] Error handling /${interaction.commandName}:`, err);
    const msg = { content: 'Something went wrong. Try again shortly.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      interaction.editReply(msg).catch(() => {});
    } else {
      interaction.reply(msg).catch(() => {});
    }
  }
});

client.login(BOT_TOKEN);
