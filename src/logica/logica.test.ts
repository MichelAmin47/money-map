import { describe, expect, it } from "vitest";
import { plusDagen, plusMaand } from "./datum";
import { formatEuro, formatInvoer, naarCenten, parseBedrag } from "./geld";
import { berekenOverzicht, topWinkels, type Periode, type Uitgave } from "./overzicht";
import {
  schuifDoor,
  som,
  STANDAARD_VERDELING,
  verdeelOverWeken,
  verdeelPotten,
  verdelingKlopt,
  weekpot,
} from "./potten";
import { ImportFout, leesStartdata } from "./startdata";
import { bouwNieuwePeriode, termijnLabel, type PeriodeRegel, type VasteLast } from "./termijnen";
import { weekblokken, weekIndexVoorDatum } from "./weken";

const ZATERDAG = 6;
const MAANDAG = 1;
const ZONDAG = 0;

describe("bedragen invoeren en tonen", () => {
  it("leest nl-NL-notatie met komma", () => {
    expect(parseBedrag("12,50")).toBe(1250);
    expect(parseBedrag("12,5")).toBe(1250);
    expect(parseBedrag("12,")).toBe(1200);
    expect(parseBedrag("12")).toBe(1200);
    expect(parseBedrag(",5")).toBe(50);
    expect(parseBedrag("1.234,56")).toBe(123456);
    expect(parseBedrag("€ 4.720,49")).toBe(472049);
    expect(parseBedrag("-20")).toBe(-2000);
  });
  it("accepteert ook een punt als decimaalteken", () => {
    expect(parseBedrag("12.50")).toBe(1250);
    expect(parseBedrag("1.234")).toBe(123400);
  });
  it("geeft null bij onzin", () => {
    expect(parseBedrag("")).toBeNull();
    expect(parseBedrag("abc")).toBeNull();
    expect(parseBedrag("1,2,3")).toBeNull();
    expect(parseBedrag(",")).toBeNull();
  });
  it("toont euro's in nl-NL", () => {
    expect(formatEuro(43870).replace(/\s/g, " ")).toBe("€ 438,70");
    expect(formatEuro(472049).replace(/\s/g, " ")).toBe("€ 4.720,49");
    expect(formatInvoer(1250)).toBe("12,50");
  });
});

describe("verdeling over de potten", () => {
  it("verdeelt 62 / 25 / 13", () => {
    expect(verdeelPotten(100000, STANDAARD_VERDELING)).toEqual({
      vast: 62000,
      persoonlijk: 25000,
      extra: 13000,
    });
  });
  it("rondt elke pot af op hele centen (controle tegen de sheet)", () => {
    const potten = verdeelPotten(naarCenten(4720.49), STANDAARD_VERDELING);
    expect(potten.vast).toBe(292670);
    expect(potten.persoonlijk).toBe(118012);
    expect(potten.extra).toBe(61366);
  });
  it("keurt alleen verdelingen goed die samen 100 zijn", () => {
    expect(verdelingKlopt({ vast: 62, persoonlijk: 25, extra: 13 })).toBe(true);
    expect(verdelingKlopt({ vast: 60, persoonlijk: 25, extra: 13 })).toBe(false);
    expect(verdelingKlopt({ vast: 110, persoonlijk: -10, extra: 0 })).toBe(false);
  });
});

describe("weekpot", () => {
  it("sheet: salaris 4720,49 met 2488 aan vaste lasten → weekpot vast 438,70", () => {
    const potten = verdeelPotten(naarCenten(4720.49), STANDAARD_VERDELING);
    expect(weekpot(potten.vast, naarCenten(2488))).toBe(43870);
  });
  it("sheet: pot extra 613,66 met 327 aan posten → 286,66 over", () => {
    const potten = verdeelPotten(naarCenten(4720.49), STANDAARD_VERDELING);
    expect(potten.extra - naarCenten(327)).toBe(28666);
  });
  it("verdeelt gelijk over de weken en de som klopt altijd", () => {
    expect(verdeelOverWeken(40000, 4)).toEqual([10000, 10000, 10000, 10000]);
    const vijf = verdeelOverWeken(43870, 5);
    expect(vijf).toEqual([8774, 8774, 8774, 8774, 8774]);
    const scheef = verdeelOverWeken(10001, 4);
    expect(scheef).toEqual([2501, 2500, 2500, 2500]);
    expect(som(scheef)).toBe(10001);
  });
  it("kan ook een negatieve weekpot verdelen", () => {
    const w = verdeelOverWeken(-1001, 4);
    expect(som(w)).toBe(-1001);
    expect(w).toEqual([-251, -250, -250, -250]);
  });
});

describe("doorschuiven per week", () => {
  it("schuift door wat over is", () => {
    const s = schuifDoor([10000, 10000, 10000], [6000, 0, 0]);
    expect(s[0]).toMatchObject({ doorgeschoven: 0, beschikbaar: 10000, over: 4000 });
    expect(s[1]).toMatchObject({ doorgeschoven: 4000, beschikbaar: 14000, over: 14000 });
    expect(s[2]).toMatchObject({ doorgeschoven: 14000, beschikbaar: 24000 });
  });
  it("trekt een overschrijding af van de volgende week", () => {
    const s = schuifDoor([10000, 10000, 10000], [13000, 2000, 0]);
    expect(s[0]!.over).toBe(-3000);
    expect(s[1]).toMatchObject({ doorgeschoven: -3000, beschikbaar: 7000, over: 5000 });
    expect(s[2]!.beschikbaar).toBe(15000);
  });
  it("kan meerdere weken achter elkaar negatief staan", () => {
    const s = schuifDoor([5000, 5000, 5000], [20000, 0, 0]);
    expect(s.map((w) => w.beschikbaar)).toEqual([5000, -10000, -5000]);
    expect(s[2]!.over).toBe(-5000);
  });
  it("ontvangen geld (negatief) maakt de week ruimer", () => {
    const s = schuifDoor([10000, 10000], [-2500, 0]);
    expect(s[0]!.over).toBe(12500);
    expect(s[1]!.beschikbaar).toBe(22500);
  });
  it("de laatste 'over' is de weekpot min alle uitgaven", () => {
    const basis = verdeelOverWeken(43870, 5);
    const uit = [9000, 1234, 0, 15000, 50];
    expect(schuifDoor(basis, uit).at(-1)!.over).toBe(43870 - som(uit));
  });
});

describe("weekindeling", () => {
  it("startdag zaterdag: blokken beginnen op zaterdag", () => {
    // 24 okt 2026 is een zaterdag.
    const b = weekblokken("2026-10-24", "2026-11-23", ZATERDAG);
    expect(b.map((x) => x.label)).toEqual([
      "24 t/m 30",
      "31 t/m 6",
      "7 t/m 13",
      "14 t/m 20",
      "21 t/m 27",
    ]);
    expect(b.map((x) => x.nr)).toEqual([1, 2, 3, 4, 5]);
  });
  it("periode die midden in de week begint: eerste blok start op de eerstvolgende startdag", () => {
    // 23 sep 2026 is een woensdag; de eerste zaterdag is 26 sep.
    const b = weekblokken("2026-09-23", "2026-10-22", ZATERDAG);
    expect(b[0]!.start).toBe("2026-09-26");
    expect(b.map((x) => x.label)).toEqual(["26 t/m 2", "3 t/m 9", "10 t/m 16", "17 t/m 23"]);
  });
  it("andere startdagen geven andere blokken", () => {
    const ma = weekblokken("2026-09-23", "2026-10-22", MAANDAG);
    expect(ma[0]!.start).toBe("2026-09-28");
    expect(ma).toHaveLength(4);
    const zo = weekblokken("2026-09-23", "2026-10-22", ZONDAG);
    expect(zo[0]!.start).toBe("2026-09-27");
    expect(zo).toHaveLength(4);
    const wo = weekblokken("2026-09-23", "2026-10-22", 3);
    expect(wo[0]!.start).toBe("2026-09-23");
    expect(wo).toHaveLength(5);
  });
  it("een periode van een maand heeft altijd 4 of 5 blokken", () => {
    for (let dag = 1; dag <= 28; dag++) {
      for (let startdag = 0; startdag < 7; startdag++) {
        const start = `2026-03-${String(dag).padStart(2, "0")}`;
        const eind = plusDagen(plusMaand(start), -1);
        const n = weekblokken(start, eind, startdag).length;
        expect(n === 4 || n === 5).toBe(true);
      }
    }
  });
  it("opeenvolgende periodes delen geen blok", () => {
    const a = weekblokken("2026-09-23", "2026-10-22", ZATERDAG);
    const b = weekblokken("2026-10-23", "2026-11-22", ZATERDAG);
    expect(b[0]!.start > a.at(-1)!.start).toBe(true);
    expect(b[0]!.start).toBe("2026-10-24");
  });
  it("heel korte periode zonder startdag erin: één blok vanaf de start", () => {
    const b = weekblokken("2026-09-21", "2026-09-23", ZATERDAG);
    expect(b).toHaveLength(1);
    expect(b[0]!.start).toBe("2026-09-21");
  });
  it("zet een datum in het juiste blok", () => {
    const b = weekblokken("2026-09-23", "2026-10-22", ZATERDAG);
    expect(weekIndexVoorDatum(b, "2026-09-26")).toBe(0);
    expect(weekIndexVoorDatum(b, "2026-10-02")).toBe(0);
    expect(weekIndexVoorDatum(b, "2026-10-03")).toBe(1);
    expect(weekIndexVoorDatum(b, "2026-10-22")).toBe(3);
  });
  it("dagen vóór het eerste blok en na het laatste tellen in het dichtstbijzijnde blok", () => {
    const b = weekblokken("2026-09-23", "2026-10-22", ZATERDAG);
    expect(weekIndexVoorDatum(b, "2026-09-23")).toBe(0);
    expect(weekIndexVoorDatum(b, "2026-11-30")).toBe(3);
  });
  it("plusMaand klemt op het einde van de maand", () => {
    expect(plusMaand("2026-01-31")).toBe("2026-02-28");
    expect(plusMaand("2026-10-24")).toBe("2026-11-24");
    expect(plusMaand("2026-12-15")).toBe("2027-01-15");
  });
});

const vl = (o: Partial<VasteLast> & { id: string }): VasteLast => ({
  naam: o.id,
  standaardBedrag: 1000,
  pot: "vast",
  termijnHuidig: null,
  termijnTotaal: null,
  actief: true,
  volgorde: 0,
  ...o,
});

describe("termijnen bij een nieuwe periode", () => {
  let teller = 0;
  const nieuwId = () => `r${++teller}`;

  it("neemt alle vaste lasten mee met lege vinkjes en het standaardbedrag", () => {
    const lasten = [vl({ id: "huur", standaardBedrag: 90000 }), vl({ id: "gas", volgorde: 1 })];
    const { regels, gewijzigd } = bouwNieuwePeriode(lasten, [{ vasteLastId: "huur" }], "p2", nieuwId);
    expect(regels).toHaveLength(2);
    expect(regels.every((r) => !r.betaald && r.periodeId === "p2")).toBe(true);
    expect(regels[0]).toMatchObject({ naam: "huur", bedrag: 90000, termijnNr: null });
    expect(gewijzigd).toEqual([]);
  });

  it("schuift een termijn één verder als de post al in de vorige periode stond", () => {
    const water = vl({ id: "water", termijnHuidig: 3, termijnTotaal: 8 });
    const { regels, gewijzigd } = bouwNieuwePeriode([water], [{ vasteLastId: "water" }], "p2", nieuwId);
    expect(regels[0]).toMatchObject({ termijnNr: 4, termijnTotaal: 8 });
    expect(termijnLabel(regels[0]!)).toBe("water · 4/8");
    expect(gewijzigd).toEqual([{ ...water, termijnHuidig: 4 }]);
  });

  it("begint in de allereerste periode op de ingevulde termijn", () => {
    const water = vl({ id: "water", termijnHuidig: 3, termijnTotaal: 8 });
    const { regels, gewijzigd } = bouwNieuwePeriode([water], [], "p1", nieuwId);
    expect(regels[0]!.termijnNr).toBe(3);
    expect(gewijzigd).toEqual([]);
  });

  it("laat de post verdwijnen na de laatste termijn", () => {
    const shorts = vl({ id: "shorts", pot: "persoonlijk", termijnHuidig: 3, termijnTotaal: 3 });
    const { regels, gewijzigd } = bouwNieuwePeriode(
      [shorts, vl({ id: "huur", volgorde: 1 })],
      [{ vasteLastId: "shorts" }, { vasteLastId: "huur" }],
      "p2",
      nieuwId,
    );
    expect(regels.map((r) => r.naam)).toEqual(["huur"]);
    expect(gewijzigd).toEqual([{ ...shorts, actief: false }]);
  });

  it("loopt over meerdere periodes van 1/3 naar 3/3 en stopt dan", () => {
    let lasten = [vl({ id: "shorts", pot: "persoonlijk", termijnHuidig: 1, termijnTotaal: 3 })];
    let vorige: PeriodeRegel[] = [];
    const gezien: (number | null)[] = [];
    for (let p = 1; p <= 5; p++) {
      const { regels, gewijzigd } = bouwNieuwePeriode(lasten, vorige, `p${p}`, nieuwId);
      lasten = lasten.map((l) => gewijzigd.find((g) => g.id === l.id) ?? l);
      gezien.push(regels[0]?.termijnNr ?? null);
      vorige = regels;
    }
    expect(gezien).toEqual([1, 2, 3, null, null]);
    expect(lasten[0]!.actief).toBe(false);
  });

  it("slaat inactieve posten over", () => {
    const { regels } = bouwNieuwePeriode([vl({ id: "oud", actief: false })], [], "p1", nieuwId);
    expect(regels).toEqual([]);
  });
});

describe("overzicht van een periode", () => {
  const periode: Periode = {
    id: "p1",
    startdatum: "2026-10-24",
    einddatum: "2026-11-23",
    salaris: naarCenten(4720.49),
    verdeling: STANDAARD_VERDELING,
    weekStartDag: ZATERDAG,
  };
  const regel = (o: Partial<PeriodeRegel>): PeriodeRegel => ({
    id: Math.random().toString(),
    periodeId: "p1",
    vasteLastId: null,
    naam: "x",
    pot: "vast",
    bedrag: 0,
    betaald: false,
    termijnNr: null,
    termijnTotaal: null,
    volgorde: 0,
    ...o,
  });
  const uit = (o: Partial<Uitgave>): Uitgave => ({
    id: Math.random().toString(),
    periodeId: "p1",
    datum: "2026-10-24",
    bedrag: 0,
    omschrijving: "x",
    pot: "vast",
    aangemaaktOp: "2026-10-24T10:00:00Z",
    ...o,
  });

  it("rekent de sheet na", () => {
    const o = berekenOverzicht(
      periode,
      [
        regel({ bedrag: naarCenten(2000), betaald: true }),
        regel({ bedrag: naarCenten(488) }),
        regel({ pot: "persoonlijk", bedrag: naarCenten(180.12) }),
      ],
      [
        uit({ pot: "extra", bedrag: naarCenten(400), omschrijving: "Reis" }),
        uit({ pot: "extra", bedrag: naarCenten(-73), omschrijving: "Terug van vriend" }),
      ],
    );
    expect(o.vast.weekpot).toBe(43870);
    expect(o.persoonlijk.weekpot).toBe(100000);
    expect(o.extra).toEqual({ budget: 61366, uitgegeven: 32700, over: 28666 });
    expect(o.status).toEqual({ betaald: 1, totaal: 3, openstaand: naarCenten(488 + 180.12) });
    expect(o.weken).toHaveLength(5);
    expect(o.weken[0]!.vast.beschikbaar).toBe(8774);
    expect(o.weken[0]!.persoonlijk.beschikbaar).toBe(20000);
  });

  it("zet uitgaven in de juiste week en schuift door", () => {
    const o = berekenOverzicht(
      periode,
      [],
      [
        uit({ datum: "2026-10-25", bedrag: 10000, pot: "persoonlijk" }),
        uit({ datum: "2026-11-01", bedrag: 5000, pot: "persoonlijk" }),
        uit({ datum: "2026-11-01", bedrag: 99900, pot: "extra" }),
      ],
    );
    const basis = verdeelOverWeken(118012, 5);
    expect(o.weken[0]!.persoonlijk.over).toBe(basis[0]! - 10000);
    expect(o.weken[1]!.persoonlijk.beschikbaar).toBe(basis[1]! + basis[0]! - 10000);
    expect(o.weken[1]!.uitgaven).toHaveLength(2);
    expect(o.persoonlijk.over).toBe(118012 - 15000);
    // Extra telt niet mee in de weekpotten.
    expect(o.weken[1]!.vast.uitgegeven).toBe(0);
  });
});

describe("snelknoppen voor winkels", () => {
  it("kiest de vaakst gebruikte en vult aan met de geïmporteerde lijst", () => {
    const recent = [
      { omschrijving: "Jumbo", pot: "vast" as const },
      { omschrijving: "Slager", pot: "vast" as const },
      { omschrijving: "jumbo", pot: "persoonlijk" as const },
      { omschrijving: "Jumbo", pot: "vast" as const },
    ];
    const top = topWinkels(recent, ["AH", "Jumbo", "Etos"], 3);
    expect(top).toEqual([
      { naam: "Jumbo", pot: "vast" },
      { naam: "Slager", pot: "vast" },
      { naam: "AH", pot: null },
    ]);
  });
});

describe("startdata importeren", () => {
  const geldig = {
    versie: 1,
    instellingen: {
      salaris: 1000.5,
      verdeling: { vast: 62, persoonlijk: 25, extra: 13 },
      weekStartDag: "zaterdag",
    },
    vasteLasten: [
      { naam: "Huur", bedrag: 0, pot: "vast" },
      { naam: "Waterschap", bedrag: 12.34, pot: "vast", termijn: { huidig: 3, totaal: 8 } },
    ],
    winkels: ["Jumbo", "AH", "Jumbo"],
  };
  it("leest het formaat uit de brief", () => {
    const d = leesStartdata(geldig);
    expect(d.instellingen).toEqual({
      salaris: 100050,
      verdeling: { vast: 62, persoonlijk: 25, extra: 13 },
      weekStartDag: 6,
    });
    expect(d.vasteLasten[1]).toEqual({
      naam: "Waterschap",
      bedrag: 1234,
      pot: "vast",
      termijn: { huidig: 3, totaal: 8 },
    });
    expect(d.winkels).toEqual(["Jumbo", "AH"]);
  });
  it("weigert ongeldige bestanden met een duidelijke melding", () => {
    expect(() => leesStartdata({ ...geldig, versie: 2 })).toThrow(ImportFout);
    expect(() =>
      leesStartdata({
        ...geldig,
        instellingen: { ...geldig.instellingen, verdeling: { vast: 50, persoonlijk: 25, extra: 13 } },
      }),
    ).toThrow(/samen 100/);
    expect(() =>
      leesStartdata({ ...geldig, vasteLasten: [{ naam: "X", bedrag: 1, pot: "extra" }] }),
    ).toThrow(/pot/);
    expect(() =>
      leesStartdata({
        ...geldig,
        vasteLasten: [{ naam: "X", bedrag: 1, pot: "vast", termijn: { huidig: 9, totaal: 8 } }],
      }),
    ).toThrow(/termijn/);
  });
});
