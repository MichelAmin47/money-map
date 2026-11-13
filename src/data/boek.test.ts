import { describe, expect, it } from "vitest";
import type { Periode, Uitgave } from "../logica/overzicht";
import type { Startdata } from "../logica/startdata";
import type { PeriodeRegel, VasteLast } from "../logica/termijnen";
import type { Backend, Instellingen } from "./backend";
import { Boek } from "./boek";

/** Backend in het geheugen, met een schakelaar om opslaan te laten mislukken. */
function nepBackend() {
  const db = {
    instellingen: null as Instellingen | null,
    lasten: new Map<string, VasteLast>(),
    periodes: new Map<string, Periode>(),
    regels: new Map<string, PeriodeRegel>(),
    uitgaven: new Map<string, Uitgave>(),
  };
  const stand = { kapot: false };
  const schrijf = async (fn: () => void) => {
    await Promise.resolve();
    if (stand.kapot) throw new Error("geen verbinding");
    fn();
  };
  const backend: Backend = {
    laadBasis: async () => ({
      instellingen: db.instellingen,
      vasteLasten: [...db.lasten.values()],
      periodes: [...db.periodes.values()].sort((a, b) => a.startdatum.localeCompare(b.startdatum)),
      recent: [],
    }),
    laadPeriode: async (id) => ({
      regels: [...db.regels.values()].filter((r) => r.periodeId === id),
      uitgaven: [...db.uitgaven.values()].filter((u) => u.periodeId === id),
    }),
    bewaarInstellingen: (i) => schrijf(() => void (db.instellingen = i)),
    bewaarVasteLasten: (l) => schrijf(() => l.forEach((v) => db.lasten.set(v.id, v))),
    verwijderVasteLasten: (ids) => schrijf(() => ids.forEach((id) => db.lasten.delete(id))),
    bewaarPeriode: (p) => schrijf(() => void db.periodes.set(p.id, p)),
    bewaarRegels: (r) => schrijf(() => r.forEach((x) => db.regels.set(x.id, x))),
    verwijderRegels: (ids) => schrijf(() => ids.forEach((id) => db.regels.delete(id))),
    bewaarUitgave: (u) => schrijf(() => void db.uitgaven.set(u.id, u)),
    verwijderUitgave: (id) => schrijf(() => void db.uitgaven.delete(id)),
  };
  return { backend, db, stand };
}

const rust = () => new Promise((r) => setTimeout(r, 5));

const START: Startdata = {
  instellingen: { salaris: 472049, verdeling: { vast: 62, persoonlijk: 25, extra: 13 }, weekStartDag: 6 },
  vasteLasten: [
    { naam: "Huur", bedrag: 200000, pot: "vast", termijn: null },
    { naam: "Waterschap", bedrag: 48800, pot: "vast", termijn: { huidig: 3, totaal: 8 } },
    { naam: "Shorts", bedrag: 2000, pot: "persoonlijk", termijn: { huidig: 3, totaal: 3 } },
  ],
  winkels: ["Jumbo"],
};

async function nieuwBoek() {
  const nep = nepBackend();
  const boek = new Boek(nep.backend);
  await boek.laad();
  return { boek, ...nep };
}

const regelsVan = (boek: Boek) => {
  const s = boek.momentopname();
  return s.data[s.periodeId!]!.regels;
};

describe("Boek", () => {
  it("import is idempotent: twee keer importeren geeft geen dubbelen", async () => {
    const { boek, db } = await nieuwBoek();
    boek.importeer(START, false);
    boek.importeer(START, false);
    await rust();
    expect(boek.momentopname().vasteLasten).toHaveLength(3);
    expect(db.lasten.size).toBe(3);
    expect(db.instellingen?.salaris).toBe(472049);
    expect(db.instellingen?.winkels).toEqual(["Jumbo"]);
  });

  it("eerste periode neemt de termijnen over zoals ingevuld, de tweede schuift ze op", async () => {
    const { boek, db } = await nieuwBoek();
    boek.importeer(START, false);
    expect(boek.startPeriode("2026-10-24", "2026-11-24")).toBeNull();
    expect(regelsVan(boek).map((r) => [r.naam, r.termijnNr])).toEqual([
      ["Huur", null],
      ["Waterschap", 3],
      ["Shorts", 3],
    ]);

    const huur = regelsVan(boek)[0]!;
    boek.wijzigRegel({ ...huur, betaald: true, bedrag: 210000 });

    expect(boek.startPeriode("2026-11-24", "2026-12-24")).toBeNull();
    expect(regelsVan(boek).map((r) => [r.naam, r.termijnNr, r.betaald, r.bedrag])).toEqual([
      ["Huur", null, false, 200000],
      ["Waterschap", 4, false, 48800],
    ]);
    await rust();
    expect(db.periodes.size).toBe(2);
    expect([...db.lasten.values()].find((v) => v.naam === "Shorts")?.actief).toBe(false);
    expect([...db.lasten.values()].find((v) => v.naam === "Waterschap")?.termijnHuidig).toBe(4);
    // De vorige periode blijft bewaard, met het afwijkende bedrag en het vinkje.
    expect(db.regels.get(huur.id)).toMatchObject({ betaald: true, bedrag: 210000 });
  });

  it("kort de vorige periode in als het salaris eerder komt", async () => {
    const { boek } = await nieuwBoek();
    boek.startPeriode("2026-10-24", "2026-11-24");
    boek.startPeriode("2026-11-20", "2026-12-20");
    expect(boek.momentopname().periodes.map((p) => [p.startdatum, p.einddatum])).toEqual([
      ["2026-10-24", "2026-11-19"],
      ["2026-11-20", "2026-12-19"],
    ]);
  });

  it("weigert een periode die niet na de lopende begint", async () => {
    const { boek } = await nieuwBoek();
    boek.startPeriode("2026-10-24", "2026-11-24");
    expect(boek.startPeriode("2026-10-24", "2026-11-24")).toMatch(/na de start/);
    expect(boek.startPeriode("2026-12-01", "2026-12-01")).toMatch(/salarisdatum/);
  });

  it("aankoop in termijnen: post in Persoonlijk, eerste termijn telt nu mee", async () => {
    const { boek } = await nieuwBoek();
    boek.startPeriode("2026-10-24", "2026-11-24");
    boek.voegTermijnAankoopToe("Zalando jas", 2000, 3);
    expect(regelsVan(boek)[0]).toMatchObject({
      naam: "Zalando jas",
      pot: "persoonlijk",
      bedrag: 2000,
      termijnNr: 1,
      termijnTotaal: 3,
      betaald: true,
    });
    boek.startPeriode("2026-11-24", "2026-12-24");
    expect(regelsVan(boek)[0]).toMatchObject({ termijnNr: 2, betaald: false });
  });

  it("standaardbedrag wijzigen laat een afwijkend periodebedrag staan", async () => {
    const { boek } = await nieuwBoek();
    boek.importeer(START, false);
    boek.startPeriode("2026-10-24", "2026-11-24");
    const [huur, water] = regelsVan(boek);
    boek.wijzigRegel({ ...water!, bedrag: 51000 });
    const lasten = boek.momentopname().vasteLasten;
    const basis = { pot: "vast" as const, termijnHuidig: null, termijnTotaal: null };
    boek.wijzigVasteLast(huur!.vasteLastId!, { ...basis, naam: "Huur", standaardBedrag: 205000 });
    boek.wijzigVasteLast(water!.vasteLastId!, {
      ...lasten[1]!,
      standaardBedrag: 49000,
    });
    expect(regelsVan(boek).map((r) => r.bedrag)).toEqual([205000, 51000, 2000]);
  });

  it("optimistisch: mislukt opslaan blijft zichtbaar en lukt na opnieuw proberen", async () => {
    const { boek, db, stand } = await nieuwBoek();
    boek.startPeriode("2026-10-24", "2026-11-24");
    await rust();
    const pid = boek.momentopname().periodeId!;

    stand.kapot = true;
    const invoer = { datum: "2026-10-25", bedrag: 1250, pot: "vast" as const };
    boek.voegUitgaveToe(pid, { ...invoer, omschrijving: "Jumbo" });
    boek.voegUitgaveToe(pid, { ...invoer, omschrijving: "Slager" });
    await rust();
    expect(boek.momentopname().data[pid]!.uitgaven).toHaveLength(2);
    expect(boek.momentopname().opslag).toEqual({ wachtend: 2, fout: "geen verbinding" });
    expect(db.uitgaven.size).toBe(0);

    stand.kapot = false;
    boek.opnieuwOpslaan();
    await rust();
    expect(boek.momentopname().opslag).toEqual({ wachtend: 0, fout: null });
    expect([...db.uitgaven.values()].map((u) => u.omschrijving)).toEqual(["Jumbo", "Slager"]);
  });

  it("vervangen bij import haalt de oude vaste lasten weg, ook uit de lopende periode", async () => {
    const { boek, db } = await nieuwBoek();
    boek.importeer(START, false);
    boek.startPeriode("2026-10-24", "2026-11-24");
    boek.importeer(
      { ...START, vasteLasten: [{ naam: "Gas", bedrag: 9000, pot: "vast", termijn: null }] },
      true,
    );
    await rust();
    expect(boek.momentopname().vasteLasten.map((v) => v.naam)).toEqual(["Gas"]);
    expect(regelsVan(boek).map((r) => r.naam)).toEqual(["Gas"]);
    expect([...db.lasten.values()].map((v) => v.naam)).toEqual(["Gas"]);
    expect([...db.regels.values()].map((r) => r.naam)).toEqual(["Gas"]);
  });
});
