import type { SupabaseClient } from "@supabase/supabase-js";
import { naarCenten, naarEuro } from "../logica/geld";
import type { Periode, Uitgave } from "../logica/overzicht";
import type { Pot, WeekPot } from "../logica/potten";
import type { PeriodeRegel, VasteLast } from "../logica/termijnen";
import type { Backend, Basis, Instellingen, PeriodeData } from "./backend";

// Rijen zoals ze in de database staan. Bedragen zijn numeric (euro's) en
// worden hier omgezet naar centen. user_id sturen we nooit mee: de database
// vult auth.uid() in en RLS controleert het.

interface InstellingenRij {
  salaris: number;
  perc_vast: number;
  perc_persoonlijk: number;
  perc_extra: number;
  week_startdag: number;
  winkels: string[];
}

interface VasteLastRij {
  id: string;
  naam: string;
  standaard_bedrag: number;
  pot: WeekPot;
  termijn_huidig: number | null;
  termijn_totaal: number | null;
  actief: boolean;
  volgorde: number;
}

export interface PeriodeRij {
  id: string;
  startdatum: string;
  einddatum: string;
  salaris: number;
  perc_vast: number;
  perc_persoonlijk: number;
  perc_extra: number;
  week_startdag: number;
  /** Ontbreekt zolang de migratie met de kolom nog niet gedraaid is. */
  startsaldo?: number | null;
}

interface RegelRij {
  id: string;
  periode_id: string;
  vaste_last_id: string | null;
  naam: string;
  pot: WeekPot;
  bedrag: number;
  betaald: boolean;
  termijn_nr: number | null;
  termijn_totaal: number | null;
  volgorde: number;
}

interface UitgaveRij {
  id: string;
  periode_id: string;
  datum: string;
  bedrag: number;
  omschrijving: string;
  pot: Pot;
  aangemaakt_op: string;
}

const vasteLastVanRij = (r: VasteLastRij): VasteLast => ({
  id: r.id,
  naam: r.naam,
  standaardBedrag: naarCenten(Number(r.standaard_bedrag)),
  pot: r.pot,
  termijnHuidig: r.termijn_huidig,
  termijnTotaal: r.termijn_totaal,
  actief: r.actief,
  volgorde: r.volgorde,
});

const vasteLastNaarRij = (v: VasteLast): VasteLastRij => ({
  id: v.id,
  naam: v.naam,
  standaard_bedrag: naarEuro(v.standaardBedrag),
  pot: v.pot,
  termijn_huidig: v.termijnHuidig,
  termijn_totaal: v.termijnTotaal,
  actief: v.actief,
  volgorde: v.volgorde,
});

export const periodeVanRij = (r: PeriodeRij): Periode => ({
  id: r.id,
  startdatum: r.startdatum,
  einddatum: r.einddatum,
  salaris: naarCenten(Number(r.salaris)),
  verdeling: { vast: r.perc_vast, persoonlijk: r.perc_persoonlijk, extra: r.perc_extra },
  weekStartDag: r.week_startdag,
  startsaldo: naarCenten(Number(r.startsaldo ?? 0)),
});

export const periodeNaarRij = (p: Periode): PeriodeRij => ({
  id: p.id,
  startdatum: p.startdatum,
  einddatum: p.einddatum,
  salaris: naarEuro(p.salaris),
  perc_vast: p.verdeling.vast,
  perc_persoonlijk: p.verdeling.persoonlijk,
  perc_extra: p.verdeling.extra,
  week_startdag: p.weekStartDag,
  startsaldo: naarEuro(p.startsaldo),
});

const regelVanRij = (r: RegelRij): PeriodeRegel => ({
  id: r.id,
  periodeId: r.periode_id,
  vasteLastId: r.vaste_last_id,
  naam: r.naam,
  pot: r.pot,
  bedrag: naarCenten(Number(r.bedrag)),
  betaald: r.betaald,
  termijnNr: r.termijn_nr,
  termijnTotaal: r.termijn_totaal,
  volgorde: r.volgorde,
});

const regelNaarRij = (r: PeriodeRegel): RegelRij => ({
  id: r.id,
  periode_id: r.periodeId,
  vaste_last_id: r.vasteLastId,
  naam: r.naam,
  pot: r.pot,
  bedrag: naarEuro(r.bedrag),
  betaald: r.betaald,
  termijn_nr: r.termijnNr,
  termijn_totaal: r.termijnTotaal,
  volgorde: r.volgorde,
});

const uitgaveVanRij = (r: UitgaveRij): Uitgave => ({
  id: r.id,
  periodeId: r.periode_id,
  datum: r.datum,
  bedrag: naarCenten(Number(r.bedrag)),
  omschrijving: r.omschrijving,
  pot: r.pot,
  aangemaaktOp: r.aangemaakt_op,
});

const uitgaveNaarRij = (u: Uitgave): UitgaveRij => ({
  id: u.id,
  periode_id: u.periodeId,
  datum: u.datum,
  bedrag: naarEuro(u.bedrag),
  omschrijving: u.omschrijving,
  pot: u.pot,
  aangemaakt_op: u.aangemaaktOp,
});

/** Gooit de fout van Supabase door, zodat de wachtrij hem kan opvangen. */
function controleer<T>(antwoord: { data: T; error: { message: string } | null }): T {
  if (antwoord.error) throw new Error(antwoord.error.message);
  return antwoord.data;
}

export function maakSupabaseBackend(sb: SupabaseClient): Backend {
  return {
    async laadBasis(): Promise<Basis> {
      const [inst, lasten, periodes, recent] = await Promise.all([
        sb.from("hb_instellingen").select("*").maybeSingle(),
        sb.from("hb_vaste_lasten").select("*").order("volgorde"),
        sb.from("hb_periodes").select("*").order("startdatum"),
        sb
          .from("hb_uitgaven")
          .select("omschrijving, pot")
          .order("aangemaakt_op", { ascending: false })
          .limit(400),
      ]);
      const i = controleer(inst) as InstellingenRij | null;
      return {
        instellingen: i && {
          salaris: naarCenten(Number(i.salaris)),
          verdeling: { vast: i.perc_vast, persoonlijk: i.perc_persoonlijk, extra: i.perc_extra },
          weekStartDag: i.week_startdag,
          winkels: i.winkels ?? [],
        },
        vasteLasten: (controleer(lasten) as VasteLastRij[]).map(vasteLastVanRij),
        periodes: (controleer(periodes) as PeriodeRij[]).map(periodeVanRij),
        recent: controleer(recent) as { omschrijving: string; pot: Pot }[],
      };
    },

    async laadPeriode(periodeId): Promise<PeriodeData> {
      const [regels, uitgaven] = await Promise.all([
        sb.from("hb_periode_vaste_lasten").select("*").eq("periode_id", periodeId).order("volgorde"),
        sb.from("hb_uitgaven").select("*").eq("periode_id", periodeId).order("datum"),
      ]);
      return {
        regels: (controleer(regels) as RegelRij[]).map(regelVanRij),
        uitgaven: (controleer(uitgaven) as UitgaveRij[]).map(uitgaveVanRij),
      };
    },

    async bewaarInstellingen(i: Instellingen) {
      const rij: InstellingenRij & { bijgewerkt_op: string } = {
        salaris: naarEuro(i.salaris),
        perc_vast: i.verdeling.vast,
        perc_persoonlijk: i.verdeling.persoonlijk,
        perc_extra: i.verdeling.extra,
        week_startdag: i.weekStartDag,
        winkels: i.winkels,
        bijgewerkt_op: new Date().toISOString(),
      };
      controleer(await sb.from("hb_instellingen").upsert(rij, { onConflict: "user_id" }));
    },

    async bewaarVasteLasten(lasten) {
      if (lasten.length === 0) return;
      controleer(await sb.from("hb_vaste_lasten").upsert(lasten.map(vasteLastNaarRij)));
    },

    async verwijderVasteLasten(ids) {
      if (ids.length === 0) return;
      controleer(await sb.from("hb_vaste_lasten").delete().in("id", ids));
    },

    async bewaarPeriode(p) {
      controleer(await sb.from("hb_periodes").upsert(periodeNaarRij(p)));
    },

    async bewaarRegels(regels) {
      if (regels.length === 0) return;
      controleer(await sb.from("hb_periode_vaste_lasten").upsert(regels.map(regelNaarRij)));
    },

    async verwijderRegels(ids) {
      if (ids.length === 0) return;
      controleer(await sb.from("hb_periode_vaste_lasten").delete().in("id", ids));
    },

    async bewaarUitgave(u) {
      controleer(await sb.from("hb_uitgaven").upsert(uitgaveNaarRij(u)));
    },

    async verwijderUitgave(id) {
      controleer(await sb.from("hb_uitgaven").delete().eq("id", id));
    },
  };
}
