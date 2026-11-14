import { describe, expect, it } from "vitest";
import { formatEuro, formatMetTeken, naarCenten } from "./geld";
import { berekenKerncijfers, berekenOverzicht, type Periode, type Uitgave } from "./overzicht";
import { STANDAARD_VERDELING } from "./potten";
import type { PeriodeRegel } from "./termijnen";

const periode = { salaris: naarCenten(4720.49) };

describe("kerncijfers", () => {
  it("controle uit de sheet: salaris 4720,49, vaste lasten 2850 (92 betaald), uitgaven 155", () => {
    const regels = [
      { bedrag: naarCenten(92), betaald: true },
      { bedrag: naarCenten(2758), betaald: false },
    ];
    const k = berekenKerncijfers(periode, regels, [{ bedrag: naarCenten(155) }]);
    expect(k).toEqual({
      salaris: naarCenten(4720.49),
      total: naarCenten(3005),
      uitgave: naarCenten(247),
      rest: naarCenten(1715.49),
      wrkRest: naarCenten(4473.49),
    });
  });

  it("Total telt alle vaste lasten, Uitgave alleen die met een V", () => {
    const regels = [
      { bedrag: 10000, betaald: true },
      { bedrag: 20000, betaald: false },
      { bedrag: 5000, betaald: true },
    ];
    const k = berekenKerncijfers({ salaris: 100000 }, regels, []);
    expect(k.total).toBe(35000);
    expect(k.uitgave).toBe(15000);
    expect(k.rest).toBe(65000);
    expect(k.wrkRest).toBe(85000);
  });

  it("ontvangen geld is negatief en maakt Rest en Wrk rest groter", () => {
    const k = berekenKerncijfers({ salaris: 100000 }, [], [{ bedrag: 3000 }, { bedrag: -5000 }]);
    expect(k.total).toBe(-2000);
    expect(k.uitgave).toBe(-2000);
    expect(k.rest).toBe(102000);
    expect(k.wrkRest).toBe(102000);
  });

  it("is alles afgevinkt, dan zijn Total en Uitgave gelijk", () => {
    const k = berekenKerncijfers(
      { salaris: 100000 },
      [{ bedrag: 40000, betaald: true }],
      [{ bedrag: 1000 }],
    );
    expect(k.total).toBe(k.uitgave);
    expect(k.rest).toBe(k.wrkRest);
  });

  it("zit in berekenOverzicht, met uitgaven uit alle potten en zonder het startsaldo", () => {
    const p: Periode = {
      id: "p",
      startdatum: "2026-01-01",
      einddatum: "2026-01-31",
      salaris: 300000,
      verdeling: STANDAARD_VERDELING,
      weekStartDag: 1,
      startsaldo: 12345,
    };
    const regel = (id: string, bedrag: number, betaald: boolean): PeriodeRegel => ({
      id,
      periodeId: "p",
      vasteLastId: null,
      naam: `Post ${id}`,
      pot: "vast",
      bedrag,
      betaald,
      termijnNr: null,
      termijnTotaal: null,
      volgorde: 0,
    });
    const uitgave = (id: string, bedrag: number, pot: Uitgave["pot"]): Uitgave => ({
      id,
      periodeId: "p",
      datum: "2026-01-05",
      bedrag,
      omschrijving: `Winkel ${id}`,
      pot,
      aangemaaktOp: "2026-01-05T10:00:00Z",
    });
    const o = berekenOverzicht(
      p,
      [regel("a", 100000, true), regel("b", 50000, false)],
      [uitgave("1", 2000, "vast"), uitgave("2", 3000, "persoonlijk"), uitgave("3", 5000, "extra")],
    );
    expect(o.kern).toEqual({
      salaris: 300000,
      total: 160000,
      uitgave: 110000,
      rest: 140000,
      wrkRest: 190000,
    });
    // Het saldo is de werkelijke rest plus het startsaldo.
    expect(o.saldo.saldo).toBe(o.kern.wrkRest + p.startsaldo);
  });
});

describe("formatMetTeken", () => {
  it("zet een los plus- of minteken voor het bedrag", () => {
    expect(formatMetTeken(4500)).toBe(`+ ${formatEuro(4500)}`);
    expect(formatMetTeken(-1200)).toBe(`− ${formatEuro(1200)}`);
    expect(formatMetTeken(0)).toBe(formatEuro(0));
  });
});
