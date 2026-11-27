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
      "Verify & link your Steam account via official Steam sign-in"
    )
    .setIntegrationTypes(integrationTypes)
    .setContexts(contexts),

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

  new SlashCommandBuilder()
    .setName("check")
    .setDescription(
      "Check a Steam game's discount, Family Sharing support, and who in your family owns it"
    )
    .setIntegrationTypes(integrationTypes)
    .setContexts(contexts)
    .addStringOption((opt) =>
      opt
        .setName("game")
        .setDescription("Game name, AppID, or Steam Store URL")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("family")
        .setDescription("Optional family name (auto-detects your linked Steam Family if omitted)")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("kos")
    .setDescription(
      "Kill On Sight — lock onto the lowest contributor in your Steam Family who is up next to buy"
    )
    .setIntegrationTypes(integrationTypes)
    .setContexts(contexts)
    .addStringOption((opt) =>
      opt
        .setName("family")
        .setDescription("Optional family name (auto-detects your linked Steam Family if omitted)")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription(
      "Flex a Steam profile card with level, catalog value, playtime, and top games"
    )
    .setIntegrationTypes(integrationTypes)
    .setContexts(contexts)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("Discord user whose linked Steam profile you want to inspect")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("steam")
        .setDescription("Optional Steam profile URL, vanity name, or SteamID64")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("region")
        .setDescription("Pricing region (defaults to your saved preference)")
        .setRequired(false)
        .addChoices(
          { name: "MENA-USD (ma)", value: "ma" },
          { name: "United States (us)", value: "us" },
          { name: "Europe (eu)", value: "eu" },
          { name: "United Kingdom (gb)", value: "gb" },
          { name: "Brazil (br)", value: "br" },
          { name: "Japan (jp)", value: "jp" }
        )
    ),
];

export const commandsJson = commands.map((cmd) => cmd.toJSON());
