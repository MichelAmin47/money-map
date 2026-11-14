import { useState } from "react";
import type { VasteLastInvoer } from "../../data/boek";
import { formatEuro, formatInvoer, parseBedrag } from "../../logica/geld";
import { som, type WeekPot } from "../../logica/potten";
import { termijnLabel, type PeriodeRegel, type VasteLast } from "../../logica/termijnen";
import { Blad } from "../Blad";
import { useBeeld, useBoek, useStaat } from "../context";

/**
 * Het bewerkvenster van een post. Met een `regel` staat bovenaan het bedrag
 * van deze periode; met een `bestaande` vaste last (of bij een nieuwe post)
 * staan eronder de velden van de post zelf. Bedragen blijven een string en
 * worden pas bij Bewaar geparset, zodat "12," te typen is.
 */
function PostFormulier({
  bestaande,
  regel,
  standaardPot,
  onSluit,
}: {
  bestaande?: VasteLast;
  /** De regel in de periode in beeld, als het bedrag daar aan te passen is. */
  regel?: PeriodeRegel;
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
  const [periodeBedrag, setPeriodeBedrag] = useState(regel ? formatInvoer(regel.bedrag) : "");
  const [fout, setFout] = useState<string | null>(null);

  // Zonder standaardpost (eerdere periode) is alleen het periodebedrag aan te passen.
  const toonPost = !regel || bestaande != null;

  const bewaar = () => {
    const periodeCenten = regel ? parseBedrag(periodeBedrag) : null;
    if (regel && (periodeCenten == null || periodeCenten < 0)) {
      return setFout("Vul een bedrag in, bijvoorbeeld 12,50.");
    }
    if (toonPost) {
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
      if (!bestaande) boek.voegVasteLastToe(invoer);
      else if (
        invoer.naam !== bestaande.naam ||
        invoer.standaardBedrag !== bestaande.standaardBedrag ||
        invoer.pot !== bestaande.pot ||
        invoer.termijnHuidig !== bestaande.termijnHuidig ||
        invoer.termijnTotaal !== bestaande.termijnTotaal
      ) {
        boek.wijzigVasteLast(bestaande.id, invoer);
      }
    }
    if (regel && periodeCenten != null && periodeCenten !== regel.bedrag) {
      // De regel opnieuw ophalen: wijzigVasteLast kan hem net hebben bijgewerkt.
      const nu =
        boek.momentopname().data[regel.periodeId]?.regels.find((r) => r.id === regel.id) ?? regel;
      boek.wijzigRegel({ ...nu, bedrag: periodeCenten });
    }
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
      {regel && (
        <label className="hb-veldlabel">
          <span>Bedrag deze periode{toonPost ? "" : ` · ${termijnLabel(regel)}`}</span>
          <input
            className="hb-veld hb-veld-bedrag"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="0,00"
            value={periodeBedrag}
            onChange={(e) => setPeriodeBedrag(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        </label>
      )}
      {regel && toonPost && (
        <p className="hb-hint">
          Geldt alleen voor deze periode. Hieronder staat de post zelf, voor volgende periodes.
        </p>
      )}
      {toonPost && (
        <>
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
        </>
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
  const [bewerk, setBewerk] = useState<Post | null>(null);
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
                const inhoud = (
                  <>
                    <span className="hb-regel-naam">{label}</span>
                    <span className="hb-regel-bedrag">{formatEuro(p.bedrag)}</span>
                  </>
                );
                // Tik op de rij: bedrag van deze periode en/of de post zelf bewerken.
                const teBewerken = (regel != null && bewerkbaar) || (beheer && vasteLast != null);
                return (
                  <li key={p.sleutel} className={betaald ? "hb-post hb-regel-betaald" : "hb-post"}>
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
                    {teBewerken ? (
                      <button
                        className="hb-post-rij hb-post-knop"
                        onClick={() => setBewerk(p)}
                        aria-label={`${label}, ${formatEuro(p.bedrag)}: bewerken`}
                      >
                        {inhoud}
                      </button>
                    ) : (
                      <div className="hb-post-rij">{inhoud}</div>
                    )}
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
          ? "Tik op het vakje zodra iets afgeschreven is. Tik op een post om het bedrag van deze periode aan te passen; volgende periode staat het weer op het standaardbedrag."
          : "Dit is je standaardlijst. Bij het starten van een periode gaan alle posten mee."}
      </p>

      {bewerk && (
        <Blad titel="Post bewerken" onSluit={() => setBewerk(null)}>
          <PostFormulier
            bestaande={beheer ? (bewerk.vasteLast ?? undefined) : undefined}
            regel={bewerkbaar ? (bewerk.regel ?? undefined) : undefined}
            standaardPot={bewerk.pot}
            onSluit={() => setBewerk(null)}
          />
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
