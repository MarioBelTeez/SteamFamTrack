import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

const integrationTypes = [
  ApplicationIntegrationType.GuildInstall,
  ApplicationIntegrationType.UserInstall,
];

const contexts = [
  InteractionContextType.Guild,
  InteractionContextType.BotDM,
  InteractionContextType.PrivateChannel,
];

export const commands = [
  new SlashCommandBuilder()
    .setName("link")
    .setDescription(
      "Link your Discord account to your Steam profile (auto-detects your SteamFamTrack family)"
    )
    .setIntegrationTypes(integrationTypes)
    .setContexts(contexts)
    .addStringOption((opt) =>
      opt
        .setName("steam_url")
        .setDescription("Your Steam profile URL, vanity name, or 17-digit SteamID64")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("family")
    .setDescription("Inspect your Steam Family catalog, snapshots, swaps, and waitlist")
    .setIntegrationTypes(integrationTypes)
    .setContexts(contexts)
    .addSubcommand((sub) =>
      sub
        .setName("board")
        .setDescription("Show the Steam Family contribution leaderboard")
        .addStringOption((opt) =>
          opt
            .setName("family")
            .setDescription("Optional family name (auto-detects your linked Steam Family if omitted)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("monthly")
        .setDescription("Show the latest monthly snapshot and delta vs previous month")
        .addStringOption((opt) =>
          opt
            .setName("family")
            .setDescription("Optional family name (auto-detects your linked Steam Family if omitted)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("simulate")
        .setDescription("Simulate swapping an active member with a waitlisted member")
        .addStringOption((opt) =>
          opt
            .setName("remove_name")
            .setDescription("Name of the active member to remove")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("add_name")
            .setDescription("Name of the waitlisted member to add")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("family")
            .setDescription("Optional family name (auto-detects your linked Steam Family if omitted)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("waitlist")
        .setDescription("List waitlisted members and active members' 1-year slot unlock dates")
        .addStringOption((opt) =>
          opt
            .setName("family")
            .setDescription("Optional family name (auto-detects your linked Steam Family if omitted)")
            .setRequired(false)
        )
    ),
];

export const commandsJson = commands.map((cmd) => cmd.toJSON());
