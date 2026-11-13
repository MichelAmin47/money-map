import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { Boek, Staat } from "../data/boek";
import type { PeriodeData } from "../data/backend";
import { berekenOverzicht, topWinkels, type Overzicht, type Periode } from "../logica/overzicht";

export const BoekContext = createContext<Boek | null>(null);

export function useBoek(): Boek {
  const boek = useContext(BoekContext);
  if (!boek) throw new Error("BoekContext ontbreekt");
  return boek;
}

export function useStaat(): Staat {
  const boek = useBoek();
  return useSyncExternalStore(boek.abonneer, boek.momentopname);
}

export interface Beeld {
  /** De periode die in beeld is, of null als er nog geen periode is. */
  periode: Periode | null;
  data: PeriodeData;
  overzicht: Overzicht | null;
  /** In beeld is de lopende (laatst gestarte) periode. */
  isLopende: boolean;
  /** Uitgaven en vinkjes mogen aangepast worden. */
  bewerkbaar: boolean;
}

const LEEG: PeriodeData = { regels: [], uitgaven: [] };

/** De periode die in beeld is, met alle afgeleide cijfers. */
export function useBeeld(): Beeld {
  const s = useStaat();
  return useMemo(() => {
    const periode = s.periodes.find((p) => p.id === s.periodeId) ?? null;
    const data = (periode && s.data[periode.id]) || LEEG;
    const isLopende = periode != null && periode.id === s.periodes.at(-1)?.id;
    return {
      periode,
      data,
      overzicht: periode ? berekenOverzicht(periode, data.regels, data.uitgaven) : null,
      isLopende,
      bewerkbaar: periode != null && (isLopende || s.ontgrendeld.includes(periode.id)),
    };
  }, [s.periodes, s.periodeId, s.data, s.ontgrendeld]);
}

/**
 * Snelknoppen: de vaakst gebruikte omschrijvingen. Het scherm Extra krijgt zijn
 * eigen lijst, zodat eenmalige posten niet tussen de winkels komen te staan.
 */
export function useWinkels(extra: boolean) {
  const s = useStaat();
  return useMemo(
    () =>
      topWinkels(
        s.recent.filter((u) => (u.pot === "extra") === extra),
        extra ? [] : s.instellingen.winkels,
        6,
      ),
    [s.recent, s.instellingen.winkels, extra],
  );
}
