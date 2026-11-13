import { describe, expect, it } from "vitest";
import { groepeerUitgaven } from "./groepen";
import type { Uitgave } from "./overzicht";

let teller = 0;
const uit = (o: Partial<Uitgave>): Uitgave => ({
  id: `u${++teller}`,
  periodeId: "p1",
  datum: "2026-11-13",
  bedrag: 1000,
  omschrijving: "Jumbo",
  pot: "vast",
  aangemaaktOp: `2026-11-13T10:00:${String(teller).padStart(2, "0")}Z`,
  ...o,
});

describe("uitgaven samenvoegen in een week", () => {
  it("voegt dezelfde naam in dezelfde pot samen, met het totaal", () => {
    const g = groepeerUitgaven([
      uit({ bedrag: 1250 }),
      uit({ bedrag: 800, omschrijving: "Slager" }),
      uit({ bedrag: 2000, datum: "2026-11-15" }),
    ]);
    expect(g.map((x) => [x.naam, x.pot, x.uitgaven.length, x.totaal])).toEqual([
      ["Jumbo", "vast", 2, 3250],
      ["Slager", "vast", 1, 800],
    ]);
  });

  it("vergelijkt zonder verschil in hoofdletters en zonder spaties eromheen", () => {
    const g = groepeerUitgaven([
      uit({ omschrijving: "Jumbo" }),
      uit({ omschrijving: "  jumbo " }),
      uit({ omschrijving: "JUMBO" }),
      uit({ omschrijving: "Jumbo City" }),
    ]);
    expect(g.map((x) => [x.naam, x.uitgaven.length])).toEqual([
      ["Jumbo", 3],
      ["Jumbo City", 1],
    ]);
  });

  it("houdt dezelfde naam in een andere pot apart", () => {
    const g = groepeerUitgaven([
      uit({ pot: "vast", bedrag: 1000 }),
      uit({ pot: "persoonlijk", bedrag: 300 }),
      uit({ pot: "vast", bedrag: 500 }),
    ]);
    expect(g.map((x) => [x.pot, x.totaal])).toEqual([
      ["vast", 1500],
      ["persoonlijk", 300],
    ]);
    expect(new Set(g.map((x) => x.sleutel)).size).toBe(2);
  });

  it("laat de pot Extra weg", () => {
    const g = groepeerUitgaven([
      uit({ pot: "extra", omschrijving: "Cadeau" }),
      uit({ pot: "extra" }),
      uit({ pot: "persoonlijk", omschrijving: "Bioscoop" }),
    ]);
    expect(g.map((x) => x.naam)).toEqual(["Bioscoop"]);
  });

  it("sorteert op de datum van de eerste uitgave, en de losse uitgaven op datum", () => {
    const laat = uit({ datum: "2026-11-18", bedrag: 100 });
    const vroeg = uit({ datum: "2026-11-14", bedrag: 200 });
    const g = groepeerUitgaven([
      laat,
      uit({ datum: "2026-11-16", omschrijving: "Slager" }),
      vroeg,
      uit({ datum: "2026-11-13", omschrijving: "Bakker" }),
    ]);
    expect(g.map((x) => x.naam)).toEqual(["Bakker", "Jumbo", "Slager"]);
    expect(g[1]!.uitgaven).toEqual([vroeg, laat]);
  });

  it("ontvangen geld telt negatief mee in het totaal", () => {
    const g = groepeerUitgaven([uit({ bedrag: 2000 }), uit({ bedrag: -500 })]);
    expect(g[0]!.totaal).toBe(1500);
  });

  it("geeft een lege lijst bij geen uitgaven", () => {
    expect(groepeerUitgaven([])).toEqual([]);
  });
});
