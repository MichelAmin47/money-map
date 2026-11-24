// Time-outs voor als Supabase niet antwoordt. Een verzoek dat blijft hangen
// moet op tijd een duidelijke melding geven, zonder de bewaarde login te raken.

/** Standaard wachttijd voor opstarten en inloggen. */
export const TIJDSLIMIET_MS = 10_000;

export class TijdslimietFout extends Error {
  constructor(ms: number) {
    super(`Geen antwoord binnen ${Math.round(ms / 1000)} seconden`);
    this.name = "TijdslimietFout";
  }
}

/**
 * Wacht hooguit `ms` milliseconden op de belofte. Duurt het langer, dan volgt
 * een TijdslimietFout. Het verzoek zelf loopt door; de uitkomst wordt genegeerd.
 */
export function metTijdslimiet<T>(belofte: Promise<T>, ms: number = TIJDSLIMIET_MS): Promise<T> {
  return new Promise<T>((klaar, mis) => {
    const klok = setTimeout(() => mis(new TijdslimietFout(ms)), ms);
    belofte.then(
      (w) => {
        clearTimeout(klok);
        klaar(w);
      },
      (e: unknown) => {
        clearTimeout(klok);
        mis(e);
      },
    );
  });
}

/**
 * Een storing (geen antwoord of geen verbinding), geen inhoudelijke fout.
 * Browsers noemen een netwerkfout verschillend: Chrome "Failed to fetch",
 * Safari "Load failed", Firefox "NetworkError when attempting to fetch resource".
 */
export function isStoring(e: unknown): boolean {
  if (e instanceof TijdslimietFout) return true;
  if (typeof e !== "object" || e === null) return false;
  const { name, message, status } = e as { name?: unknown; message?: unknown; status?: unknown };
  if (name === "TijdslimietFout" || name === "AbortError" || name === "AuthRetryableFetchError") {
    return true;
  }
  // Supabase Auth geeft bij een netwerkfout status 0.
  if (status === 0) return true;
  return (
    typeof message === "string" &&
    /failed to fetch|load failed|networkerror|network request failed|fetch failed|geen antwoord binnen/i.test(
      message,
    )
  );
}

/**
 * Een fetch die verzoeken waarvoor `geldt(url)` waar is na `ms` afbreekt.
 * Bedoeld voor Supabase Auth (inloggen en het token verlengen): die verzoeken
 * zijn klein en horen binnen een seconde klaar te zijn. Andere verzoeken, zoals
 * de import, gaan ongewijzigd door.
 */
export function maakFetchMetTijdslimiet(
  ms: number,
  geldt: (url: string) => boolean,
  basis: typeof fetch = (...args) => fetch(...args),
): typeof fetch {
  return (invoer, init) => {
    const url =
      typeof invoer === "string" ? invoer : invoer instanceof URL ? invoer.href : invoer.url;
    if (!geldt(url)) return basis(invoer, init);
    const regelaar = new AbortController();
    const klok = setTimeout(() => regelaar.abort(new TijdslimietFout(ms)), ms);
    // Een afbreeksignaal van de aanroeper blijft werken.
    const eigen = init?.signal;
    if (eigen) {
      if (eigen.aborted) regelaar.abort(eigen.reason);
      else eigen.addEventListener("abort", () => regelaar.abort(eigen.reason), { once: true });
    }
    return basis(invoer, { ...init, signal: regelaar.signal }).finally(() => clearTimeout(klok));
  };
}

/** Verzoeken naar Supabase Auth, zoals `/auth/v1/token`. */
export const isAuthVerzoek = (url: string): boolean => url.includes("/auth/v1/");
