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
          // De sessie staat in localStorage en wordt vanzelf ververst, zodat
          // opnieuw inloggen zelden nodig is (ook in de app op het beginscherm).
          persistSession: true,
          autoRefreshToken: true,
          // Inloggen gaat met wachtwoord; er komt nooit een sessie via de URL.
          detectSessionInUrl: false,
          storageKey: "hb-sessie",
        },
      })
    : null;
