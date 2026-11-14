import { vandaagISO } from "../../logica/datum";
import { formatEuro } from "../../logica/geld";
import { useBeeld } from "../context";
import { UitgaveInvoer } from "../UitgaveInvoer";
import { UitgavenLijst } from "../WeekBlok";

export function Extra() {
  const { periode, data, overzicht, isLopende, bewerkbaar } = useBeeld();
  if (!periode || !overzicht) {
    return <p className="hb-hint">Nog geen periode gestart.</p>;
  }
  const posten = data.uitgaven
    .filter((u) => u.pot === "extra")
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.aangemaaktOp.localeCompare(b.aangemaaktOp));
  const { budget, uitgegeven, over } = overzicht.extra;

  return (
    <div>
      <div className="hb-groot">
        <div className="hb-pot-titel">Over van Extra</div>
        <div className={over < 0 ? "hb-groot-bedrag hb-rood" : "hb-groot-bedrag"}>
          {formatEuro(over)}
        </div>
        <div className="hb-pot-sub">
          {formatEuro(budget)} − {formatEuro(uitgegeven)} aan posten
        </div>
      </div>

      <section className="hb-groep">
        <header className="hb-groep-kop">
          <h2>Eenmalige posten & ontvangen</h2>
          <span>{formatEuro(uitgegeven)}</span>
        </header>
        <UitgavenLijst
          uitgaven={posten}
          bewerkbaar={bewerkbaar}
          leeg="Nog geen extra's deze periode."
        />
      </section>

      {bewerkbaar && (
        <UitgaveInvoer
          periodeId={periode.id}
          standaardDatum={isLopende ? vandaagISO() : periode.startdatum}
          standaardPot="extra"
          vastePot
        />
      )}
      <p className="hb-hint">
        Wat hier aan het eind van de periode over is, is wat je echt spaart. Ontvangen geld zet je
        erbij met de schakelaar "Ontvangen / terugbetaling".
      </p>
    </div>
  );
}
