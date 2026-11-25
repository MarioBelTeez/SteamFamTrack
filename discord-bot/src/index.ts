import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { handleInteraction } from "./handlers";

const token = process.env.DISCORD_TOKEN?.trim();

if (!token) {
  console.error("Missing DISCORD_TOKEN in environment variables.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`SteamFamTrack bot logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await handleInteraction(interaction);
  } catch (err) {
    console.error("Unhandled interaction error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    if (interaction.deferred || interaction.replied) {
      await interaction
        .editReply({ content: `Error: ${message}` })
        .catch(() => undefined);
    } else {
      await interaction
        .reply({ content: `Error: ${message}`, ephemeral: true })
        .catch(() => undefined);
    }
  }
});

client.login(token).catch((err) => {
  console.error("Failed to login Discord client:", err);
  process.exit(1);
});
