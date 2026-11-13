import { formatInvoer, type Centen } from "../logica/geld";

/** Invoer van een saldo: het bedrag als tekst, plus of het onder nul staat. */
export interface SaldoInvoer {
  tekst: string;
  negatief: boolean;
}

export const saldoInvoer = (centen: Centen): SaldoInvoer => ({
  tekst: formatInvoer(Math.abs(centen)),
  negatief: centen < 0,
});

/**
 * Bedragveld voor een saldo. Het numerieke toetsenbord van iOS heeft geen
 * minteken, vandaar de schakelaar "Onder nul". Lees de waarde met parseSaldo.
 */
export function SaldoVeld({
  label,
  waarde,
  onWijzig,
}: {
  label: string;
  waarde: SaldoInvoer;
  onWijzig: (w: SaldoInvoer) => void;
}) {
  return (
    <div className="hb-invoer-rij">
      <label className="hb-veldlabel hb-groei">
        <span>{label}</span>
        <input
          className="hb-veld hb-veld-bedrag"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="0,00"
          value={waarde.tekst}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onWijzig({ ...waarde, tekst: e.target.value })}
        />
      </label>
      <label className="hb-schakel hb-saldo-negatief">
        <input
          type="checkbox"
          checked={waarde.negatief}
          onChange={(e) => onWijzig({ ...waarde, negatief: e.target.checked })}
        />
        <span>Onder nul</span>
      </label>
    </div>
  );
}
