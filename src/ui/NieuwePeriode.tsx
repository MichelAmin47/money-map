import { useState } from "react";
import { formatKort, isISODatum, plusDagen, plusMaand, vandaagISO } from "../logica/datum";
import { formatEuro, parseSaldo } from "../logica/geld";
import { heeftTermijnen } from "../logica/termijnen";
import { weekblokken } from "../logica/weken";
import { Blad } from "./Blad";
import { useBoek, useStaat } from "./context";
import { SaldoVeld, saldoInvoer } from "./SaldoVeld";

export function NieuwePeriode({ onSluit }: { onSluit: () => void }) {
  const boek = useBoek();
  const s = useStaat();
  const [start, setStart] = useState(vandaagISO());
  const [volgende, setVolgende] = useState(plusMaand(vandaagISO()));
  const [volgendeAangepast, setVolgendeAangepast] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  // Voorstel: het saldo van de lopende periode zoals het nu is (of 0).
  const [eindsaldo] = useState(() => boek.eindsaldoLopende());
  const [saldo, setSaldo] = useState(() => saldoInvoer(eindsaldo));

  const geldig = isISODatum(start) && isISODatum(volgende) && volgende > start;
  const blokken = geldig
    ? weekblokken(start, plusDagen(volgende, -1), s.instellingen.weekStartDag)
    : [];
  const actief = s.vasteLasten.filter((v) => v.actief);
  const lopende = s.periodes.at(-1);
  const vorigeIds = new Set(
    lopende ? (s.data[lopende.id]?.regels ?? []).map((r) => r.vasteLastId) : [],
  );
  const lopenAf = actief.filter(
    (v) => heeftTermijnen(v) && vorigeIds.has(v.id) && v.termijnHuidig! >= v.termijnTotaal!,
  );

  const begin = () => {
    if (!geldig) {
      setFout("De volgende salarisdatum moet na de startdatum liggen.");
      return;
    }
    const startsaldo = parseSaldo(saldo.tekst, saldo.negatief);
    if (startsaldo == null) {
      setFout("Vul bij het startsaldo een bedrag in, bijvoorbeeld 12,50.");
      return;
    }
    const melding = boek.startPeriode(start, volgende, startsaldo);
    if (melding) setFout(melding);
    else onSluit();
  };

  return (
    <Blad titel="Nieuwe periode starten" onSluit={onSluit}>
      <div className="hb-formulier">
        <label className="hb-veldlabel">
          <span>Startdatum (salaris binnen)</span>
          <input
            type="date"
            className="hb-veld"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              if (!volgendeAangepast && isISODatum(e.target.value)) {
                setVolgende(plusMaand(e.target.value));
              }
            }}
          />
        </label>
        <label className="hb-veldlabel">
          <span>Verwachte volgende salarisdatum</span>
          <input
            type="date"
            className="hb-veld"
            value={volgende}
            onChange={(e) => {
              setVolgende(e.target.value);
              setVolgendeAangepast(true);
            }}
          />
        </label>

        <SaldoVeld
          label="Startsaldo (vóór dit salaris)"
          waarde={saldo}
          onWijzig={setSaldo}
        />
        <p className="hb-hint">
          {lopende
            ? `Het saldo van de vorige periode staat nu op ${formatEuro(eindsaldo)}. Pas het aan als er iets anders op je rekening stond.`
            : "Wat er op je rekening stond voordat dit salaris binnenkwam."}
        </p>

        {geldig && (
          <ul className="hb-opsomming">
            <li>
              {formatKort(start)} t/m {formatKort(plusDagen(volgende, -1))}:{" "}
              <strong>{blokken.length} weken</strong> ({blokken.map((b) => b.label).join(" · ")})
            </li>
            <li>
              {actief.length - lopenAf.length} vaste lasten gaan mee, vinkjes leeg, termijnen één
              verder.
            </li>
            {lopenAf.length > 0 && (
              <li>Afgelopen en niet meer mee: {lopenAf.map((v) => v.naam).join(", ")}.</li>
            )}
            <li>Weekuitgaven en extra's beginnen leeg. De vorige periode blijft bewaard.</li>
          </ul>
        )}
        {s.instellingen.salaris === 0 && (
          <p className="hb-hint">
            Let op: er is nog geen salaris ingevuld. Dat kan ook later, bij Instellingen.
          </p>
        )}
        {fout && (
          <p className="hb-veldfout" role="alert">
            {fout}
          </p>
        )}
        <button className="hb-knop hb-knop-hoofd" onClick={begin}>
          Start periode
        </button>
      </div>
    </Blad>
  );
}
