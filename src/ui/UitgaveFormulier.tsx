import { useRef, useState } from "react";
import type { ISODatum } from "../logica/datum";
import { formatEuro, formatInvoer, parseBedrag } from "../logica/geld";
import type { Uitgave } from "../logica/overzicht";
import type { Pot } from "../logica/potten";
import { useBoek, useWinkels } from "./context";

const POTTEN: [Pot, string][] = [
  ["vast", "Vaste lasten"],
  ["persoonlijk", "Persoonlijk"],
  ["extra", "Extra"],
];

/**
 * Invoer voor een nieuwe uitgave, of (met `bestaande`) het bewerken ervan.
 * Het bedrag blijft een string tot het opslaan, zodat "12," gewoon te typen is.
 */
export function UitgaveFormulier({
  periodeId,
  standaardDatum,
  standaardPot = "vast",
  vastePot = false,
  termijnenMogelijk = false,
  bestaande,
  autoFocus = false,
  onKlaar,
}: {
  periodeId: string;
  standaardDatum: ISODatum;
  standaardPot?: Pot;
  /** Verberg de potkeuze (scherm Extra). */
  vastePot?: boolean;
  /** Alleen in de lopende periode kan een aankoop in termijnen. */
  termijnenMogelijk?: boolean;
  bestaande?: Uitgave;
  autoFocus?: boolean;
  onKlaar?: () => void;
}) {
  const boek = useBoek();
  const winkels = useWinkels(vastePot && standaardPot === "extra");
  const [bedrag, setBedrag] = useState(
    bestaande ? formatInvoer(Math.abs(bestaande.bedrag)) : "",
  );
  const [naam, setNaam] = useState(bestaande?.omschrijving ?? "");
  const [pot, setPot] = useState<Pot>(bestaande?.pot ?? standaardPot);
  const [ontvangen, setOntvangen] = useState(bestaande ? bestaande.bedrag < 0 : false);
  const [datum, setDatum] = useState(bestaande?.datum ?? standaardDatum);
  const [inTermijnen, setInTermijnen] = useState(false);
  const [aantal, setAantal] = useState("3");
  const [fout, setFout] = useState<string | null>(null);
  const bedragRef = useRef<HTMLInputElement>(null);

  const centen = parseBedrag(bedrag);
  const aantalTermijnen = Number.parseInt(aantal, 10);
  const termijnen = termijnenMogelijk && !bestaande && inTermijnen && !ontvangen;

  const verstuur = () => {
    if (centen == null || centen === 0) {
      setFout("Vul een bedrag in, bijvoorbeeld 12,50.");
      bedragRef.current?.focus();
      return;
    }
    if (!naam.trim()) {
      setFout("Vul in waaraan het is uitgegeven.");
      return;
    }
    if (!datum) {
      setFout("Kies een datum.");
      return;
    }
    if (termijnen && !(aantalTermijnen >= 2 && aantalTermijnen <= 120)) {
      setFout("Vul het aantal termijnen in (2 of meer).");
      return;
    }
    setFout(null);
    const abs = Math.abs(centen);

    if (termijnen) {
      boek.voegTermijnAankoopToe(naam.trim(), abs, aantalTermijnen);
    } else {
      const invoer = {
        datum,
        bedrag: ontvangen ? -abs : abs,
        omschrijving: naam.trim(),
        pot,
      };
      if (bestaande) boek.wijzigUitgave({ ...bestaande, ...invoer });
      else boek.voegUitgaveToe(periodeId, invoer);
    }

    if (bestaande) {
      onKlaar?.();
      return;
    }
    setBedrag("");
    setNaam("");
    setOntvangen(false);
    setInTermijnen(false);
    bedragRef.current?.focus();
    onKlaar?.();
  };

  const opEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      verstuur();
    }
  };

  return (
    <form
      className="hb-invoer"
      onSubmit={(e) => {
        e.preventDefault();
        verstuur();
      }}
      noValidate
    >
      <div className="hb-invoer-rij">
        <label className="hb-veldlabel hb-veldlabel-bedrag">
          <span>{termijnen ? "Per termijn" : ontvangen ? "Ontvangen" : "Bedrag"}</span>
          <input
            ref={bedragRef}
            className="hb-veld hb-veld-bedrag"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="0,00"
            value={bedrag}
            autoFocus={autoFocus}
            onChange={(e) => setBedrag(e.target.value)}
            onKeyDown={opEnter}
          />
        </label>
        <label className="hb-veldlabel hb-groei">
          <span>Waaraan?</span>
          <input
            className="hb-veld"
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="done"
            placeholder="Winkel of omschrijving"
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            onKeyDown={opEnter}
          />
        </label>
      </div>

      {winkels.length > 0 && (
        <div className="hb-winkels" role="group" aria-label="Vaak gebruikt">
          {winkels.map((w) => (
            <button
              key={w.naam}
              type="button"
              className={naam === w.naam ? "hb-winkel hb-winkel-aan" : "hb-winkel"}
              onClick={() => {
                setNaam(w.naam);
                if (w.pot && !vastePot && !bestaande) setPot(w.pot);
                if (!bedrag) bedragRef.current?.focus();
              }}
            >
              {w.naam}
            </button>
          ))}
        </div>
      )}

      {!vastePot && !termijnen && (
        <div className="hb-keuze" role="group" aria-label="Pot">
          {POTTEN.map(([k, l]) => (
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
      )}

      <div className="hb-invoer-rij hb-invoer-opties">
        <label className="hb-schakel">
          <input
            type="checkbox"
            checked={ontvangen}
            onChange={(e) => setOntvangen(e.target.checked)}
          />
          <span>Ontvangen / terugbetaling</span>
        </label>
        <label className="hb-veldlabel hb-datum">
          <span className="hb-verborgen">Datum</span>
          <input
            type="date"
            className="hb-veld"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
          />
        </label>
      </div>

      {termijnenMogelijk && !bestaande && !ontvangen && (
        <div className="hb-invoer-rij hb-invoer-opties">
          <label className="hb-schakel">
            <input
              type="checkbox"
              checked={inTermijnen}
              onChange={(e) => setInTermijnen(e.target.checked)}
            />
            <span>In termijnen</span>
          </label>
          {inTermijnen && (
            <label className="hb-veldlabel hb-aantal">
              <span>Aantal</span>
              <input
                className="hb-veld hb-veld-bedrag"
                inputMode="numeric"
                value={aantal}
                onChange={(e) => setAantal(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          )}
        </div>
      )}
      {termijnen && (
        <p className="hb-hint">
          Wordt een termijnpost bij Persoonlijk
          {centen != null && aantalTermijnen >= 2 && (
            <>
              : {aantalTermijnen} × {formatEuro(Math.abs(centen))} ={" "}
              {formatEuro(Math.abs(centen) * aantalTermijnen)}
            </>
          )}
          . De eerste termijn telt nu mee, de rest komt vanzelf in de volgende periodes.
        </p>
      )}

      {fout && (
        <p className="hb-veldfout" role="alert">
          {fout}
        </p>
      )}

      <div className="hb-invoer-rij">
        {bestaande && (
          <button
            type="button"
            className="hb-knop hb-knop-gevaar"
            onClick={() => {
              boek.verwijderUitgave(bestaande);
              onKlaar?.();
            }}
          >
            Verwijder
          </button>
        )}
        <button type="submit" className="hb-knop hb-knop-hoofd hb-groei">
          {bestaande ? "Bewaar" : ontvangen ? "Zet erbij als ontvangen" : "Zet erbij"}
        </button>
      </div>
    </form>
  );
}
