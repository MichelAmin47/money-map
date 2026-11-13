import type { Centen } from "../logica/geld";
import type { Periode, Uitgave } from "../logica/overzicht";
import type { Pot, Verdeling } from "../logica/potten";
import type { PeriodeRegel, VasteLast } from "../logica/termijnen";

export interface Instellingen {
  salaris: Centen;
  verdeling: Verdeling;
  /** 0 = zondag … 6 = zaterdag */
  weekStartDag: number;
  winkels: string[];
}

export interface Basis {
  /** null zolang er nog niets is opgeslagen. */
  instellingen: Instellingen | null;
  vasteLasten: VasteLast[];
  periodes: Periode[];
  /** Recente omschrijvingen, nieuwste eerst, voor de snelknoppen. */
  recent: { omschrijving: string; pot: Pot }[];
}

export interface PeriodeData {
  regels: PeriodeRegel[];
  uitgaven: Uitgave[];
}

/**
 * De opslaglaag. Alle schrijfacties zijn idempotent (upsert op id, of
 * verwijderen op id), zodat een mislukte actie veilig opnieuw kan.
 */
export interface Backend {
  laadBasis(): Promise<Basis>;
  laadPeriode(periodeId: string): Promise<PeriodeData>;
  bewaarInstellingen(i: Instellingen): Promise<void>;
  bewaarVasteLasten(lasten: VasteLast[]): Promise<void>;
  verwijderVasteLasten(ids: string[]): Promise<void>;
  bewaarPeriode(p: Periode): Promise<void>;
  bewaarRegels(regels: PeriodeRegel[]): Promise<void>;
  verwijderRegels(ids: string[]): Promise<void>;
  bewaarUitgave(u: Uitgave): Promise<void>;
  verwijderUitgave(id: string): Promise<void>;
}
