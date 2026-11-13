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
 * Deelt een periode op in weekblokken van 7 dagen.
 *
 * Een blok begint op de ingestelde startdag van de week. Bij de periode horen
 * de blokken waarvan die startdag binnen de periode valt (start t/m eind). Een
 * periode van een maand telt daardoor altijd 4 of 5 blokken, net als in de
 * sheet, en geen week telt in twee periodes mee.
 *
 * Dagen aan het begin van de periode vóór de eerste startdag horen bij het
 * eerste blok (zie weekIndexVoorDatum). Valt er geen enkele startdag in de
 * periode, dan is er één blok vanaf de startdatum.
 */
export function weekblokken(
  start: ISODatum,
  eind: ISODatum,
  weekStartDag: number,
): Weekblok[] {
  const blokken: Weekblok[] = [];
  const verschuiving = (weekStartDag - dagVanWeek(start) + 7) % 7;
  let cursor = plusDagen(start, verschuiving);
  if (cursor > eind) cursor = start;
  while (cursor <= eind) {
    const blokEind = plusDagen(cursor, 6);
    blokken.push({
      nr: blokken.length + 1,
      start: cursor,
      eind: blokEind,
      label: `${dagVanMaand(cursor)} t/m ${dagVanMaand(blokEind)}`,
    });
    cursor = plusDagen(cursor, 7);
  }
  return blokken;
}

/**
 * In welk blok een datum valt. Datums vóór het eerste blok tellen in het
 * eerste blok mee, datums na het laatste blok in het laatste.
 */
export function weekIndexVoorDatum(blokken: Weekblok[], datum: ISODatum): number {
  if (blokken.length === 0) return -1;
  for (let i = blokken.length - 1; i >= 0; i--) {
    if (datum >= blokken[i]!.start) return i;
  }
  return 0;
}
