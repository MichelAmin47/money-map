// Alle bedragen in de rekenlogica zijn hele centen (integers), zodat er geen
// afrondingsfouten van floating point in de potten sluipen.

export type Centen = number;

export const naarCenten = (euro: number): Centen => Math.round(euro * 100);
export const naarEuro = (centen: Centen): number => centen / 100;

const euroFormaat = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export const formatEuro = (centen: Centen): string =>
  euroFormaat.format(naarEuro(centen || 0));

/**
 * Bedrag met een los teken ervoor, voor een verschil of een doorgeschoven
 * bedrag: "+ € 45,00" of "− € 12,00". Nul krijgt geen teken.
 */
export const formatMetTeken = (centen: Centen): string =>
  centen === 0
    ? formatEuro(0)
    : `${centen < 0 ? "−" : "+"} ${formatEuro(Math.abs(centen))}`;

/** Bedrag zonder €-teken, voor in invoervelden: 1234.5 → "1234,50". */
export const formatInvoer = (centen: Centen): string =>
  naarEuro(centen).toFixed(2).replace(".", ",");

/**
 * Leest een ingetypt bedrag in nl-NL-notatie en geeft centen terug, of null
 * als het geen geldig bedrag is. Accepteert "12", "12,5", "12,50", "1.234,56",
 * "€ 12,50", en voor het gemak ook "12.50" (punt als decimaalteken).
 */
export function parseBedrag(invoer: string): Centen | null {
  let s = invoer.replace(/[€\s ]/g, "");
  if (s === "") return null;
  let teken = 1;
  if (s.startsWith("-")) {
    teken = -1;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (s.includes(",")) {
    // Komma is het decimaalteken, punten zijn duizendtallen.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" zonder komma: duizendtal.
    s = s.replace(/\./g, "");
  }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return teken * Math.round(n * 100);
}

/**
 * Leest een saldo dat ook negatief kan zijn. Het numerieke toetsenbord van iOS
 * heeft geen minteken, dus "negatief" komt van een aparte schakelaar. Een leeg
 * veld is 0; een getypt minteken telt ook.
 */
export function parseSaldo(invoer: string, negatief: boolean): Centen | null {
  if (invoer.trim() === "") return 0;
  const centen = parseBedrag(invoer);
  if (centen == null) return null;
  if (centen < 0) return centen;
  return negatief && centen !== 0 ? -centen : centen;
}
