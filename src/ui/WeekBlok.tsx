import { useMemo, useState, type ReactNode } from "react";
import { formatKort, formatMetDag } from "../logica/datum";
import { formatEuro } from "../logica/geld";
import { groepeerUitgaven } from "../logica/groepen";
import type { Uitgave, WeekOverzicht } from "../logica/overzicht";
import type { WeekPot } from "../logica/potten";
import { Blad } from "./Blad";
import { UitgaveFormulier } from "./UitgaveFormulier";

const POTNAAM = { vast: "Vaste lasten", persoonlijk: "Persoonlijk", extra: "Extra" } as const;

const metTeken = (c: number) => (c > 0 ? `+${formatEuro(c)}` : formatEuro(c));

/** Lijst met uitgaven (scherm Extra); tik op een regel om hem te bewerken. */
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

/**
 * De uitgaven van een week, in de kolommen Vaste lasten en Persoonlijk.
 * Uitgaven met dezelfde naam in dezelfde pot staan op één regel; tik erop om
 * de losse uitgaven te zien. De pot Extra staat hier niet (zie scherm Extra).
 */
function WeekUitgaven({ uitgaven, bewerkbaar }: { uitgaven: Uitgave[]; bewerkbaar: boolean }) {
  const groepen = useMemo(() => groepeerUitgaven(uitgaven), [uitgaven]);
  const [open, setOpen] = useState<string[]>([]);
  const [bewerk, setBewerk] = useState<Uitgave | null>(null);

  /** Het bedrag in de kolom van zijn pot; de andere kolom blijft leeg. */
  const kolommen = (pot: WeekPot, bedrag: number) => {
    const cel = (
      <span className={bedrag < 0 ? "hb-urij-bedrag hb-groen" : "hb-urij-bedrag"}>
        {formatEuro(bedrag)}
      </span>
    );
    return pot === "vast" ? (
      <>
        {cel}
        <span />
      </>
    ) : (
      <>
        <span />
        {cel}
      </>
    );
  };

  /** Een losse uitgave: tik om te bewerken. */
  const los = (u: Uitgave, pot: WeekPot, inhoud: ReactNode, sub = false) => {
    const klasse = sub ? "hb-urij hb-urij-sub" : "hb-urij";
    return bewerkbaar ? (
      <button
        className={`${klasse} hb-urij-knop`}
        onClick={() => setBewerk(u)}
        aria-label={`${u.omschrijving}, ${formatMetDag(u.datum)}, ${formatEuro(u.bedrag)}: bewerken`}
      >
        {inhoud}
        {kolommen(pot, u.bedrag)}
      </button>
    ) : (
      <div className={klasse}>
        {inhoud}
        {kolommen(pot, u.bedrag)}
      </div>
    );
  };

  return (
    <>
      <ul className="hb-lijst">
        {groepen.length === 0 && <li className="hb-leeg">Nog niks ingevuld deze week.</li>}
        {groepen.map((g) => {
          const eerste = g.uitgaven[0]!;
          if (g.uitgaven.length === 1) {
            return (
              <li key={g.sleutel}>
                {los(
                  eerste,
                  g.pot,
                  <span className="hb-urij-naam">
                    <span className="hb-urij-tekst">{g.naam}</span>
                    <small>{formatMetDag(eerste.datum)}</small>
                  </span>,
                )}
              </li>
            );
          }
          const laatste = g.uitgaven.at(-1)!;
          const isOpen = open.includes(g.sleutel);
          return (
            <li key={g.sleutel}>
              <button
                className="hb-urij hb-urij-knop"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpen(isOpen ? open.filter((k) => k !== g.sleutel) : [...open, g.sleutel])
                }
              >
                <span className="hb-urij-naam">
                  <span className="hb-urij-titel">
                    <span className="hb-urij-tekst">{g.naam}</span>
                    <span className="hb-urij-aantal">({g.uitgaven.length}×)</span>
                  </span>
                  <small>
                    {eerste.datum === laatste.datum
                      ? formatMetDag(eerste.datum)
                      : `${formatKort(eerste.datum)} – ${formatKort(laatste.datum)}`}
                  </small>
                </span>
                {kolommen(g.pot, g.totaal)}
              </button>
              {isOpen && (
                <ul className="hb-sublijst">
                  {g.uitgaven.map((u) => (
                    <li key={u.id}>
                      {los(u, g.pot, <span className="hb-urij-naam">{formatMetDag(u.datum)}</span>, true)}
                    </li>
                  ))}
                </ul>
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

/**
 * Eén weekblok. De kop toont per pot wat de week van haar eigen weekbedrag
 * over heeft (zonder doorschuiven); opengeklapt staat de hele uitsplitsing.
 */
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
        <span className={vast.eigenOver < 0 ? "hb-rood" : ""}>{formatEuro(vast.eigenOver)}</span>
        <span className={persoonlijk.eigenOver < 0 ? "hb-rood" : ""}>
          {formatEuro(persoonlijk.eigenOver)}
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
          <WeekUitgaven uitgaven={week.uitgaven} bewerkbaar={bewerkbaar} />
          {children}
        </div>
      )}
    </section>
  );
}
