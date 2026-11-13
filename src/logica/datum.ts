// Datums zijn overal ISO-strings ("2026-11-13"), zonder tijd. Rekenen gebeurt
// in UTC zodat zomer-/wintertijd geen dag kan verschuiven.

export type ISODatum = string;

const naarUTC = (iso: ISODatum): Date => {
  const [j, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(j!, m! - 1, d!));
};

const vanUTC = (d: Date): ISODatum => d.toISOString().slice(0, 10);

export function vandaagISO(nu: Date = new Date()): ISODatum {
  const j = nu.getFullYear();
  const m = String(nu.getMonth() + 1).padStart(2, "0");
  const d = String(nu.getDate()).padStart(2, "0");
  return `${j}-${m}-${d}`;
}

export function plusDagen(iso: ISODatum, dagen: number): ISODatum {
  const d = naarUTC(iso);
  d.setUTCDate(d.getUTCDate() + dagen);
  return vanUTC(d);
}

/** Eén maand verder; 31 januari wordt 28/29 februari (niet 3 maart). */
export function plusMaand(iso: ISODatum, maanden = 1): ISODatum {
  const d = naarUTC(iso);
  const dag = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + maanden);
  const laatste = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(dag, laatste));
  return vanUTC(d);
}

/** 0 = zondag … 6 = zaterdag, zoals Date.getDay(). */
export const dagVanWeek = (iso: ISODatum): number => naarUTC(iso).getUTCDay();

export const dagVanMaand = (iso: ISODatum): number => naarUTC(iso).getUTCDate();

export const dagenTussen = (van: ISODatum, tot: ISODatum): number =>
  Math.round((naarUTC(tot).getTime() - naarUTC(van).getTime()) / 86_400_000);

export const isISODatum = (s: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && vanUTC(naarUTC(s)) === s;

export const WEEKDAGEN = [
  "zondag",
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
] as const;

const MAAND_KORT = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

/** "13 nov" */
export function formatKort(iso: ISODatum): string {
  const d = naarUTC(iso);
  return `${d.getUTCDate()} ${MAAND_KORT[d.getUTCMonth()]}`;
}

/** "vr 13 nov" */
export function formatMetDag(iso: ISODatum): string {
  return `${WEEKDAGEN[dagVanWeek(iso)]!.slice(0, 2)} ${formatKort(iso)}`;
}

export const jaarVan = (iso: ISODatum): number => naarUTC(iso).getUTCFullYear();
