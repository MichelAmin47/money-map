import { dagVanMaand, dagVanWeek, plusDagen, type ISODatum } from "./datum";

export interface Weekblok {
  /** Volgnummer binnen de periode, vanaf 1. */
  nr: number;
  start: ISODatum;
  eind: ISODatum;
  /** "13 t/m 19" */
  label: string;
}

/**
 * Deelt een periode op in weekblokken.
 *
 * Een blok begint op de ingestelde startdag van de week. Bij de periode horen
 * de blokken waarvan die startdag binnen de periode valt (start t/m eind). Een
 * periode van een maand telt daardoor altijd 4 of 5 blokken, net als in de
 * sheet, en geen week telt in twee periodes mee.
 *
 * De blokken dekken samen precies de periode:
 * - het eerste blok begint op de startdatum van de periode, ook als die vóór
 *   de eerste startdag ligt (het is dan langer dan 7 dagen);
 * - het laatste blok eindigt op de einddatum van de periode (het is dan
 *   meestal korter dan 7 dagen); de dagen erna horen bij de volgende periode.
 *
 * Valt er geen enkele startdag in de periode, dan is er één blok dat de hele
 * periode beslaat.
 */
export function weekblokken(
  start: ISODatum,
  eind: ISODatum,
  weekStartDag: number,
): Weekblok[] {
  // De dagen waarop een blok begint: elke startdag van de week in de periode.
  const startdagen: ISODatum[] = [];
  const verschuiving = (weekStartDag - dagVanWeek(start) + 7) % 7;
  let cursor = plusDagen(start, verschuiving);
  if (cursor > eind) cursor = start;
  while (cursor <= eind) {
    startdagen.push(cursor);
    cursor = plusDagen(cursor, 7);
  }
  return startdagen.map((dag, i) => {
    const blokStart = i === 0 ? start : dag;
    const blokEind = i === startdagen.length - 1 ? eind : plusDagen(dag, 6);
    return {
      nr: i + 1,
      start: blokStart,
      eind: blokEind,
      label: `${dagVanMaand(blokStart)} t/m ${dagVanMaand(blokEind)}`,
    };
  });
}

/**
 * In welk blok een datum valt. Datums vóór het eerste blok tellen in het
 * eerste blok mee, datums na het laatste blok in het laatste (een uitgave
 * hoort bij een periode via periode_id, niet via zijn datum).
 */
export function weekIndexVoorDatum(blokken: Weekblok[], datum: ISODatum): number {
  if (blokken.length === 0) return -1;
  for (let i = blokken.length - 1; i >= 0; i--) {
    if (datum >= blokken[i]!.start) return i;
  }
  return 0;
}
