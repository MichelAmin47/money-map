import { beforeEach, describe, expect, it } from "vitest";
import type { Periode } from "../logica/overzicht";
import { maakGeheugenBackend } from "./geheugenBackend";
import { periodeNaarRij, periodeVanRij, type PeriodeRij } from "./supabaseBackend";

const periode: Periode = {
  id: "p1",
  startdatum: "2026-11-13",
  einddatum: "2026-12-17",
  salaris: 300000,
  verdeling: { vast: 62, persoonlijk: 25, extra: 13 },
  weekStartDag: 1,
  startsaldo: -1950,
};

describe("Supabase-backend: startsaldo van een periode", () => {
  it("gaat als euro's naar de database en komt als centen terug", () => {
    const rij = periodeNaarRij(periode);
    expect(rij.startsaldo).toBe(-19.5);
    expect(periodeVanRij(rij)).toEqual(periode);
  });

  it("leest numeric als tekst, zoals PostgREST het kan teruggeven", () => {
    const rij = { ...periodeNaarRij(periode), startsaldo: "19.00" as unknown as number };
    expect(periodeVanRij(rij).startsaldo).toBe(1900);
  });

  it("is 0 zolang de kolom nog niet bestaat (migratie nog niet gedraaid)", () => {
    const { startsaldo: _weg, ...zonder } = periodeNaarRij(periode);
    expect(periodeVanRij(zonder as PeriodeRij).startsaldo).toBe(0);
  });
});

describe("demo-backend: startsaldo van een periode", () => {
  beforeEach(() => {
    const opslag = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => opslag.get(k) ?? null,
      setItem: (k: string, v: string) => void opslag.set(k, v),
    } as Storage;
  });

  it("bewaart het startsaldo en geeft het terug", async () => {
    const b = maakGeheugenBackend();
    await b.bewaarPeriode(periode);
    expect((await b.laadBasis()).periodes).toEqual([periode]);
  });

  it("geeft periodes van vóór het saldo startsaldo 0", async () => {
    const { startsaldo: _weg, ...oud } = periode;
    localStorage.setItem("hb-demo", JSON.stringify({ periodes: [oud] }));
    const b = maakGeheugenBackend();
    expect((await b.laadBasis()).periodes[0]!.startsaldo).toBe(0);
  });
});
