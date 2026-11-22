import type { Periode } from "../logica/overzicht";
import type { VasteLast } from "../logica/termijnen";
import type { Instellingen, PeriodeData } from "./backend";

// De momentopname: de laatst geladen gegevens, alleen op dit toestel. Als
// Supabase bij het opstarten niet antwoordt, toont de app deze gegevens
// alleen-lezen. Hij hoort bij één gebruiker en gaat weg bij uitloggen.

export const MOMENTOPNAME_SLEUTEL = "hb-momentopname";

/** Ophogen als het formaat verandert; een oude versie wordt dan genegeerd. */
export const MOMENTOPNAME_VERSIE = 1;

export interface Momentopname {
  versie: typeof MOMENTOPNAME_VERSIE;
  /** De user_id van de ingelogde gebruiker. */
  gebruiker: string;
  /** Tijdstip van bewaren (ISO, met tijd). */
  bewaardOp: string;
  instellingen: Instellingen;
  vasteLasten: VasteLast[];
  periodes: Periode[];
  /** Alleen de periodes die geladen waren; de lopende zit er altijd in. */
  data: Record<string, PeriodeData>;
}

/** Het deel van localStorage dat nodig is; in tests een nep-versie. */
export type Opslag = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** localStorage, of null als die geblokkeerd is. */
export function standaardOpslag(): Opslag | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Bewaart de momentopname. Lukt dat niet (vol, geblokkeerd), dan geeft hij false. */
export function bewaarMomentopname(opslag: Opslag | null, m: Momentopname): boolean {
  if (!opslag) return false;
  try {
    opslag.setItem(MOMENTOPNAME_SLEUTEL, JSON.stringify(m));
    return true;
  } catch {
    return false;
  }
}

export function wisMomentopname(opslag: Opslag | null): void {
  try {
    opslag?.removeItem(MOMENTOPNAME_SLEUTEL);
  } catch {
    // Niets aan te doen; de app werkt gewoon verder.
  }
}

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

function klopt(x: unknown): x is Momentopname {
  if (!isObject(x)) return false;
  if (x.versie !== MOMENTOPNAME_VERSIE) return false;
  if (typeof x.gebruiker !== "string" || typeof x.bewaardOp !== "string") return false;
  if (Number.isNaN(Date.parse(x.bewaardOp))) return false;
  if (!isObject(x.instellingen) || !isObject(x.instellingen.verdeling)) return false;
  if (!Array.isArray(x.vasteLasten) || !Array.isArray(x.periodes) || !isObject(x.data)) {
    return false;
  }
  const periodesKloppen = x.periodes.every(
    (p) =>
      isObject(p) &&
      typeof p.id === "string" &&
      typeof p.startdatum === "string" &&
      typeof p.einddatum === "string",
  );
  const dataKlopt = Object.values(x.data).every(
    (d) => isObject(d) && Array.isArray(d.regels) && Array.isArray(d.uitgaven),
  );
  return periodesKloppen && dataKlopt;
}

/**
 * De momentopname van deze gebruiker, of null. Een momentopname van een
 * ander account, in een oud formaat of met een beschadigde inhoud wordt
 * gewist en niet gebruikt.
 */
export function leesMomentopname(opslag: Opslag | null, gebruiker: string): Momentopname | null {
  if (!opslag) return null;
  let tekst: string | null;
  try {
    tekst = opslag.getItem(MOMENTOPNAME_SLEUTEL);
  } catch {
    return null;
  }
  if (tekst == null) return null;
  let inhoud: unknown;
  try {
    inhoud = JSON.parse(tekst);
  } catch {
    inhoud = null;
  }
  if (!klopt(inhoud) || inhoud.gebruiker !== gebruiker) {
    wisMomentopname(opslag);
    return null;
  }
  return inhoud;
}

/**
 * De user_id uit de login die Supabase op dit toestel bewaart, zonder
 * netwerk. Zo weet de app bij een storing van wie de momentopname mag zijn.
 * Null als er geen (leesbare) login is.
 */
export function leesBewaardeGebruiker(opslag: Opslag | null, sleutel: string): string | null {
  try {
    const tekst = opslag?.getItem(sleutel);
    if (!tekst) return null;
    const sessie: unknown = JSON.parse(tekst);
    if (!isObject(sessie) || !isObject(sessie.user)) return null;
    if (typeof sessie.refresh_token !== "string" || !sessie.refresh_token) return null;
    return typeof sessie.user.id === "string" && sessie.user.id ? sessie.user.id : null;
  } catch {
    return null;
  }
}
