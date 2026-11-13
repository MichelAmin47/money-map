import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const sleutel = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const DEMO = import.meta.env.VITE_DEMO === "true";

export const supabaseIngesteld = Boolean(url && sleutel);

/** null als de omgevingsvariabelen ontbreken (of in demo-modus). */
export const supabase: SupabaseClient | null =
  !DEMO && url && sleutel
    ? createClient(url, sleutel, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Inloggen gaat met een code, niet met een link in de URL.
          detectSessionInUrl: false,
          storageKey: "hb-sessie",
        },
      })
    : null;
