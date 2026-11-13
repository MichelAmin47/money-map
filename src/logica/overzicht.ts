import type { ISODatum } from "./datum";
import type { Centen } from "./geld";
import {
  schuifDoor,
  som,
  verdeelOverWeken,
  verdeelPotten,
  weekpot,
  type Pot,
  type Verdeling,
  type WeekPot,
  type WeekStand,
} from "./potten";
import type { PeriodeRegel } from "./termijnen";
import { weekblokken, weekIndexVoorDatum, type Weekblok } from "./weken";

export interface Periode {
  id: string;
  startdatum: ISODatum;
  /** Laatste dag van de periode (de dag vóór het volgende salaris). */
  einddatum: ISODatum;
  salaris: Centen;
  verdeling: Verdeling;
  weekStartDag: number;
}

export interface Uitgave {
  id: string;
  periodeId: string;
  datum: ISODatum;
  /** Negatief = ontvangen geld of een terugbetaling. */
  bedrag: Centen;
  omschrijving: string;
  pot: Pot;
  aangemaaktOp: string;
}

export interface WeekOverzicht {
  blok: Weekblok;
  vast: WeekStand;
  persoonlijk: WeekStand;
  uitgaven: Uitgave[];
}

export interface PotOverzicht {
  /** Salaris × percentage. */
  budget: Centen;
  vasteLasten: Centen;
  /** budget − vaste lasten: wat er over de weken verdeeld wordt. */
  weekpot: Centen;
  uitgegeven: Centen;
  over: Centen;
}

export interface Overzicht {
  vast: PotOverzicht;
  persoonlijk: PotOverzicht;
  extra: { budget: Centen; uitgegeven: Centen; over: Centen };
  weken: WeekOverzicht[];
  status: { betaald: number; totaal: number; openstaand: Centen };
}

/** Alle cijfers van één periode, afgeleid uit de ruwe gegevens. */
export function berekenOverzicht(
  periode: Periode,
  regels: PeriodeRegel[],
  uitgaven: Uitgave[],
): Overzicht {
  const potten = verdeelPotten(periode.salaris, periode.verdeling);
  const blokken = weekblokken(periode.startdatum, periode.einddatum, periode.weekStartDag);

  const perWeek: Uitgave[][] = blokken.map(() => []);
  for (const u of uitgaven) {
    const i = weekIndexVoorDatum(blokken, u.datum);
    if (i >= 0) perWeek[i]!.push(u);
  }

  const voorPot = (pot: WeekPot) => {
    const vasteLasten = som(regels.filter((r) => r.pot === pot).map((r) => r.bedrag));
    const wp = weekpot(potten[pot], vasteLasten);
    const uitgegevenPerWeek = perWeek.map((lijst) =>
      som(lijst.filter((u) => u.pot === pot).map((u) => u.bedrag)),
    );
    const uitgegeven = som(uitgegevenPerWeek);
    const standen = schuifDoor(verdeelOverWeken(wp, blokken.length), uitgegevenPerWeek);
    const overzicht: PotOverzicht = {
      budget: potten[pot],
      vasteLasten,
      weekpot: wp,
      uitgegeven,
      over: wp - uitgegeven,
    };
    return { overzicht, standen };
  };

  const vast = voorPot("vast");
  const persoonlijk = voorPot("persoonlijk");
  const extraUit = som(uitgaven.filter((u) => u.pot === "extra").map((u) => u.bedrag));

  const sorteer = (lijst: Uitgave[]) =>
    [...lijst].sort(
      (a, b) => a.datum.localeCompare(b.datum) || a.aangemaaktOp.localeCompare(b.aangemaaktOp),
    );

  return {
    vast: vast.overzicht,
    persoonlijk: persoonlijk.overzicht,
    extra: { budget: potten.extra, uitgegeven: extraUit, over: potten.extra - extraUit },
    weken: blokken.map((blok, i) => ({
      blok,
      vast: vast.standen[i]!,
      persoonlijk: persoonlijk.standen[i]!,
      uitgaven: sorteer(perWeek[i]!),
    })),
    status: {
      betaald: regels.filter((r) => r.betaald).length,
      totaal: regels.length,
      openstaand: som(regels.filter((r) => !r.betaald).map((r) => r.bedrag)),
    },
  };
}

/**
 * De vaakst gebruikte omschrijvingen, voor de snelknoppen. Vult aan met de
 * geïmporteerde winkels als er nog weinig uitgaven zijn. Geeft per winkel ook
 * de pot waarin hij het laatst gebruikt is.
 */
export function topWinkels(
  recent: { omschrijving: string; pot: Pot }[],
  aanvulling: string[],
  aantal = 6,
): { naam: string; pot: Pot | null }[] {
  const telling = new Map<string, { naam: string; n: number; pot: Pot; eerst: number }>();
  recent.forEach((u, i) => {
    const naam = u.omschrijving.trim();
    if (!naam) return;
    const sleutel = naam.toLowerCase();
    const bestaand = telling.get(sleutel);
    // `recent` staat op nieuwste eerst: de eerste treffer bepaalt naam en pot.
    if (bestaand) bestaand.n += 1;
    else telling.set(sleutel, { naam, n: 1, pot: u.pot, eerst: i });
  });
  const top: { naam: string; pot: Pot | null }[] = [...telling.values()]
    .sort((a, b) => b.n - a.n || a.eerst - b.eerst)
    .slice(0, aantal)
    .map(({ naam, pot }) => ({ naam, pot }));
  for (const w of aanvulling) {
    if (top.length >= aantal) break;
    const naam = w.trim();
    if (naam && !top.some((t) => t.naam.toLowerCase() === naam.toLowerCase())) {
      top.push({ naam, pot: null });
    }
  }
  return top;
}
