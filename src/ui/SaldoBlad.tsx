import { useState } from "react";
import { formatEuro, parseSaldo } from "../logica/geld";
import type { Periode, SaldoOverzicht } from "../logica/overzicht";
import { Blad } from "./Blad";
import { useBoek } from "./context";
import { SaldoVeld, saldoInvoer } from "./SaldoVeld";

/** De opbouw van het saldo, en de plek om het startsaldo van de periode aan te passen. */
export function SaldoBlad({
  periode,
  saldo,
  bewerkbaar,
  onSluit,
}: {
  periode: Periode;
  saldo: SaldoOverzicht;
  bewerkbaar: boolean;
  onSluit: () => void;
}) {
  const boek = useBoek();
  const [invoer, setInvoer] = useState(() => saldoInvoer(periode.startsaldo));
  const [fout, setFout] = useState<string | null>(null);

  const bewaar = () => {
    const centen = parseSaldo(invoer.tekst, invoer.negatief);
    if (centen == null) {
      setFout("Vul een bedrag in, bijvoorbeeld 12,50.");
      return;
    }
    boek.wijzigStartsaldo(periode.id, centen);
    onSluit();
  };

  const rij = (label: string, bedrag: number, sterk = false) => (
    <tr className={sterk ? "hb-sterk" : undefined}>
      <th scope="row">{label}</th>
      <td className={bedrag < 0 ? "hb-rood" : ""}>{formatEuro(bedrag)}</td>
    </tr>
  );

  return (
    <Blad titel="Saldo" onSluit={onSluit}>
      <form
        className="hb-formulier"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          bewaar();
        }}
      >
        <table className="hb-weektabel hb-saldotabel">
          <tbody>
            {rij("Startsaldo", saldo.startsaldo)}
            {rij("Salaris", saldo.salaris)}
            {rij("Vaste lasten met een V", -saldo.betaald)}
            {rij("Uitgaven, alle potten", -saldo.uitgaven)}
            {rij("Saldo", saldo.saldo, true)}
          </tbody>
        </table>
        <p className="hb-hint">
          Dit hoort er nu op je rekening te staan. Vaste lasten tellen pas mee als ze een V hebben;
          ontvangen geld telt erbij op.
        </p>
        {bewerkbaar ? (
          <>
            <SaldoVeld label="Startsaldo van deze periode" waarde={invoer} onWijzig={setInvoer} />
            {fout && (
              <p className="hb-veldfout" role="alert">
                {fout}
              </p>
            )}
            <button type="submit" className="hb-knop hb-knop-hoofd">
              Bewaar startsaldo
            </button>
          </>
        ) : (
          <p className="hb-hint">
            Dit is een eerdere periode. Kies "Toch bewerken" om het startsaldo aan te passen.
          </p>
        )}
      </form>
    </Blad>
  );
}
