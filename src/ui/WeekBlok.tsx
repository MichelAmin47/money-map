import { useState, type ReactNode } from "react";
import { formatMetDag } from "../logica/datum";
import { formatEuro } from "../logica/geld";
import type { Uitgave, WeekOverzicht } from "../logica/overzicht";
import { Blad } from "./Blad";
import { UitgaveFormulier } from "./UitgaveFormulier";

const POTNAAM = { vast: "Vaste lasten", persoonlijk: "Persoonlijk", extra: "Extra" } as const;

const metTeken = (c: number) => (c > 0 ? `+${formatEuro(c)}` : formatEuro(c));

/** Lijst met uitgaven; tik op een regel om hem te bewerken. */
export function UitgavenLijst({
  uitgaven,
  bewerkbaar,
  leeg,
}: {
  uitgaven: Uitgave[];
  bewerkbaar: boolean;
  leeg: string;
}) {
  const [bewerk, setBewerk] = useState<Uitgave | null>(null);
  return (
    <>
      <ul className="hb-lijst">
        {uitgaven.length === 0 && <li className="hb-leeg">{leeg}</li>}
        {uitgaven.map((u) => {
          const inhoud = (
            <>
              <span className={`hb-dot hb-dot-${u.pot}`} title={POTNAAM[u.pot]} />
              <span className="hb-regel-naam">
                {u.omschrijving}
                <small>
                  {formatMetDag(u.datum)} · {POTNAAM[u.pot]}
                  {u.bedrag < 0 && " · ontvangen"}
                </small>
              </span>
              <span className={u.bedrag < 0 ? "hb-regel-bedrag hb-groen" : "hb-regel-bedrag"}>
                {formatEuro(u.bedrag)}
              </span>
            </>
          );
          return (
            <li key={u.id}>
              {bewerkbaar ? (
                <button
                  className="hb-regel hb-regel-knop"
                  onClick={() => setBewerk(u)}
                  aria-label={`${u.omschrijving}, ${formatEuro(u.bedrag)}: bewerken`}
                >
                  {inhoud}
                </button>
              ) : (
                <div className="hb-regel">{inhoud}</div>
              )}
            </li>
          );
        })}
      </ul>
      {bewerk && (
        <Blad titel="Uitgave bewerken" onSluit={() => setBewerk(null)}>
          <UitgaveFormulier
            periodeId={bewerk.periodeId}
            standaardDatum={bewerk.datum}
            bestaande={bewerk}
            onKlaar={() => setBewerk(null)}
          />
        </Blad>
      )}
    </>
  );
}

/** Eén weekblok: kop met "beschikbaar" per pot, uitklapbaar naar de details. */
export function WeekBlok({
  week,
  open,
  onToggle,
  isNu,
  bewerkbaar,
  children,
}: {
  week: WeekOverzicht;
  open: boolean;
  /** Zonder onToggle staat het blok altijd open (scherm Vandaag). */
  onToggle?: () => void;
  isNu: boolean;
  bewerkbaar: boolean;
  children?: ReactNode;
}) {
  const { blok, vast, persoonlijk } = week;
  const kop = (
    <>
      <span className="hb-week-label">
        <span className="hb-week-nr">Week {blok.nr}</span>
        <span>{blok.label}</span>
        {isNu && <span className="hb-nu">deze week</span>}
      </span>
      <span className="hb-week-cijfers">
        <span className={vast.beschikbaar < 0 ? "hb-rood" : ""}>{formatEuro(vast.beschikbaar)}</span>
        <span className={persoonlijk.beschikbaar < 0 ? "hb-rood" : ""}>
          {formatEuro(persoonlijk.beschikbaar)}
        </span>
      </span>
    </>
  );
  const rij = (label: string, a: number, b: number, opties: { teken?: boolean; sterk?: boolean } = {}) => (
    <tr className={opties.sterk ? "hb-sterk" : undefined}>
      <th scope="row">{label}</th>
      <td className={a < 0 ? "hb-rood" : ""}>{opties.teken ? metTeken(a) : formatEuro(a)}</td>
      <td className={b < 0 ? "hb-rood" : ""}>{opties.teken ? metTeken(b) : formatEuro(b)}</td>
    </tr>
  );

  return (
    <section className={open ? "hb-week hb-week-open" : "hb-week"}>
      {onToggle ? (
        <button className="hb-week-kop" onClick={onToggle} aria-expanded={open}>
          {kop}
        </button>
      ) : (
        <div className="hb-week-kop">{kop}</div>
      )}
      {open && (
        <div className="hb-week-body">
          <table className="hb-weektabel">
            <thead>
              <tr>
                <td />
                <th scope="col">Vaste lasten</th>
                <th scope="col">Persoonlijk</th>
              </tr>
            </thead>
            <tbody>
              {rij("Weekbedrag", vast.basis, persoonlijk.basis)}
              {rij("Doorgeschoven", vast.doorgeschoven, persoonlijk.doorgeschoven, { teken: true })}
              {rij("Beschikbaar", vast.beschikbaar, persoonlijk.beschikbaar, { sterk: true })}
              {rij("Uitgegeven", vast.uitgegeven, persoonlijk.uitgegeven)}
              {rij("Nog over", vast.over, persoonlijk.over, { sterk: true })}
            </tbody>
          </table>
          <UitgavenLijst
            uitgaven={week.uitgaven}
            bewerkbaar={bewerkbaar}
            leeg="Nog niks ingevuld deze week."
          />
          {children}
        </div>
      )}
    </section>
  );
}
