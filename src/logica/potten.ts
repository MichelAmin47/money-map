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

/**
 * Waar een week staat ten opzichte van vandaag. Een voorbije week is af, de
 * huidige week loopt nog, een komende week is nog niet begonnen.
 */
export type WeekFase = "voorbij" | "huidig" | "komend";

export interface WeekStand {
  fase: WeekFase;
  /** Het vaste weekbedrag (weekpot / aantal weken). */
  basis: Centen;
  /**
   * Alleen in de huidige week: de som van wat alle voorbije weken van hun
   * eigen weekbedrag overhielden (of tekortkwamen, negatief). Anders 0.
   */
  doorgeschoven: Centen;
  /** basis + doorgeschoven. */
  beschikbaar: Centen;
  uitgegeven: Centen;
  /**
   * Het grote getal in de kop van de week: beschikbaar − uitgegeven. In een
   * voorbije of komende week is dat gelijk aan eigenOver.
   */
  over: Centen;
  /**
   * basis − uitgegeven: wat deze week van haar eigen weekbedrag over is,
   * zonder doorschuiven. Bij een voorbije week is dit wat hij doorschuift.
   */
  eigenOver: Centen;
}

/**
 * Doorschuiven: wat een voorbije week van haar eigen weekbedrag overhoudt (of
 * tekortkomt) gaat naar de huidige week. Er schuift niets door van week tot
 * week door de toekomst heen: een komende week toont alleen haar eigen
 * weekbedrag min de uitgaven die er al in staan.
 *
 * `huidige` is de index van de huidige week. Is hij kleiner dan 0, dan zijn
 * alle weken komend (de periode moet nog beginnen); is hij gelijk aan of
 * groter dan het aantal weken, dan zijn alle weken voorbij (een afgesloten
 * periode) en schuift er niets door.
 */
export function schuifDoor(basis: Centen[], uitgegeven: Centen[], huidige: number): WeekStand[] {
  const eigen = basis.map((b, i) => b - (uitgegeven[i] ?? 0));
  const uitVoorbij = som(eigen.slice(0, Math.max(0, huidige)));
  return basis.map((b, i) => {
    const fase: WeekFase = i < huidige ? "voorbij" : i === huidige ? "huidig" : "komend";
    const uit = uitgegeven[i] ?? 0;
    const doorgeschoven = fase === "huidig" ? uitVoorbij : 0;
    const beschikbaar = b + doorgeschoven;
    return {
      fase,
      basis: b,
      doorgeschoven,
      beschikbaar,
      uitgegeven: uit,
      over: beschikbaar - uit,
      eigenOver: eigen[i]!,
    };
  });
}

export const som = (bedragen: Centen[]): Centen => bedragen.reduce((s, b) => s + b, 0);
