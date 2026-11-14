import { useMemo, useState, type ReactNode } from "react";
import { formatKort, formatMetDag } from "../logica/datum";
import { formatEuro, formatMetTeken } from "../logica/geld";
import { groepeerUitgaven } from "../logica/groepen";
import type { Uitgave, WeekOverzicht } from "../logica/overzicht";
import type { WeekPot } from "../logica/potten";
import { Blad } from "./Blad";
import { UitgaveFormulier } from "./UitgaveFormulier";

const POTNAAM = { vast: "Vaste lasten", persoonlijk: "Persoonlijk", extra: "Extra" } as const;

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
function WeekUitgaven({
  uitgaven,
  bewerkbaar,
  alleenLezen,
}: {
  uitgaven: Uitgave[];
  bewerkbaar: boolean;
  alleenLezen: boolean;
}) {
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
          const groep = (
            <>
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
            </>
          );
          if (alleenLezen) {
            return (
              <li key={g.sleutel}>
                <div className="hb-urij">{groep}</div>
              </li>
            );
          }
          return (
            <li key={g.sleutel}>
              <button
                className="hb-urij hb-urij-knop"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpen(isOpen ? open.filter((k) => k !== g.sleutel) : [...open, g.sleutel])
                }
              >
                {groep}
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
 * Wat er uit de vorige week is doorgeschoven, per kolom recht onder de
 * bedragen in de kop, met eronder wat er samen met het eigen weekbedrag over
 * is. Een kolom zonder doorgeschoven bedrag blijft leeg; zijn beide €0, dan
 * staat de regel er niet.
 */
function Doorgeschoven({ week }: { week: WeekOverzicht }) {
  const { vast, persoonlijk } = week;
  if (vast.doorgeschoven === 0 && persoonlijk.doorgeschoven === 0) return null;
  const cel = (stand: WeekOverzicht["vast"], naam: string) =>
    stand.doorgeschoven === 0 ? (
      <span />
    ) : (
      <span
        className="hb-door-cel"
        aria-label={`${naam}: ${formatMetTeken(stand.doorgeschoven)} doorgeschoven, samen ${formatEuro(stand.over)} over`}
      >
        <span className={stand.doorgeschoven < 0 ? "hb-rood" : ""}>
          {formatMetTeken(stand.doorgeschoven)}
        </span>
        <span className={stand.over < 0 ? "hb-rood" : ""}>{formatEuro(stand.over)}</span>
      </span>
    );
  return (
    <div className="hb-door">
      <span className="hb-door-label" aria-hidden="true">
        <span>doorgeschoven</span>
        <span>samen over</span>
      </span>
      {cel(vast, "Vaste lasten")}
      {cel(persoonlijk, "Persoonlijk")}
    </div>
  );
}

/**
 * Eén weekblok. De kop toont per pot wat de week van haar eigen weekbedrag
 * over heeft (zonder doorschuiven). Opengeklapt staan de kolomnamen boven die
 * bedragen, met eronder de doorgeschoven-regel en de uitgaven.
 */
export function WeekBlok({
  week,
  open,
  onToggle,
  isNu,
  bewerkbaar,
  alleenLezen = false,
  children,
}: {
  week: WeekOverzicht;
  open: boolean;
  /** Zonder onToggle staat het blok altijd open (Vandaag en Overzicht). */
  onToggle?: () => void;
  isNu: boolean;
  bewerkbaar: boolean;
  /** Scherm Overzicht: niets is aan te tikken. */
  alleenLezen?: boolean;
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
        {open && (
          <>
            <span className="hb-week-kolomnaam">Vaste lasten</span>
            <span className="hb-week-kolomnaam">Persoonlijk</span>
          </>
        )}
        <span className={vast.eigenOver < 0 ? "hb-rood" : ""}>{formatEuro(vast.eigenOver)}</span>
        <span className={persoonlijk.eigenOver < 0 ? "hb-rood" : ""}>
          {formatEuro(persoonlijk.eigenOver)}
        </span>
      </span>
    </>
  );

  const klassen = ["hb-week", open && "hb-week-open", alleenLezen && "hb-week-lees"]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={klassen}>
      {onToggle ? (
        <button className="hb-week-kop" onClick={onToggle} aria-expanded={open}>
          {kop}
        </button>
      ) : (
        <div className="hb-week-kop">{kop}</div>
      )}
      {open && (
        <div className="hb-week-body">
          <Doorgeschoven week={week} />
          <WeekUitgaven
            uitgaven={week.uitgaven}
            bewerkbaar={bewerkbaar && !alleenLezen}
            alleenLezen={alleenLezen}
          />
          {children}
        </div>
      )}
    </section>
  );
}
