import { WEEKDAGEN } from "./datum";
import { naarCenten, type Centen } from "./geld";
import { verdelingKlopt, type Verdeling, type WeekPot } from "./potten";

// Het import-/exportformaat (zie BRIEF.md, "startdata.json").

export interface StartVasteLast {
  naam: string;
  bedrag: Centen;
  pot: WeekPot;
  termijn: { huidig: number; totaal: number } | null;
}

export interface Startdata {
  instellingen: { salaris: Centen; verdeling: Verdeling; weekStartDag: number };
  vasteLasten: StartVasteLast[];
  winkels: string[];
}

export class ImportFout extends Error {}

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const getal = (x: unknown, wat: string): number => {
  if (typeof x !== "number" || !Number.isFinite(x)) {
    throw new ImportFout(`${wat} moet een getal zijn.`);
  }
  return x;
};

/** Controleert een ingelezen JSON-bestand en zet bedragen om naar centen. */
export function leesStartdata(json: unknown): Startdata {
  if (!isObject(json)) throw new ImportFout("Het bestand bevat geen geldig JSON-object.");
  if (json.versie !== 1) throw new ImportFout('Onbekende versie: verwacht "versie": 1.');

  const inst = json.instellingen;
  if (!isObject(inst)) throw new ImportFout('"instellingen" ontbreekt.');
  const salaris = getal(inst.salaris, "Het salaris");
  if (salaris < 0) throw new ImportFout("Het salaris kan niet negatief zijn.");

  const v = inst.verdeling;
  if (!isObject(v)) throw new ImportFout('"instellingen.verdeling" ontbreekt.');
  const verdeling: Verdeling = {
    vast: getal(v.vast, "Verdeling vast"),
    persoonlijk: getal(v.persoonlijk, "Verdeling persoonlijk"),
    extra: getal(v.extra, "Verdeling extra"),
  };
  if (!verdelingKlopt(verdeling)) {
    throw new ImportFout("De percentages van de verdeling moeten samen 100 zijn.");
  }

  const dagNaam = inst.weekStartDag === undefined ? "zaterdag" : inst.weekStartDag;
  const weekStartDag =
    typeof dagNaam === "string"
      ? WEEKDAGEN.indexOf(dagNaam.toLowerCase() as (typeof WEEKDAGEN)[number])
      : -1;
  if (weekStartDag < 0) {
    throw new ImportFout(`"weekStartDag" moet een weekdag zijn (${WEEKDAGEN.join(", ")}).`);
  }

  const lijst = json.vasteLasten ?? [];
  if (!Array.isArray(lijst)) throw new ImportFout('"vasteLasten" moet een lijst zijn.');
  const vasteLasten = lijst.map((item, i): StartVasteLast => {
    const waar = `Vaste last ${i + 1}`;
    if (!isObject(item)) throw new ImportFout(`${waar} is geen object.`);
    const naam = typeof item.naam === "string" ? item.naam.trim() : "";
    if (!naam) throw new ImportFout(`${waar} heeft geen naam.`);
    if (item.pot !== "vast" && item.pot !== "persoonlijk") {
      throw new ImportFout(`${waar} (${naam}): "pot" moet "vast" of "persoonlijk" zijn.`);
    }
    let termijn: StartVasteLast["termijn"] = null;
    if (item.termijn != null) {
      if (!isObject(item.termijn)) throw new ImportFout(`${waar} (${naam}): ongeldige termijn.`);
      const huidig = getal(item.termijn.huidig, `${naam}: termijn huidig`);
      const totaal = getal(item.termijn.totaal, `${naam}: termijn totaal`);
      if (!Number.isInteger(huidig) || !Number.isInteger(totaal) || huidig < 1 || huidig > totaal) {
        throw new ImportFout(`${waar} (${naam}): termijn moet tussen 1 en het totaal liggen.`);
      }
      termijn = { huidig, totaal };
    }
    return { naam, bedrag: naarCenten(getal(item.bedrag, `${naam}: bedrag`)), pot: item.pot, termijn };
  });

  const w = json.winkels ?? [];
  if (!Array.isArray(w) || w.some((x) => typeof x !== "string")) {
    throw new ImportFout('"winkels" moet een lijst met namen zijn.');
  }
  const winkels = [...new Set((w as string[]).map((x) => x.trim()).filter(Boolean))];

  return {
    instellingen: { salaris: naarCenten(salaris), verdeling, weekStartDag },
    vasteLasten,
    winkels,
  };
}

/** Sleutel waarmee de import bestaande vaste lasten terugvindt (idempotent). */
export const importSleutel = (v: { naam: string; pot: string }): string =>
  `${v.pot}|${v.naam.trim().toLowerCase()}`;
