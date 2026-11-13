import type { Periode, Uitgave } from "../logica/overzicht";
import type { PeriodeRegel, VasteLast } from "../logica/termijnen";
import type { Backend, Instellingen } from "./backend";

// Demo-opslag (VITE_DEMO=true): alles in localStorage van deze browser, zonder
// Supabase en zonder inloggen. Bedoeld om de app lokaal uit te proberen.

const SLEUTEL = "hb-demo";

interface Inhoud {
  instellingen: Instellingen | null;
  vasteLasten: VasteLast[];
  periodes: Periode[];
  regels: PeriodeRegel[];
  uitgaven: Uitgave[];
}

const leeg = (): Inhoud => ({
  instellingen: null,
  vasteLasten: [],
  periodes: [],
  regels: [],
  uitgaven: [],
});

const upsert = <T extends { id: string }>(lijst: T[], nieuw: T[]): T[] => {
  const ids = new Set(nieuw.map((n) => n.id));
  return [...lijst.filter((x) => !ids.has(x.id)), ...nieuw];
};

export function maakGeheugenBackend(): Backend & { laatMislukken: (aan: boolean) => void } {
  let mislukt = false;

  const lees = (): Inhoud => {
    try {
      const tekst = localStorage.getItem(SLEUTEL);
      return tekst ? { ...leeg(), ...(JSON.parse(tekst) as Inhoud) } : leeg();
    } catch {
      return leeg();
    }
  };

  const schrijf = async (wijzig: (inhoud: Inhoud) => Inhoud) => {
    await new Promise((r) => setTimeout(r, 40));
    if (mislukt) throw new Error("Geen verbinding (demo)");
    localStorage.setItem(SLEUTEL, JSON.stringify(wijzig(lees())));
  };

  return {
    /** Alleen voor het testen van de foutafhandeling. */
    laatMislukken(aan) {
      mislukt = aan;
    },

    async laadBasis() {
      const d = lees();
      return {
        instellingen: d.instellingen,
        vasteLasten: [...d.vasteLasten].sort((a, b) => a.volgorde - b.volgorde),
        periodes: [...d.periodes].sort((a, b) => a.startdatum.localeCompare(b.startdatum)),
        recent: [...d.uitgaven]
          .sort((a, b) => b.aangemaaktOp.localeCompare(a.aangemaaktOp))
          .map(({ omschrijving, pot }) => ({ omschrijving, pot })),
      };
    },

    async laadPeriode(periodeId) {
      const d = lees();
      return {
        regels: d.regels
          .filter((r) => r.periodeId === periodeId)
          .sort((a, b) => a.volgorde - b.volgorde),
        uitgaven: d.uitgaven.filter((u) => u.periodeId === periodeId),
      };
    },

    bewaarInstellingen: (instellingen) => schrijf((d) => ({ ...d, instellingen })),
    bewaarVasteLasten: (lasten) =>
      schrijf((d) => ({ ...d, vasteLasten: upsert(d.vasteLasten, lasten) })),
    verwijderVasteLasten: (ids) =>
      schrijf((d) => ({
        ...d,
        vasteLasten: d.vasteLasten.filter((v) => !ids.includes(v.id)),
        regels: d.regels.map((r) =>
          r.vasteLastId && ids.includes(r.vasteLastId) ? { ...r, vasteLastId: null } : r,
        ),
      })),
    bewaarPeriode: (p) => schrijf((d) => ({ ...d, periodes: upsert(d.periodes, [p]) })),
    bewaarRegels: (regels) => schrijf((d) => ({ ...d, regels: upsert(d.regels, regels) })),
    verwijderRegels: (ids) =>
      schrijf((d) => ({ ...d, regels: d.regels.filter((r) => !ids.includes(r.id)) })),
    bewaarUitgave: (u) => schrijf((d) => ({ ...d, uitgaven: upsert(d.uitgaven, [u]) })),
    verwijderUitgave: (id) =>
      schrijf((d) => ({ ...d, uitgaven: d.uitgaven.filter((u) => u.id !== id) })),
  };
}
