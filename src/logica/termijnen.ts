import type { Centen } from "./geld";
import type { WeekPot } from "./potten";

export interface VasteLast {
  id: string;
  naam: string;
  standaardBedrag: Centen;
  pot: WeekPot;
  /** Termijn die in de lopende (laatst gestarte) periode valt. */
  termijnHuidig: number | null;
  termijnTotaal: number | null;
  actief: boolean;
  volgorde: number;
}

/** Een vaste last zoals hij in één periode staat (snapshot). */
export interface PeriodeRegel {
  id: string;
  periodeId: string;
  vasteLastId: string | null;
  naam: string;
  pot: WeekPot;
  bedrag: Centen;
  betaald: boolean;
  termijnNr: number | null;
  termijnTotaal: number | null;
  volgorde: number;
}

export const heeftTermijnen = (v: {
  termijnHuidig: number | null;
  termijnTotaal: number | null;
}): boolean => v.termijnHuidig != null && v.termijnTotaal != null;

/** "Waterschap · 3/8" */
export function termijnLabel(r: {
  naam: string;
  termijnNr: number | null;
  termijnTotaal: number | null;
}): string {
  return r.termijnNr != null && r.termijnTotaal != null
    ? `${r.naam} · ${r.termijnNr}/${r.termijnTotaal}`
    : r.naam;
}

export interface NieuwePeriodeResultaat {
  /** De vaste lasten voor de nieuwe periode: vinkjes leeg, standaardbedrag. */
  regels: PeriodeRegel[];
  /** Vaste lasten waarvan de termijn is opgeschoven of die afgelopen zijn. */
  gewijzigd: VasteLast[];
}

/**
 * Bouwt de vaste lasten voor een nieuwe periode.
 *
 * - Elke actieve vaste last gaat mee met zijn standaardbedrag en zonder vinkje.
 * - Een termijnpost die al in de vorige periode stond gaat één termijn verder.
 *   Stond hij daar nog niet in (allereerste periode, of net geïmporteerd), dan
 *   begint hij op de termijn die is ingevuld.
 * - Na de laatste termijn doet de post niet meer mee en wordt hij inactief.
 */
export function bouwNieuwePeriode(
  vasteLasten: VasteLast[],
  vorigeRegels: Pick<PeriodeRegel, "vasteLastId">[],
  periodeId: string,
  nieuwId: () => string,
): NieuwePeriodeResultaat {
  const stondErAl = new Set(vorigeRegels.map((r) => r.vasteLastId));
  const regels: PeriodeRegel[] = [];
  const gewijzigd: VasteLast[] = [];

  const gesorteerd = [...vasteLasten]
    .filter((v) => v.actief)
    .sort((a, b) => a.volgorde - b.volgorde);

  for (const v of gesorteerd) {
    let termijnNr: number | null = null;
    if (heeftTermijnen(v)) {
      termijnNr = stondErAl.has(v.id) ? v.termijnHuidig! + 1 : v.termijnHuidig!;
      if (termijnNr > v.termijnTotaal!) {
        gewijzigd.push({ ...v, actief: false });
        continue;
      }
      if (termijnNr !== v.termijnHuidig) {
        gewijzigd.push({ ...v, termijnHuidig: termijnNr });
      }
    }
    regels.push({
      id: nieuwId(),
      periodeId,
      vasteLastId: v.id,
      naam: v.naam,
      pot: v.pot,
      bedrag: v.standaardBedrag,
      betaald: false,
      termijnNr,
      termijnTotaal: heeftTermijnen(v) ? v.termijnTotaal : null,
      volgorde: v.volgorde,
    });
  }
  return { regels, gewijzigd };
}
