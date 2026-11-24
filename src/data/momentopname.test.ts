import { describe, expect, it } from "vitest";
import {
  bewaarMomentopname,
  leesBewaardeGebruiker,
  leesMomentopname,
  MOMENTOPNAME_SLEUTEL,
  wisMomentopname,
  type Momentopname,
  type Opslag,
} from "./momentopname";

/** localStorage in het geheugen; met `vol` mislukt elk schrijven. */
function nepOpslag() {
  const m = new Map<string, string>();
  const stand = { vol: false, geblokkeerd: false };
  const opslag: Opslag = {
    getItem: (k) => {
      if (stand.geblokkeerd) throw new Error("SecurityError");
      return m.get(k) ?? null;
    },
    setItem: (k, v) => {
      if (stand.vol || stand.geblokkeerd) throw new Error("QuotaExceededError");
      m.set(k, v);
    },
    removeItem: (k) => void m.delete(k),
  };
  return { opslag, m, stand };
}

const kopie = (gebruiker = "gebruiker-a"): Momentopname => ({
  versie: 1,
  gebruiker,
  bewaardOp: "2026-11-21T10:12:00.000Z",
  instellingen: {
    salaris: 300000,
    verdeling: { vast: 62, persoonlijk: 25, extra: 13 },
    weekStartDag: 1,
    winkels: [],
  },
  vasteLasten: [],
  periodes: [
    {
      id: "p1",
      startdatum: "2026-11-13",
      einddatum: "2026-12-17",
      salaris: 300000,
      verdeling: { vast: 62, persoonlijk: 25, extra: 13 },
      weekStartDag: 1,
      startsaldo: 0,
    },
  ],
  data: { p1: { regels: [], uitgaven: [] } },
});

describe("momentopname", () => {
  it("bewaart en leest terug voor dezelfde gebruiker", () => {
    const { opslag } = nepOpslag();
    expect(bewaarMomentopname(opslag, kopie())).toBe(true);
    expect(leesMomentopname(opslag, "gebruiker-a")).toEqual(kopie());
  });

  it("geeft null als er niets bewaard is", () => {
    expect(leesMomentopname(nepOpslag().opslag, "gebruiker-a")).toBeNull();
  });

  it("gebruikt de momentopname van een ander account niet en wist hem", () => {
    const { opslag, m } = nepOpslag();
    bewaarMomentopname(opslag, kopie("gebruiker-a"));
    expect(leesMomentopname(opslag, "gebruiker-b")).toBeNull();
    expect(m.has(MOMENTOPNAME_SLEUTEL)).toBe(false);
  });

  it("negeert en wist een ander versienummer", () => {
    const { opslag, m } = nepOpslag();
    m.set(MOMENTOPNAME_SLEUTEL, JSON.stringify({ ...kopie(), versie: 0 }));
    expect(leesMomentopname(opslag, "gebruiker-a")).toBeNull();
    expect(m.has(MOMENTOPNAME_SLEUTEL)).toBe(false);
  });

  it("negeert en wist een beschadigde inhoud", () => {
    for (const rommel of [
      "{niet-json",
      "null",
      "[]",
      JSON.stringify({ ...kopie(), periodes: "kapot" }),
      JSON.stringify({ ...kopie(), data: { p1: { regels: [] } } }),
      JSON.stringify({ ...kopie(), bewaardOp: "gisteren" }),
      JSON.stringify({ ...kopie(), instellingen: null }),
    ]) {
      const { opslag, m } = nepOpslag();
      m.set(MOMENTOPNAME_SLEUTEL, rommel);
      expect(leesMomentopname(opslag, "gebruiker-a")).toBeNull();
      expect(m.has(MOMENTOPNAME_SLEUTEL)).toBe(false);
    }
  });

  it("wist bij uitloggen", () => {
    const { opslag } = nepOpslag();
    bewaarMomentopname(opslag, kopie());
    wisMomentopname(opslag);
    expect(leesMomentopname(opslag, "gebruiker-a")).toBeNull();
  });

  it("crasht niet als de opslag vol of geblokkeerd is", () => {
    const { opslag, stand } = nepOpslag();
    stand.vol = true;
    expect(bewaarMomentopname(opslag, kopie())).toBe(false);
    stand.geblokkeerd = true;
    expect(leesMomentopname(opslag, "gebruiker-a")).toBeNull();
    expect(() => wisMomentopname(opslag)).not.toThrow();
    expect(bewaarMomentopname(null, kopie())).toBe(false);
    expect(leesMomentopname(null, "gebruiker-a")).toBeNull();
  });
});

describe("leesBewaardeGebruiker", () => {
  it("leest de user_id uit de bewaarde login van Supabase", () => {
    const { opslag, m } = nepOpslag();
    m.set("hb-sessie", JSON.stringify({ access_token: "x", refresh_token: "y", user: { id: "u1" } }));
    expect(leesBewaardeGebruiker(opslag, "hb-sessie")).toBe("u1");
  });

  it("geeft null zonder login, zonder refresh-token of bij rommel", () => {
    const { opslag, m } = nepOpslag();
    expect(leesBewaardeGebruiker(opslag, "hb-sessie")).toBeNull();
    m.set("hb-sessie", JSON.stringify({ user: { id: "u1" } }));
    expect(leesBewaardeGebruiker(opslag, "hb-sessie")).toBeNull();
    m.set("hb-sessie", "{kapot");
    expect(leesBewaardeGebruiker(opslag, "hb-sessie")).toBeNull();
    expect(leesBewaardeGebruiker(null, "hb-sessie")).toBeNull();
  });
});
