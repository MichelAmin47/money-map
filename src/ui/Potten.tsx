import { formatEuro } from "../logica/geld";
import type { Overzicht } from "../logica/overzicht";

function Pot({
  titel,
  over,
  van,
  onder,
}: {
  titel: string;
  over: number;
  van: number;
  onder: string;
}) {
  const negatief = over < 0;
  const perc = van > 0 ? Math.max(0, Math.min(100, (over / van) * 100)) : 0;
  return (
    <div className="hb-pot">
      <div className="hb-pot-titel">{titel}</div>
      <div className={negatief ? "hb-pot-bedrag hb-rood" : "hb-pot-bedrag"}>{formatEuro(over)}</div>
      <div className="hb-balk" aria-hidden="true">
        <div
          className={negatief ? "hb-balk-vul hb-balk-rood" : "hb-balk-vul"}
          style={{ width: `${negatief ? 100 : perc}%` }}
        />
      </div>
      <div className="hb-pot-sub">{onder}</div>
    </div>
  );
}

/** De drie potten met wat er nog over is. */
export function Potten({ o }: { o: Overzicht }) {
  return (
    <div className="hb-potten">
      <Pot
        titel="Vaste lasten"
        over={o.vast.over}
        van={o.vast.weekpot}
        onder={`van ${formatEuro(o.vast.weekpot)}`}
      />
      <Pot
        titel="Persoonlijk"
        over={o.persoonlijk.over}
        van={o.persoonlijk.weekpot}
        onder={`van ${formatEuro(o.persoonlijk.weekpot)}`}
      />
      <Pot
        titel="Extra"
        over={o.extra.over}
        van={o.extra.budget}
        onder={`van ${formatEuro(o.extra.budget)}`}
      />
    </div>
  );
}
