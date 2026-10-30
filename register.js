require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  throw new Error('Set DISCORD_TOKEN and DISCORD_CLIENT_ID in .env (or hosting variables).');
}

const commands = [new SlashCommandBuilder()
  .setName('buffs')
  .setDescription('Show the current Oaklands daily material buffs')
  .addStringOption(option => option
    .setName('category')
    .setDescription('Select a resource category')
    .addChoices(
      { name: 'All', value: 'all' },
      { name: 'Ores', value: 'ores' },
      { name: 'Rocks', value: 'rocks' },
      { name: 'Trees', value: 'trees' }
    ))
  .toJSON()];

(async () => {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const route = DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
    : Routes.applicationCommands(DISCORD_CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`Registered /buffs ${DISCORD_GUILD_ID ? 'in test server' : 'globally'}.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
