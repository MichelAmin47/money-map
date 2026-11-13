import type { Centen } from "./geld";
import type { Uitgave } from "./overzicht";
import { som, type WeekPot } from "./potten";

/** Eén regel in een opengeklapte week: alle uitgaven met dezelfde naam in dezelfde pot. */
export interface UitgaveGroep {
  sleutel: string;
  /** De naam zoals hij bij de eerste uitgave is ingetypt. */
  naam: string;
  pot: WeekPot;
  totaal: Centen;
  /** Op datum, daarna op moment van invoeren. Altijd minstens één. */
  uitgaven: Uitgave[];
}

/**
 * Voegt de uitgaven van een week samen tot regels. Uitgaven met dezelfde naam
 * (zonder verschil in hoofdletters of spaties eromheen) in dezelfde pot worden
 * één regel; dezelfde naam in een andere pot blijft een aparte regel.
 *
 * Uitgaven uit de pot Extra doen niet mee: die staan alleen op het scherm
 * Extra. De volgorde is die van de eerste uitgave van elke regel.
 */
export function groepeerUitgaven(uitgaven: Uitgave[]): UitgaveGroep[] {
  const gesorteerd = [...uitgaven].sort(
    (a, b) => a.datum.localeCompare(b.datum) || a.aangemaaktOp.localeCompare(b.aangemaaktOp),
  );
  const groepen = new Map<string, UitgaveGroep>();
  for (const u of gesorteerd) {
    if (u.pot === "extra") continue;
    const naam = u.omschrijving.trim();
    const sleutel = `${u.pot}|${naam.toLowerCase()}`;
    const groep = groepen.get(sleutel);
    if (groep) groep.uitgaven.push(u);
    else groepen.set(sleutel, { sleutel, naam, pot: u.pot, totaal: 0, uitgaven: [u] });
  }
  return [...groepen.values()].map((g) => ({ ...g, totaal: som(g.uitgaven.map((u) => u.bedrag)) }));
}
