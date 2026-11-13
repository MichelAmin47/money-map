import type { Centen } from "./geld";

export type Pot = "vast" | "persoonlijk" | "extra";
export type WeekPot = Exclude<Pot, "extra">;

export interface Verdeling {
  vast: number;
  persoonlijk: number;
  extra: number;
}

export const STANDAARD_VERDELING: Verdeling = { vast: 62, persoonlijk: 25, extra: 13 };

export const verdelingKlopt = (v: Verdeling): boolean =>
  [v.vast, v.persoonlijk, v.extra].every((p) => Number.isFinite(p) && p >= 0) &&
  v.vast + v.persoonlijk + v.extra === 100;

/**
 * Verdeelt het salaris over de drie potten. Elke pot wordt afzonderlijk op
 * hele centen afgerond, net als in de sheet (4720,49 × 13% = 613,66).
 */
export function verdeelPotten(salaris: Centen, v: Verdeling): Record<Pot, Centen> {
  return {
    vast: Math.round((salaris * v.vast) / 100),
    persoonlijk: Math.round((salaris * v.persoonlijk) / 100),
    extra: Math.round((salaris * v.extra) / 100),
  };
}

/** Wat er van een pot overblijft nadat de vaste lasten eraf zijn. */
export const weekpot = (pot: Centen, vasteLasten: Centen): Centen => pot - vasteLasten;

/**
 * Verdeelt de weekpot gelijk over de weekblokken, in hele centen. Centen die
 * niet eerlijk te delen zijn gaan naar de eerste weken, zodat de som altijd
 * exact de weekpot is.
 */
export function verdeelOverWeken(pot: Centen, aantalWeken: number): Centen[] {
  if (aantalWeken <= 0) return [];
  const teken = pot < 0 ? -1 : 1;
  const abs = Math.abs(pot);
  const basis = Math.floor(abs / aantalWeken);
  const rest = abs - basis * aantalWeken;
  return Array.from({ length: aantalWeken }, (_, i) => teken * (basis + (i < rest ? 1 : 0)));
}

export interface WeekStand {
  /** Het vaste weekbedrag (weekpot / aantal weken). */
  basis: Centen;
  /** Over (of tekort, negatief) uit de vorige week. */
  doorgeschoven: Centen;
  /** basis + doorgeschoven. */
  beschikbaar: Centen;
  uitgegeven: Centen;
  /** beschikbaar − uitgegeven; schuift door naar de volgende week. */
  over: Centen;
  /**
   * basis − uitgegeven: wat deze week van haar eigen weekbedrag over is,
   * zonder doorschuiven. Dit staat in de ingeklapte weekrij.
   */
  eigenOver: Centen;
}

/**
 * Doorschuiven: wat je in een week overhoudt gaat naar de volgende week, een
 * tekort gaat er daar weer af.
 */
export function schuifDoor(basis: Centen[], uitgegeven: Centen[]): WeekStand[] {
  const standen: WeekStand[] = [];
  let doorgeschoven = 0;
  basis.forEach((b, i) => {
    const uit = uitgegeven[i] ?? 0;
    const beschikbaar = b + doorgeschoven;
    const over = beschikbaar - uit;
    standen.push({ basis: b, doorgeschoven, beschikbaar, uitgegeven: uit, over, eigenOver: b - uit });
    doorgeschoven = over;
  });
  return standen;
}

export const som = (bedragen: Centen[]): Centen => bedragen.reduce((s, b) => s + b, 0);
