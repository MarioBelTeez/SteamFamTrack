import { FamilyDashboard } from "@/components/FamilyDashboard";
import { hasSupabaseConfig } from "@/lib/supabase";

export default function HomePage() {
  const hasApiKey = Boolean(process.env.STEAM_API_KEY);
  const hasDatabase = hasSupabaseConfig();
  return (
    <FamilyDashboard
      initialHasApiKey={hasApiKey}
      initialHasDatabase={hasDatabase}
    />
  );
}
