import { describe, expect, it } from "vitest";
import { naarCenten, parseSaldo } from "./geld";
import { berekenOverzicht, berekenSaldo, type Periode } from "./overzicht";
import { STANDAARD_VERDELING } from "./potten";

const periode = { startsaldo: naarCenten(19), salaris: naarCenten(4720.49) };

describe("saldo", () => {
  it("controle uit de sheet: startsaldo 19 + salaris 4720,49 − 247 aan uitgaven = 4492,49", () => {
    const s = berekenSaldo(periode, [], [{ bedrag: naarCenten(247) }]);
    expect(s.saldo).toBe(naarCenten(4492.49));
    expect(s).toEqual({
      startsaldo: 1900,
      salaris: 472049,
      betaald: 0,
      uitgaven: 24700,
      saldo: 449249,
    });
  });

  it("vaste lasten tellen pas mee als ze een V hebben", () => {
    const regels = [
      { bedrag: 10000, betaald: true },
      { bedrag: 99900, betaald: false },
      { bedrag: 2500, betaald: true },
    ];
    const s = berekenSaldo(periode, regels, []);
    expect(s.betaald).toBe(12500);
    expect(s.saldo).toBe(1900 + 472049 - 12500);
  });

  it("telt de uitgaven uit alle drie de potten, in dezelfde som als de vaste lasten met een V", () => {
    const s = berekenSaldo(
      periode,
      [{ bedrag: 10000, betaald: true }],
      [{ bedrag: 5000 }, { bedrag: 4700 }, { bedrag: 5000 }],
    );
    expect(s.saldo).toBe(1900 + 472049 - 24700);
  });

  it("ontvangen geld is een negatief bedrag en telt dus op bij het saldo", () => {
    const s = berekenSaldo(periode, [], [{ bedrag: 3000 }, { bedrag: -7300 }]);
    expect(s.uitgaven).toBe(-4300);
    expect(s.saldo).toBe(1900 + 472049 + 4300);
  });

  it("kan negatief worden, ook met een negatief startsaldo", () => {
    const s = berekenSaldo({ startsaldo: -5000, salaris: 10000 }, [], [{ bedrag: 6000 }]);
    expect(s.saldo).toBe(-1000);
  });

  it("zit in het overzicht en gebruikt het salaris uit de snapshot van de periode", () => {
    const p: Periode = {
      id: "p1",
      startdatum: "2026-11-13",
      einddatum: "2026-12-17",
      salaris: 300000,
      verdeling: STANDAARD_VERDELING,
      weekStartDag: 1,
      startsaldo: 1500,
    };
    const basis = { id: "u", periodeId: "p1", omschrijving: "x", aangemaaktOp: "" };
    const o = berekenOverzicht(
      p,
      [],
      [
        { ...basis, datum: "2026-11-13", bedrag: 1000, pot: "vast" },
        { ...basis, datum: "2026-11-20", bedrag: 2000, pot: "persoonlijk" },
        { ...basis, datum: "2026-12-01", bedrag: 4000, pot: "extra" },
      ],
    );
    expect(o.saldo.saldo).toBe(1500 + 300000 - 7000);
  });
});

describe("saldo invoeren", () => {
  it("leest een bedrag, met de schakelaar voor onder nul", () => {
    expect(parseSaldo("19", false)).toBe(1900);
    expect(parseSaldo("19,50", true)).toBe(-1950);
    expect(parseSaldo("-19,50", false)).toBe(-1950);
    expect(parseSaldo("-19,50", true)).toBe(-1950);
  });
  it("een leeg veld is 0, onzin is null", () => {
    expect(parseSaldo("", false)).toBe(0);
    expect(parseSaldo("  ", true)).toBe(0);
    expect(parseSaldo("0", true)).toBe(0);
    expect(parseSaldo("abc", false)).toBeNull();
  });
});
