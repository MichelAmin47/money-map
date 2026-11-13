import { useEffect, useState } from "react";
import type { VasteLastInvoer } from "../../data/boek";
import { formatEuro, formatInvoer, parseBedrag } from "../../logica/geld";
import { som, type WeekPot } from "../../logica/potten";
import { termijnLabel, type PeriodeRegel, type VasteLast } from "../../logica/termijnen";
import { Blad } from "../Blad";
import { useBeeld, useBoek, useStaat } from "../context";

/**
 * Bedrag van een regel in deze periode. De invoer blijft een string en wordt
 * pas bij het verlaten van het veld geparset, zodat "12," te typen is.
 */
function RegelBedrag({
  regel,
  bewerkbaar,
  onWijzig,
}: {
  regel: { naam: string; bedrag: number };
  bewerkbaar: boolean;
  onWijzig: (centen: number) => void;
}) {
  const [tekst, setTekst] = useState(formatInvoer(regel.bedrag));
  useEffect(() => setTekst(formatInvoer(regel.bedrag)), [regel.bedrag]);

  if (!bewerkbaar) return <span className="hb-regel-bedrag">{formatEuro(regel.bedrag)}</span>;

  const leg = () => {
    const centen = parseBedrag(tekst);
    if (centen == null || centen < 0) setTekst(formatInvoer(regel.bedrag));
    else {
      setTekst(formatInvoer(centen));
      if (centen !== regel.bedrag) onWijzig(centen);
    }
  };
  return (
    <input
      className="hb-bedragveld"
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="done"
      aria-label={`Bedrag ${regel.naam} deze periode`}
      value={tekst}
      onChange={(e) => setTekst(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={leg}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

function PostFormulier({
  bestaande,
  standaardPot,
  onSluit,
}: {
  bestaande?: VasteLast;
  standaardPot: WeekPot;
  onSluit: () => void;
}) {
  const boek = useBoek();
  const [naam, setNaam] = useState(bestaande?.naam ?? "");
  const [bedrag, setBedrag] = useState(bestaande ? formatInvoer(bestaande.standaardBedrag) : "");
  const [pot, setPot] = useState<WeekPot>(bestaande?.pot ?? standaardPot);
  const [termijnen, setTermijnen] = useState(bestaande?.termijnTotaal != null);
  const [huidig, setHuidig] = useState(String(bestaande?.termijnHuidig ?? 1));
  const [totaal, setTotaal] = useState(String(bestaande?.termijnTotaal ?? ""));
  const [fout, setFout] = useState<string | null>(null);

  const bewaar = () => {
    const centen = parseBedrag(bedrag);
    if (!naam.trim()) return setFout("Vul een naam in.");
    if (centen == null || centen < 0) return setFout("Vul een bedrag in, bijvoorbeeld 12,50.");
    const h = Number.parseInt(huidig, 10);
    const t = Number.parseInt(totaal, 10);
    if (termijnen && !(h >= 1 && t >= h)) {
      return setFout("Vul de termijnen in, bijvoorbeeld 3 van 8.");
    }
    const invoer: VasteLastInvoer = {
      naam: naam.trim(),
      standaardBedrag: centen,
      pot,
      termijnHuidig: termijnen ? h : null,
      termijnTotaal: termijnen ? t : null,
    };
    if (bestaande) boek.wijzigVasteLast(bestaande.id, invoer);
    else boek.voegVasteLastToe(invoer);
    onSluit();
  };

  const verwijder = () => {
    if (!bestaande) return;
    if (
      window.confirm(
        `"${bestaande.naam}" verwijderen? De post verdwijnt uit deze en volgende periodes. Eerdere periodes blijven zoals ze waren.`,
      )
    ) {
      boek.verwijderVasteLast(bestaande.id);
      onSluit();
    }
  };

  return (
    <form
      className="hb-formulier"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        bewaar();
      }}
    >
      <label className="hb-veldlabel">
        <span>Naam</span>
        <input
          className="hb-veld"
          autoComplete="off"
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
        />
      </label>
      <label className="hb-veldlabel">
        <span>Standaardbedrag{termijnen ? " per termijn" : " per periode"}</span>
        <input
          className="hb-veld hb-veld-bedrag"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={bedrag}
          onChange={(e) => setBedrag(e.target.value)}
        />
      </label>
      <div className="hb-veldlabel">
        <span>Pot</span>
        <div className="hb-keuze" role="group" aria-label="Pot">
          {(
            [
              ["vast", "Vaste lasten"],
              ["persoonlijk", "Persoonlijk"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              aria-pressed={pot === k}
              className={pot === k ? "hb-keuze-knop hb-keuze-aan" : "hb-keuze-knop"}
              onClick={() => setPot(k)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <label className="hb-schakel">
        <input
          type="checkbox"
          checked={termijnen}
          onChange={(e) => setTermijnen(e.target.checked)}
        />
        <span>Heeft termijnen</span>
      </label>
      {termijnen && (
        <div className="hb-invoer-rij hb-termijnvelden">
          <label className="hb-veldlabel">
            <span>Termijn nu</span>
            <input
              className="hb-veld hb-veld-bedrag"
              inputMode="numeric"
              value={huidig}
              onChange={(e) => setHuidig(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <span className="hb-van">van</span>
          <label className="hb-veldlabel">
            <span>Totaal</span>
            <input
              className="hb-veld hb-veld-bedrag"
              inputMode="numeric"
              value={totaal}
              onChange={(e) => setTotaal(e.target.value.replace(/\D/g, ""))}
            />
          </label>
        </div>
      )}
      {fout && (
        <p className="hb-veldfout" role="alert">
          {fout}
        </p>
      )}
      <div className="hb-invoer-rij">
        {bestaande && (
          <button type="button" className="hb-knop hb-knop-gevaar" onClick={verwijder}>
            Verwijder
          </button>
        )}
        <button type="submit" className="hb-knop hb-knop-hoofd hb-groei">
          Bewaar
        </button>
      </div>
    </form>
  );
}

/** Een regel op het scherm: uit de periode, of (zonder periode) uit de standaardlijst. */
interface Post {
  sleutel: string;
  naam: string;
  pot: WeekPot;
  bedrag: number;
  termijnNr: number | null;
  termijnTotaal: number | null;
  regel: PeriodeRegel | null;
  vasteLast: VasteLast | null;
}

export function VasteLasten() {
  const boek = useBoek();
  const s = useStaat();
  const { periode, data, isLopende, bewerkbaar } = useBeeld();
  const [bewerk, setBewerk] = useState<VasteLast | null>(null);
  const [nieuw, setNieuw] = useState<WeekPot | null>(null);

  // Posten beheren kan in de lopende periode, of als er nog geen periode is.
  const beheer = !periode || isLopende;

  const posten: Post[] = periode
    ? data.regels.map((r) => ({
        sleutel: r.id,
        naam: r.naam,
        pot: r.pot,
        bedrag: r.bedrag,
        termijnNr: r.termijnNr,
        termijnTotaal: r.termijnTotaal,
        regel: r,
        vasteLast: s.vasteLasten.find((v) => v.id === r.vasteLastId) ?? null,
      }))
    : s.vasteLasten
        .filter((v) => v.actief)
        .map((v) => ({
          sleutel: v.id,
          naam: v.naam,
          pot: v.pot,
          bedrag: v.standaardBedrag,
          termijnNr: v.termijnHuidig,
          termijnTotaal: v.termijnTotaal,
          regel: null,
          vasteLast: v,
        }));

  const groepen: { pot: WeekPot; titel: string }[] = [
    { pot: "vast", titel: "Vaste lasten" },
    { pot: "persoonlijk", titel: "Abonnementen & termijnen" },
  ];

  return (
    <div className="hb-vast">
      {groepen.map((g) => {
        const items = posten.filter((p) => p.pot === g.pot);
        return (
          <section key={g.pot} className="hb-groep">
            <header className="hb-groep-kop">
              <h2>{g.titel}</h2>
              <span>{formatEuro(som(items.map((p) => p.bedrag)))}</span>
            </header>
            <ul className="hb-lijst">
              {items.length === 0 && <li className="hb-leeg">Nog geen posten.</li>}
              {items.map((p) => {
                const { regel, vasteLast } = p;
                const betaald = regel?.betaald ?? false;
                const label = termijnLabel(p);
                return (
                  <li key={p.sleutel} className={betaald ? "hb-regel hb-regel-betaald" : "hb-regel"}>
                    {regel && (
                      <button
                        className="hb-stempel"
                        disabled={!bewerkbaar}
                        onClick={() => boek.wijzigRegel({ ...regel, betaald: !betaald })}
                        aria-pressed={betaald}
                        aria-label={`${p.naam} betaald`}
                      >
                        <span aria-hidden="true">{betaald ? "V" : ""}</span>
                      </button>
                    )}
                    {beheer && vasteLast ? (
                      <button
                        className="hb-regel-naam hb-naamknop"
                        onClick={() => setBewerk(vasteLast)}
                        aria-label={`${label}: bewerken`}
                      >
                        {label}
                      </button>
                    ) : (
                      <span className="hb-regel-naam">{label}</span>
                    )}
                    <RegelBedrag
                      regel={p}
                      bewerkbaar={regel != null && bewerkbaar}
                      onWijzig={(bedrag) => regel && boek.wijzigRegel({ ...regel, bedrag })}
                    />
                  </li>
                );
              })}
            </ul>
            {beheer && (
              <button className="hb-knop hb-knop-rustig hb-breed" onClick={() => setNieuw(g.pot)}>
                + Post toevoegen
              </button>
            )}
          </section>
        );
      })}

      <p className="hb-hint">
        {periode
          ? "Tik op het vakje zodra iets afgeschreven is. Een bedrag dat deze periode anders is pas je rechts aan; volgende periode staat het weer op het standaardbedrag. Tik op de naam om de post zelf te bewerken."
          : "Dit is je standaardlijst. Bij het starten van een periode gaan alle posten mee."}
      </p>

      {bewerk && (
        <Blad titel="Post bewerken" onSluit={() => setBewerk(null)}>
          <PostFormulier bestaande={bewerk} standaardPot={bewerk.pot} onSluit={() => setBewerk(null)} />
        </Blad>
      )}
      {nieuw && (
        <Blad titel="Post toevoegen" onSluit={() => setNieuw(null)}>
          <PostFormulier standaardPot={nieuw} onSluit={() => setNieuw(null)} />
        </Blad>
      )}
    </div>
  );
}
