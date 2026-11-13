import { useRef, useState } from "react";
import { WEEKDAGEN } from "../../logica/datum";
import { formatEuro, formatInvoer, parseBedrag } from "../../logica/geld";
import { ImportFout, leesStartdata, type Startdata } from "../../logica/startdata";
import { Blad } from "../Blad";
import { useBoek, useStaat } from "../context";

const POTTEN = [
  ["vast", "Vaste lasten"],
  ["persoonlijk", "Persoonlijk"],
  ["extra", "Extra"],
] as const;

export function Instellingen({
  onNieuwePeriode,
  onSaldo,
  onUitloggen,
}: {
  onNieuwePeriode: () => void;
  /** Opent het blad met het saldo en het startsaldo van de periode in beeld. */
  onSaldo: () => void;
  onUitloggen?: () => void;
}) {
  const boek = useBoek();
  const s = useStaat();
  const i = s.instellingen;

  const [salaris, setSalaris] = useState(formatInvoer(i.salaris));
  const [perc, setPerc] = useState({
    vast: String(i.verdeling.vast),
    persoonlijk: String(i.verdeling.persoonlijk),
    extra: String(i.verdeling.extra),
  });
  const [startDag, setStartDag] = useState(i.weekStartDag);
  const [bewaard, setBewaard] = useState(false);

  const [importData, setImportData] = useState<Startdata | null>(null);
  const [vervangen, setVervangen] = useState(false);
  const [melding, setMelding] = useState<{ soort: "goed" | "fout"; tekst: string } | null>(null);
  const bestandRef = useRef<HTMLInputElement>(null);

  const salarisCenten = parseBedrag(salaris);
  const getallen = {
    vast: Number(perc.vast),
    persoonlijk: Number(perc.persoonlijk),
    extra: Number(perc.extra),
  };
  const totaal = getallen.vast + getallen.persoonlijk + getallen.extra;
  const percGeldig =
    Object.values(perc).every((p) => /^\d{1,3}$/.test(p)) && totaal === 100;
  const salarisGeldig = salarisCenten != null && salarisCenten >= 0;

  const bewaar = () => {
    if (!percGeldig || !salarisGeldig) return;
    boek.bewaarInstellingen({ salaris: salarisCenten, verdeling: getallen, weekStartDag: startDag });
    setSalaris(formatInvoer(salarisCenten));
    setBewaard(true);
  };
  const gewijzigd = () => setBewaard(false);

  const kiesBestand = async (bestand: File | undefined) => {
    setMelding(null);
    if (!bestand) return;
    try {
      const data = leesStartdata(JSON.parse(await bestand.text()));
      setVervangen(false);
      setImportData(data);
    } catch (e) {
      setMelding({
        soort: "fout",
        tekst:
          e instanceof ImportFout
            ? e.message
            : "Dit bestand is geen geldige JSON. Controleer het en probeer het opnieuw.",
      });
    } finally {
      if (bestandRef.current) bestandRef.current.value = "";
    }
  };

  const voerImportUit = () => {
    if (!importData) return;
    boek.importeer(importData, vervangen);
    const n = importData.instellingen;
    setSalaris(formatInvoer(n.salaris));
    setPerc({
      vast: String(n.verdeling.vast),
      persoonlijk: String(n.verdeling.persoonlijk),
      extra: String(n.verdeling.extra),
    });
    setStartDag(n.weekStartDag);
    setMelding({
      soort: "goed",
      tekst: `Geïmporteerd: ${importData.vasteLasten.length} vaste lasten en ${importData.winkels.length} winkels.`,
    });
    setImportData(null);
  };

  const exporteer = async () => {
    setMelding(null);
    try {
      const json = JSON.stringify(await boek.exporteer(), null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `huishoudboek-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setMelding({ soort: "fout", tekst: "Exporteren lukte niet. Probeer het zo nog eens." });
    }
  };

  const aantalBestaand = s.vasteLasten.filter((v) => v.actief).length;

  return (
    <div className="hb-instel">
      <section className="hb-groep">
        <header className="hb-groep-kop">
          <h2>Salaris en verdeling</h2>
        </header>
        <div className="hb-formulier">
          <label className="hb-veldlabel">
            <span>Salaris per periode</span>
            <input
              className="hb-veld hb-veld-bedrag"
              inputMode="decimal"
              autoComplete="off"
              value={salaris}
              onChange={(e) => {
                setSalaris(e.target.value);
                gewijzigd();
              }}
            />
          </label>

          <div className="hb-slices">
            {POTTEN.map(([k, l]) => (
              <label key={k} className="hb-veldlabel">
                <span>{l}</span>
                <span className="hb-perc">
                  <input
                    className="hb-veld hb-veld-bedrag"
                    inputMode="numeric"
                    value={perc[k]}
                    onChange={(e) => {
                      setPerc({ ...perc, [k]: e.target.value.replace(/\D/g, "").slice(0, 3) });
                      gewijzigd();
                    }}
                  />
                  <span>%</span>
                </span>
                <small>{formatEuro(Math.round(((salarisCenten ?? 0) * getallen[k]) / 100))}</small>
              </label>
            ))}
          </div>
          <div className={totaal === 100 ? "hb-totaal" : "hb-totaal hb-rood"} role="status">
            Samen {totaal}%{totaal !== 100 && ": dit moet 100% zijn"}
          </div>

          <label className="hb-veldlabel">
            <span>Startdag van de week</span>
            <select
              className="hb-veld"
              value={startDag}
              onChange={(e) => {
                setStartDag(Number(e.target.value));
                gewijzigd();
              }}
            >
              {WEEKDAGEN.map((d, n) => (
                <option key={d} value={n}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <button
            className="hb-knop hb-knop-hoofd"
            disabled={!percGeldig || !salarisGeldig}
            onClick={bewaar}
          >
            {bewaard ? "Bewaard" : "Bewaar"}
          </button>
          <p className="hb-hint">
            Wijzigingen gelden meteen voor de lopende periode en voor volgende periodes. Eerdere
            periodes houden hun eigen salaris en verdeling.
          </p>
        </div>
      </section>

      <section className="hb-groep">
        <header className="hb-groep-kop">
          <h2>Periode</h2>
        </header>
        <div className="hb-formulier">
          <button className="hb-knop hb-knop-rustig" onClick={onNieuwePeriode}>
            Nieuwe periode starten…
          </button>
          {s.periodes.length > 0 && (
            <button className="hb-knop hb-knop-rustig" onClick={onSaldo}>
              Saldo en startsaldo…
            </button>
          )}
        </div>
      </section>

      <section className="hb-groep">
        <header className="hb-groep-kop">
          <h2>Export en import</h2>
        </header>
        <div className="hb-formulier">
          <button className="hb-knop hb-knop-rustig" onClick={exporteer}>
            Exporteer als JSON
          </button>
          <button className="hb-knop hb-knop-rustig" onClick={() => bestandRef.current?.click()}>
            Importeer startdata (JSON)…
          </button>
          <input
            ref={bestandRef}
            type="file"
            accept="application/json,.json"
            className="hb-verborgen"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => void kiesBestand(e.target.files?.[0])}
          />
          {melding && (
            <p className={melding.soort === "fout" ? "hb-veldfout" : "hb-goed"} role="status">
              {melding.tekst}
            </p>
          )}
          <p className="hb-hint">
            De export bevat je instellingen, vaste lasten en alle periodes (met startsaldo). De import leest het
            formaat van <code>startdata.json</code>: instellingen, vaste lasten en winkels.
          </p>
        </div>
      </section>

      {onUitloggen && (
        <section className="hb-groep">
          <button className="hb-knop hb-knop-rustig hb-breed" onClick={onUitloggen}>
            Uitloggen
          </button>
        </section>
      )}

      <div className="hb-uitleg">
        <h3>Hoe de weekpot werkt</h3>
        <p>
          Van elke pot gaan eerst de vaste lasten af. Wat overblijft is de weekpot, en die wordt
          gelijk over de weken van de periode verdeeld. Wat je in een week overhoudt schuift door
          naar de volgende week; een tekort gaat er daar weer af. Een week begint op{" "}
          {WEEKDAGEN[i.weekStartDag]}; dagen aan het begin van de periode vóór de eerste{" "}
          {WEEKDAGEN[i.weekStartDag]} tellen bij week 1.
        </p>
      </div>

      {importData && (
        <Blad titel="Startdata importeren" onSluit={() => setImportData(null)}>
          <div className="hb-formulier">
            <ul className="hb-opsomming">
              <li>
                Salaris {formatEuro(importData.instellingen.salaris)}, verdeling{" "}
                {importData.instellingen.verdeling.vast} / {importData.instellingen.verdeling.persoonlijk}{" "}
                / {importData.instellingen.verdeling.extra}, week begint op{" "}
                {WEEKDAGEN[importData.instellingen.weekStartDag]}
              </li>
              <li>{importData.vasteLasten.length} vaste lasten</li>
              <li>{importData.winkels.length} winkels</li>
            </ul>
            {aantalBestaand > 0 ? (
              <>
                <p className="hb-hint">
                  Je hebt al {aantalBestaand} vaste lasten. Standaard worden posten met dezelfde naam
                  bijgewerkt en nieuwe toegevoegd; de rest blijft staan. Twee keer importeren geeft
                  dus geen dubbelen.
                </p>
                <label className="hb-schakel">
                  <input
                    type="checkbox"
                    checked={vervangen}
                    onChange={(e) => setVervangen(e.target.checked)}
                  />
                  <span>Bestaande vaste lasten eerst verwijderen (vervangen)</span>
                </label>
                {vervangen && (
                  <p className="hb-veldfout">
                    Alle {aantalBestaand} bestaande vaste lasten verdwijnen, ook de vinkjes van de
                    lopende periode. Eerdere periodes en je uitgaven blijven staan.
                  </p>
                )}
              </>
            ) : (
              <p className="hb-hint">Je instellingen worden overschreven met die uit het bestand.</p>
            )}
            <button className="hb-knop hb-knop-hoofd" onClick={voerImportUit}>
              {vervangen ? "Vervangen en importeren" : "Importeren"}
            </button>
          </div>
        </Blad>
      )}
    </div>
  );
}
