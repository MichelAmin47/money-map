import { plusDagen, type ISODatum } from "../logica/datum";
import { naarEuro, type Centen } from "../logica/geld";
import { berekenSaldo, type Periode, type Uitgave } from "../logica/overzicht";
import { STANDAARD_VERDELING, type Pot, type WeekPot } from "../logica/potten";
import { importSleutel, type Startdata } from "../logica/startdata";
import { bouwNieuwePeriode, type PeriodeRegel, type VasteLast } from "../logica/termijnen";
import { WEEKDAGEN } from "../logica/datum";
import type { Backend, Instellingen, PeriodeData } from "./backend";
import { Wachtrij, type OpslagStatus } from "./wachtrij";

export interface Staat {
  fase: "laden" | "klaar" | "fout";
  laadFout: string | null;
  instellingen: Instellingen;
  vasteLasten: VasteLast[];
  /** Oplopend op startdatum; de laatste is de lopende periode. */
  periodes: Periode[];
  /** De periode die nu in beeld is. */
  periodeId: string | null;
  data: Record<string, PeriodeData>;
  periodeLaden: boolean;
  recent: { omschrijving: string; pot: Pot }[];
  /** Oude periodes die na bevestiging bewerkbaar zijn gemaakt. */
  ontgrendeld: string[];
  opslag: OpslagStatus;
}

export interface VasteLastInvoer {
  naam: string;
  standaardBedrag: Centen;
  pot: WeekPot;
  termijnHuidig: number | null;
  termijnTotaal: number | null;
}

export interface UitgaveInvoer {
  datum: ISODatum;
  bedrag: Centen;
  omschrijving: string;
  pot: Pot;
}

export const STANDAARD_INSTELLINGEN: Instellingen = {
  salaris: 0,
  verdeling: STANDAARD_VERDELING,
  weekStartDag: 6,
  winkels: [],
};

const nieuwId = (): string => crypto.randomUUID();

const LEEG: PeriodeData = { regels: [], uitgaven: [] };

/**
 * De toestand van de app plus alle acties. Elke actie past de toestand meteen
 * aan (optimistisch) en zet het opslaan in de wachtrij.
 */
export class Boek {
  private staat: Staat = {
    fase: "laden",
    laadFout: null,
    instellingen: STANDAARD_INSTELLINGEN,
    vasteLasten: [],
    periodes: [],
    periodeId: null,
    data: {},
    periodeLaden: false,
    recent: [],
    ontgrendeld: [],
    opslag: { wachtend: 0, fout: null },
  };
  private luisteraars = new Set<() => void>();
  private wachtrij = new Wachtrij((opslag) => this.zet({ opslag }));

  constructor(private backend: Backend) {}

  // --- koppeling met React (useSyncExternalStore) --------------------------

  abonneer = (fn: () => void): (() => void) => {
    this.luisteraars.add(fn);
    return () => this.luisteraars.delete(fn);
  };

  momentopname = (): Staat => this.staat;

  private zet(deel: Partial<Staat>): void {
    this.staat = { ...this.staat, ...deel };
    this.luisteraars.forEach((fn) => fn());
  }

  private zetData(periodeId: string, wijzig: (d: PeriodeData) => PeriodeData): void {
    const huidig = this.staat.data[periodeId] ?? LEEG;
    this.zet({ data: { ...this.staat.data, [periodeId]: wijzig(huidig) } });
  }

  private bewaar(taak: (b: Backend) => Promise<void>): void {
    this.wachtrij.voegToe(() => taak(this.backend));
  }

  // --- afgeleiden ----------------------------------------------------------

  get lopende(): Periode | null {
    return this.staat.periodes.at(-1) ?? null;
  }

  // --- laden ---------------------------------------------------------------

  async laad(): Promise<void> {
    this.zet({ fase: "laden", laadFout: null });
    try {
      const basis = await this.backend.laadBasis();
      const lopende = basis.periodes.at(-1) ?? null;
      const data: Record<string, PeriodeData> = {};
      if (lopende) data[lopende.id] = await this.backend.laadPeriode(lopende.id);
      this.zet({
        fase: "klaar",
        instellingen: basis.instellingen ?? STANDAARD_INSTELLINGEN,
        vasteLasten: basis.vasteLasten,
        periodes: basis.periodes,
        periodeId: lopende?.id ?? null,
        data,
        recent: basis.recent,
        ontgrendeld: [],
      });
    } catch (e) {
      this.zet({ fase: "fout", laadFout: e instanceof Error ? e.message : String(e) });
    }
  }

  async kiesPeriode(id: string): Promise<void> {
    this.zet({ periodeId: id });
    if (this.staat.data[id]) return;
    this.zet({ periodeLaden: true });
    try {
      const d = await this.backend.laadPeriode(id);
      this.zet({ data: { ...this.staat.data, [id]: d }, periodeLaden: false });
    } catch (e) {
      this.zet({
        periodeLaden: false,
        periodeId: this.lopende?.id ?? null,
        opslag: {
          ...this.staat.opslag,
          fout: `Periode ophalen lukte niet: ${e instanceof Error ? e.message : String(e)}`,
        },
      });
    }
  }

  ontgrendel(periodeId: string): void {
    this.zet({ ontgrendeld: [...this.staat.ontgrendeld, periodeId] });
  }

  opnieuwOpslaan = (): void => this.wachtrij.opnieuw();

  // --- instellingen --------------------------------------------------------

  /** Bewaart de instellingen; ze gelden ook meteen voor de lopende periode. */
  bewaarInstellingen(nieuw: Omit<Instellingen, "winkels">): void {
    const instellingen: Instellingen = { ...nieuw, winkels: this.staat.instellingen.winkels };
    this.zet({ instellingen });
    this.bewaar((b) => b.bewaarInstellingen(instellingen));
    this.werkLopendeBij(instellingen);
  }

  private werkLopendeBij(i: Instellingen): void {
    const lopende = this.lopende;
    if (!lopende) return;
    const periode: Periode = {
      ...lopende,
      salaris: i.salaris,
      verdeling: i.verdeling,
      weekStartDag: i.weekStartDag,
    };
    this.zet({ periodes: this.staat.periodes.map((p) => (p.id === periode.id ? periode : p)) });
    this.bewaar((b) => b.bewaarPeriode(periode));
  }

  // --- periodes ------------------------------------------------------------

  /**
   * Het saldo van de lopende periode op dit moment: het voorstel voor het
   * startsaldo van de volgende periode. Zonder periode is het 0.
   */
  eindsaldoLopende(): Centen {
    const lopende = this.lopende;
    if (!lopende) return 0;
    const d = this.staat.data[lopende.id] ?? LEEG;
    return berekenSaldo(lopende, d.regels, d.uitgaven).saldo;
  }

  /** Past het startsaldo van een periode aan (het saldo in de kop rekent ermee). */
  wijzigStartsaldo(periodeId: string, startsaldo: Centen): void {
    const oud = this.staat.periodes.find((p) => p.id === periodeId);
    if (!oud || oud.startsaldo === startsaldo) return;
    const periode: Periode = { ...oud, startsaldo };
    this.zet({ periodes: this.staat.periodes.map((p) => (p.id === periodeId ? periode : p)) });
    this.bewaar((b) => b.bewaarPeriode(periode));
  }

  /**
   * Start een nieuwe periode. Zonder `startsaldo` begint hij op het eindsaldo
   * van de vorige periode (of op 0 als die er niet is). Geeft een foutmelding
   * terug, of null als het gelukt is.
   */
  startPeriode(
    startdatum: ISODatum,
    volgendeSalarisdatum: ISODatum,
    startsaldo: Centen = this.eindsaldoLopende(),
  ): string | null {
    const vorige = this.lopende;
    if (volgendeSalarisdatum <= startdatum) {
      return "De volgende salarisdatum moet na de startdatum liggen.";
    }
    if (vorige && startdatum <= vorige.startdatum) {
      return "De startdatum moet na de start van de lopende periode liggen.";
    }
    const i = this.staat.instellingen;
    const periode: Periode = {
      id: nieuwId(),
      startdatum,
      einddatum: plusDagen(volgendeSalarisdatum, -1),
      salaris: i.salaris,
      verdeling: i.verdeling,
      weekStartDag: i.weekStartDag,
      startsaldo,
    };
    const vorigeRegels = vorige ? (this.staat.data[vorige.id]?.regels ?? []) : [];
    const { regels, gewijzigd } = bouwNieuwePeriode(
      this.staat.vasteLasten,
      vorigeRegels,
      periode.id,
      nieuwId,
    );

    // Kwam het salaris eerder dan verwacht, dan eindigt de vorige periode de
    // dag ervoor, zodat geen week in twee periodes meetelt.
    const ingekort =
      vorige && vorige.einddatum >= startdatum
        ? { ...vorige, einddatum: plusDagen(startdatum, -1) }
        : null;

    this.zet({
      periodes: [
        ...this.staat.periodes.map((p) => (ingekort && p.id === ingekort.id ? ingekort : p)),
        periode,
      ],
      periodeId: periode.id,
      vasteLasten: this.staat.vasteLasten.map((v) => gewijzigd.find((g) => g.id === v.id) ?? v),
      data: { ...this.staat.data, [periode.id]: { regels, uitgaven: [] } },
    });
    this.bewaar(async (b) => {
      if (ingekort) await b.bewaarPeriode(ingekort);
      await b.bewaarPeriode(periode);
      await b.bewaarRegels(regels);
      await b.bewaarVasteLasten(gewijzigd);
    });
    return null;
  }

  // --- uitgaven ------------------------------------------------------------

  voegUitgaveToe(periodeId: string, invoer: UitgaveInvoer): void {
    const uitgave: Uitgave = {
      ...invoer,
      id: nieuwId(),
      periodeId,
      aangemaaktOp: new Date().toISOString(),
    };
    this.zetData(periodeId, (d) => ({ ...d, uitgaven: [...d.uitgaven, uitgave] }));
    this.zet({
      recent: [{ omschrijving: uitgave.omschrijving, pot: uitgave.pot }, ...this.staat.recent],
    });
    this.bewaar((b) => b.bewaarUitgave(uitgave));
  }

  wijzigUitgave(uitgave: Uitgave): void {
    this.zetData(uitgave.periodeId, (d) => ({
      ...d,
      uitgaven: d.uitgaven.map((u) => (u.id === uitgave.id ? uitgave : u)),
    }));
    this.bewaar((b) => b.bewaarUitgave(uitgave));
  }

  verwijderUitgave(uitgave: Uitgave): void {
    this.zetData(uitgave.periodeId, (d) => ({
      ...d,
      uitgaven: d.uitgaven.filter((u) => u.id !== uitgave.id),
    }));
    this.bewaar((b) => b.verwijderUitgave(uitgave.id));
  }

  /**
   * Aankoop in termijnen: maakt een termijnpost in de pot Persoonlijk. De
   * eerste termijn telt in de lopende periode mee en staat meteen op betaald.
   */
  voegTermijnAankoopToe(omschrijving: string, bedragPerTermijn: Centen, aantal: number): void {
    this.voegVasteLastToe(
      {
        naam: omschrijving,
        standaardBedrag: bedragPerTermijn,
        pot: "persoonlijk",
        termijnHuidig: 1,
        termijnTotaal: aantal,
      },
      true,
    );
  }

  // --- vaste lasten --------------------------------------------------------

  private volgendeVolgorde(): number {
    return this.staat.vasteLasten.reduce((m, v) => Math.max(m, v.volgorde), -1) + 1;
  }

  private regelVoor(v: VasteLast, periodeId: string, betaald = false): PeriodeRegel {
    return {
      id: nieuwId(),
      periodeId,
      vasteLastId: v.id,
      naam: v.naam,
      pot: v.pot,
      bedrag: v.standaardBedrag,
      betaald,
      termijnNr: v.termijnHuidig,
      termijnTotaal: v.termijnTotaal,
      volgorde: v.volgorde,
    };
  }

  /** Nieuwe vaste last; komt ook meteen in de lopende periode te staan. */
  voegVasteLastToe(invoer: VasteLastInvoer, betaald = false): void {
    const last: VasteLast = {
      ...invoer,
      id: nieuwId(),
      actief: true,
      volgorde: this.volgendeVolgorde(),
    };
    this.zet({ vasteLasten: [...this.staat.vasteLasten, last] });
    const lopende = this.lopende;
    const regel = lopende ? this.regelVoor(last, lopende.id, betaald) : null;
    if (regel) this.zetData(regel.periodeId, (d) => ({ ...d, regels: [...d.regels, regel] }));
    this.bewaar(async (b) => {
      await b.bewaarVasteLasten([last]);
      if (regel) await b.bewaarRegels([regel]);
    });
  }

  /** Past de standaardpost aan, en de regel in de lopende periode. */
  wijzigVasteLast(id: string, invoer: VasteLastInvoer): void {
    const oud = this.staat.vasteLasten.find((v) => v.id === id);
    if (!oud) return;
    const last: VasteLast = { ...oud, ...invoer };
    this.zet({ vasteLasten: this.staat.vasteLasten.map((v) => (v.id === id ? last : v)) });

    const lopende = this.lopende;
    const oudeRegel = lopende
      ? this.staat.data[lopende.id]?.regels.find((r) => r.vasteLastId === id)
      : undefined;
    const regel: PeriodeRegel | null = oudeRegel
      ? {
          ...oudeRegel,
          naam: last.naam,
          pot: last.pot,
          termijnNr: last.termijnHuidig,
          termijnTotaal: last.termijnTotaal,
          // Een bedrag dat deze periode al afweek, blijft afwijken.
          bedrag:
            oudeRegel.bedrag === oud.standaardBedrag ? last.standaardBedrag : oudeRegel.bedrag,
        }
      : null;
    if (regel) {
      this.zetData(regel.periodeId, (d) => ({
        ...d,
        regels: d.regels.map((r) => (r.id === regel.id ? regel : r)),
      }));
    }
    this.bewaar(async (b) => {
      await b.bewaarVasteLasten([last]);
      if (regel) await b.bewaarRegels([regel]);
    });
  }

  /** Verwijdert de standaardpost en de regel in de lopende periode. Oudere periodes blijven staan. */
  verwijderVasteLast(id: string): void {
    this.zet({ vasteLasten: this.staat.vasteLasten.filter((v) => v.id !== id) });
    const lopende = this.lopende;
    const regel = lopende
      ? this.staat.data[lopende.id]?.regels.find((r) => r.vasteLastId === id)
      : undefined;
    if (regel) {
      this.zetData(regel.periodeId, (d) => ({
        ...d,
        regels: d.regels.filter((r) => r.id !== regel.id),
      }));
    }
    this.bewaar(async (b) => {
      if (regel) await b.verwijderRegels([regel.id]);
      await b.verwijderVasteLasten([id]);
    });
  }

  /** Vinkje of bedrag van één regel in één periode. */
  wijzigRegel(regel: PeriodeRegel): void {
    this.zetData(regel.periodeId, (d) => ({
      ...d,
      regels: d.regels.map((r) => (r.id === regel.id ? regel : r)),
    }));
    this.bewaar((b) => b.bewaarRegels([regel]));
  }

  // --- import en export ----------------------------------------------------

  /**
   * Importeert startdata. Zonder `vervangen` is de import idempotent: vaste
   * lasten met dezelfde naam en pot worden bijgewerkt, nieuwe toegevoegd, en
   * de rest blijft staan. Met `vervangen` gaan eerst alle bestaande vaste
   * lasten weg (ook uit de lopende periode; oudere periodes blijven staan).
   */
  importeer(start: Startdata, vervangen: boolean): void {
    const lopende = this.lopende;
    const oudeRegels = lopende ? (this.staat.data[lopende.id]?.regels ?? []) : [];
    const oudeLasten = this.staat.vasteLasten;

    const instellingen: Instellingen = {
      ...start.instellingen,
      winkels: vervangen
        ? start.winkels
        : [...new Set([...this.staat.instellingen.winkels, ...start.winkels])],
    };

    const bestaand = new Map(
      vervangen ? [] : oudeLasten.filter((v) => v.actief).map((v) => [importSleutel(v), v]),
    );
    let volgorde = vervangen ? 0 : this.volgendeVolgorde();
    const lasten: VasteLast[] = [];
    const regels: PeriodeRegel[] = [];
    const gezien = new Set<string>();

    for (const s of start.vasteLasten) {
      const sleutel = importSleutel(s);
      if (gezien.has(sleutel)) continue;
      gezien.add(sleutel);
      const oud = bestaand.get(sleutel);
      const last: VasteLast = {
        id: oud?.id ?? nieuwId(),
        naam: s.naam,
        standaardBedrag: s.bedrag,
        pot: s.pot,
        termijnHuidig: s.termijn?.huidig ?? null,
        termijnTotaal: s.termijn?.totaal ?? null,
        actief: true,
        volgorde: oud?.volgorde ?? volgorde++,
      };
      lasten.push(last);
      if (!lopende) continue;
      const oudeRegel = oud && oudeRegels.find((r) => r.vasteLastId === oud.id);
      regels.push(
        oudeRegel
          ? {
              ...oudeRegel,
              naam: last.naam,
              termijnNr: last.termijnHuidig,
              termijnTotaal: last.termijnTotaal,
              bedrag:
                oudeRegel.bedrag === oud.standaardBedrag ? last.standaardBedrag : oudeRegel.bedrag,
            }
          : this.regelVoor(last, lopende.id),
      );
    }

    const wegLasten = vervangen ? oudeLasten.map((v) => v.id) : [];
    const wegRegels = vervangen ? oudeRegels.map((r) => r.id) : [];
    const nieuweIds = new Set(lasten.map((l) => l.id));
    const regelIds = new Set(regels.map((r) => r.id));

    this.zet({
      instellingen,
      vasteLasten: [
        ...(vervangen ? [] : oudeLasten.filter((v) => !nieuweIds.has(v.id))),
        ...lasten,
      ].sort((a, b) => a.volgorde - b.volgorde),
    });
    if (lopende) {
      this.zetData(lopende.id, (d) => ({
        ...d,
        regels: [
          ...(vervangen ? [] : d.regels.filter((r) => !regelIds.has(r.id))),
          ...regels,
        ].sort((a, b) => a.volgorde - b.volgorde),
      }));
    }
    this.bewaar(async (b) => {
      await b.bewaarInstellingen(instellingen);
      await b.verwijderRegels(wegRegels);
      await b.verwijderVasteLasten(wegLasten);
      await b.bewaarVasteLasten(lasten);
      await b.bewaarRegels(regels);
    });
    this.werkLopendeBij(instellingen);
  }

  /** Alles als JSON: het importformaat, aangevuld met de periodes als back-up. */
  async exporteer(): Promise<unknown> {
    const s = this.staat;
    const periodes = [];
    for (const p of s.periodes) {
      const d = s.data[p.id] ?? (await this.backend.laadPeriode(p.id));
      periodes.push({
        startdatum: p.startdatum,
        einddatum: p.einddatum,
        startsaldo: naarEuro(p.startsaldo),
        salaris: naarEuro(p.salaris),
        verdeling: p.verdeling,
        weekStartDag: WEEKDAGEN[p.weekStartDag],
        vasteLasten: d.regels.map((r) => ({
          naam: r.naam,
          bedrag: naarEuro(r.bedrag),
          pot: r.pot,
          betaald: r.betaald,
          ...(r.termijnNr != null && r.termijnTotaal != null
            ? { termijn: { huidig: r.termijnNr, totaal: r.termijnTotaal } }
            : {}),
        })),
        uitgaven: d.uitgaven.map((u) => ({
          datum: u.datum,
          bedrag: naarEuro(u.bedrag),
          omschrijving: u.omschrijving,
          pot: u.pot,
        })),
      });
    }
    return {
      versie: 1,
      geexporteerdOp: new Date().toISOString(),
      instellingen: {
        salaris: naarEuro(s.instellingen.salaris),
        verdeling: s.instellingen.verdeling,
        weekStartDag: WEEKDAGEN[s.instellingen.weekStartDag],
      },
      vasteLasten: s.vasteLasten
        .filter((v) => v.actief)
        .map((v) => ({
          naam: v.naam,
          bedrag: naarEuro(v.standaardBedrag),
          pot: v.pot,
          ...(v.termijnHuidig != null && v.termijnTotaal != null
            ? { termijn: { huidig: v.termijnHuidig, totaal: v.termijnTotaal } }
            : {}),
        })),
      winkels: s.instellingen.winkels,
      periodes,
    };
  }
}
