import { formatKort, vandaagISO } from "../../logica/datum";
import { formatEuro } from "../../logica/geld";
import type { WeekPot } from "../../logica/potten";
import { termijnLabel } from "../../logica/termijnen";
import { weekIndexVoorDatum } from "../../logica/weken";
import { useBeeld } from "../context";
import { WeekBlok } from "../WeekBlok";

const rood = (c: number) => (c < 0 ? "hb-rood" : undefined);

/**
 * Het hele plaatje van de periode in beeld, zoals de sheet: kerncijfers,
 * potten, alle kosten en alle weken. Alles is alleen-lezen; invullen en
 * afvinken gebeurt in de andere tabs. De cijfers komen uit berekenOverzicht.
 */
export function Overzicht() {
  const { periode, data, overzicht, isLopende } = useBeeld();
  if (!periode || !overzicht) {
    return <p className="hb-hint">Nog geen periode gestart.</p>;
  }

  const { kern, saldo, status } = overzicht;
  const open = status.totaal - status.betaald;
  const extra = data.uitgaven
    .filter((u) => u.pot === "extra")
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.aangemaaktOp.localeCompare(b.aangemaaktOp));
  const nu = isLopende
    ? weekIndexVoorDatum(
        overzicht.weken.map((w) => w.blok),
        vandaagISO(),
      )
    : -1;

  const cijfers: [string, number, string][] = [
    ["Salaris", kern.salaris, "uit deze periode"],
    ["Saldo", saldo.saldo, "hoort nu op de rekening te staan"],
    ["Total", kern.total, "alle vaste lasten + alle uitgaven"],
    ["Uitgave", kern.uitgave, "afgevinkte vaste lasten + alle uitgaven"],
    ["Rest", kern.rest, "salaris − Total"],
    ["Wrk rest", kern.wrkRest, "salaris − Uitgave"],
  ];

  const potten: [string, number, number, number][] = [
    ["Vaste lasten", periode.verdeling.vast, overzicht.vast.budget, overzicht.vast.over],
    [
      "Persoonlijk",
      periode.verdeling.persoonlijk,
      overzicht.persoonlijk.budget,
      overzicht.persoonlijk.over,
    ],
    ["Extra", periode.verdeling.extra, overzicht.extra.budget, overzicht.extra.over],
  ];

  const kosten = (pot: WeekPot, titel: string) => {
    const regels = data.regels.filter((r) => r.pot === pot);
    return (
      <section className="hb-ov-kolom">
        <h3>{titel}</h3>
        <ul className="hb-ov-lijst">
          {regels.length === 0 && <li className="hb-ov-leeg">Geen posten.</li>}
          {regels.map((r) => (
            <li key={r.id} className={r.betaald ? "hb-ov-rij hb-ov-betaald" : "hb-ov-rij"}>
              <span className="hb-ov-v" aria-hidden="true">
                {r.betaald ? "V" : ""}
              </span>
              <span className="hb-ov-naam" title={termijnLabel(r)}>
                {termijnLabel(r)}
                {r.betaald && <span className="hb-verborgen"> (betaald)</span>}
              </span>
              <span className="hb-ov-bedrag">{formatEuro(r.bedrag)}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <div className="hb-ov">
      <section className="hb-ov-deel">
        <dl className="hb-ov-kern">
          {cijfers.map(([label, bedrag, uitleg]) => (
            <div key={label} title={uitleg}>
              <dt>{label}</dt>
              <dd className={rood(bedrag)}>{formatEuro(bedrag)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="hb-ov-deel">
        <table className="hb-ov-potten">
          <thead>
            <tr>
              <th scope="col">Pot</th>
              <th scope="col">%</th>
              <th scope="col">Budget</th>
              <th scope="col">Over</th>
            </tr>
          </thead>
          <tbody>
            {potten.map(([naam, perc, budget, over]) => (
              <tr key={naam}>
                <th scope="row">{naam}</th>
                <td>{perc}%</td>
                <td>{formatEuro(budget)}</td>
                <td className={rood(over)}>{formatEuro(over)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="hb-ov-deel">
        <header className="hb-groep-kop">
          <h2>Alle kosten</h2>
        </header>
        <p className="hb-ov-open">
          Nog te betalen: <strong>{formatEuro(status.openstaand)}</strong> ({open}{" "}
          {open === 1 ? "post" : "posten"})
        </p>
        <div className="hb-ov-kosten">
          {kosten("vast", "Vaste lasten")}
          {kosten("persoonlijk", "Abonnementen & termijnen")}
          <section className="hb-ov-kolom hb-ov-extra">
            <h3>Extra</h3>
            <ul className="hb-ov-lijst">
              {extra.length === 0 && <li className="hb-ov-leeg">Geen extra's deze periode.</li>}
              {extra.map((u) => (
                <li key={u.id} className="hb-ov-rij">
                  <span className="hb-ov-datum">{formatKort(u.datum)}</span>
                  <span className="hb-ov-naam" title={u.omschrijving}>
                    {u.omschrijving}
                  </span>
                  <span className={u.bedrag < 0 ? "hb-ov-bedrag hb-groen" : "hb-ov-bedrag"}>
                    {formatEuro(u.bedrag)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      <section className="hb-ov-deel">
        <header className="hb-groep-kop">
          <h2>Alle weken</h2>
        </header>
        <div className="hb-ov-weken">
          {overzicht.weken.map((week, i) => (
            <WeekBlok
              key={week.blok.start}
              week={week}
              open
              isNu={i === nu}
              bewerkbaar={false}
              alleenLezen
            />
          ))}
        </div>
      </section>
    </div>
  );
}
