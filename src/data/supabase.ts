import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isAuthVerzoek, maakFetchMetTijdslimiet, TIJDSLIMIET_MS } from "./tijdslimiet";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const sleutel = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const DEMO = import.meta.env.VITE_DEMO === "true";

/** Waar Supabase de login bewaart (localStorage). */
export const SESSIE_SLEUTEL = "hb-sessie";

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
          storageKey: SESSIE_SLEUTEL,
        },
        global: {
          // Verzoeken naar Auth (inloggen, token verlengen) breken na 10 seconden
          // af, zodat een hangende Auth niet de hele app laat hangen. Supabase
          // ziet dat als netwerkfout en houdt de login dan gewoon vast. Verzoeken
          // naar de database (zoals de import) hebben geen tijdslimiet.
          fetch: maakFetchMetTijdslimiet(TIJDSLIMIET_MS, isAuthVerzoek),
        },
      })
    : null;
