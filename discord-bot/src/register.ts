import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commandsJson } from "./commands";

async function registerCommands(): Promise<void> {
  const token = process.env.DISCORD_TOKEN?.trim();
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const guildId = process.env.DISCORD_GUILD_ID?.trim();

  if (!token || !clientId) {
    console.error(
      "Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment variables."
    );
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(token);

  if (guildId) {
    console.log(
      `Registering ${commandsJson.length} slash commands to guild ${guildId}...`
    );
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commandsJson,
    });
    console.log("Guild slash commands registered.");
  } else {
    console.log(
      `Registering ${commandsJson.length} global slash commands (preserving Discord Activity Entry Point if present)...`
    );
    const existing = (await rest.get(
      Routes.applicationCommands(clientId)
    )) as Array<{ type?: number } & Record<string, unknown>>;
    const entryPoints = Array.isArray(existing)
      ? existing.filter((cmd) => cmd.type === 4)
      : [];
    await rest.put(Routes.applicationCommands(clientId), {
      body: [...commandsJson, ...entryPoints],
    });
    console.log(
      `Global slash commands registered (${commandsJson.length} commands + ${entryPoints.length} entry point).`
    );
  }
}

registerCommands().catch((err) => {
  console.error("Failed to register slash commands:", err);
  process.exit(1);
});
