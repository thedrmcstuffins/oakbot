require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, Events, MessageFlags } = require('discord.js');

const API_URL = process.env.API_URL || 'https://public-staging.luckfire.dev/oaklands/v1/economy/daily-material-buffs';
const CATEGORIES = {
  ores: { title: '💎 Ores', color: 0x5865F2, types: ['refined', 'forged'] },
  rocks: { title: '🪨 Rocks', color: 0xE0A54B, types: ['raw', 'refined', 'forged'] },
  trees: { title: '🌲 Trees', color: 0x43B581, types: ['raw', 'milled', 'planked'] }
};

if (!process.env.DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function formatMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
}
function formatBuff(multiplier) {
  const n = Number(multiplier);
  return Number.isFinite(n) ? `${n >= 1 ? '+' : ''}${Math.round((n - 1) * 100)}%` : '—';
}
function pad(str, width) {
  return String(str).slice(0, width).padEnd(width, ' ');
}
function makeTable(items, types) {
  const nameWidth = Math.min(24, Math.max(12, ...items.map(x => String(x.display_name || '').length)));
  const headings = [pad('Material', nameWidth), pad('Buff', 6), ...types.map(t => pad(t[0].toUpperCase() + t.slice(1), 10))];
  const rows = items.map(item => {
    const values = new Map((item.values || []).map(v => [v.type, v]));
    return [pad(item.display_name || item.resource_id || '?', nameWidth), pad(formatBuff(item.multiplier), 6),
      ...types.map(t => pad(values.has(t) ? formatMoney(values.get(t).buffed_value) : '—', 10))].join(' ');
  });
  return ['```', headings.join(' '), ...rows, '```'].join('\n');
}
function refreshDescription(refreshAt) {
  const ms = Date.parse(refreshAt);
  return Number.isFinite(ms) ? `Next API refresh: <t:${Math.floor(ms / 1000)}:F> (<t:${Math.floor(ms / 1000)}:R>)` : 'Next API refresh: unknown';
}
async function fetchBuffs() {
  const response = await fetch(API_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`API HTTP ${response.status}`);
  const body = await response.json();
  if (!body || typeof body.data !== 'object' || body.data === null) throw new Error('API response has no data object');
  return body;
}

client.once(Events.ClientReady, ready => console.log(`Signed in as ${ready.user.tag}`));
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'buffs') return;
  await interaction.deferReply();
  try {
    const requested = interaction.options.getString('category') || 'all';
    const payload = await fetchBuffs();
    const keys = requested === 'all' ? Object.keys(CATEGORIES) : [requested];
    if (keys.some(key => !CATEGORIES[key])) throw new Error('Unknown category');
    const embeds = keys.map(key => {
      const cfg = CATEGORIES[key];
      const items = payload.data[key];
      if (!Array.isArray(items)) throw new Error(`Missing category: ${key}`);
      const currencyTypes = [...new Set(items.map(item => item.currency_type).filter(Boolean))];
      const currency = currencyTypes.length === 1 ? currencyTypes[0] : 'Mixed currencies';
      const description = items.length ? makeTable(items, cfg.types) : 'No materials currently listed.';
      if (description.length > 4096) throw new Error(`${key} table is too large for one Discord embed`);
      return new EmbedBuilder()
        .setColor(cfg.color)
        .setTitle(`Oaklands Daily Buffs — ${cfg.title}`)
        .setDescription(description)
        .addFields({ name: 'Currency', value: currency, inline: true })
        .setFooter({ text: 'Values shown are buffed values. Refresh time is shown in the message.' });
    });
    await interaction.editReply({ content: refreshDescription(payload.refresh_at), embeds });
  } catch (error) {
    console.error('Error handling /buffs:', error);
    await interaction.editReply({ content: 'Could not load Oaklands buffs right now. Please try again shortly.', embeds: [] });
  }
});
client.login(process.env.DISCORD_TOKEN);
