// REFERENTIE — eerste prototype (Claude-artifact). Gebruikt window.storage,
// dat buiten Claude niet bestaat. Alleen gebruiken voor look & feel en basislogica.

import React, { useState, useEffect, useMemo, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Standaardwaarden — overgenomen uit de bestaande sheet              */
/* ------------------------------------------------------------------ */

// Persoonlijke data staat NIET in de code. Deze leeg-config is alleen de
// vorm; echte waarden komen uit de database of uit een JSON-import.
const STANDAARD_CONFIG = {
  salaris: 0,
  slices: { vast: 62, persoonlijk: 25, sparen: 13 },
  vasteLasten: [
    { id: "voorbeeld1", naam: "Huur", bedrag: 0, cat: "vast" },
    { id: "voorbeeld2", naam: "Streamingdienst", bedrag: 0, cat: "persoonlijk" },
  ],
  winkels: ["Supermarkt", "Drogist", "OV"],
};

/* ------------------------------------------------------------------ */
/*  Hulpfuncties                                                       */
/* ------------------------------------------------------------------ */

const euro = (n) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n || 0);

const MAANDEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

const maandKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// Weken van de maand, maandag als startdag — zoals "13 t/m 19" in de sheet
function wekenVanMaand(jaar, maand) {
  const weken = [];
  const eerste = new Date(jaar, maand, 1);
  const laatste = new Date(jaar, maand + 1, 0);
  let cursor = new Date(eerste);
  const dagVerschuiving = (cursor.getDay() + 6) % 7;
  cursor.setDate(cursor.getDate() - dagVerschuiving);

  while (cursor <= laatste) {
    const start = new Date(cursor);
    const eind = new Date(cursor);
    eind.setDate(eind.getDate() + 6);
    weken.push({
      id: `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`,
      label: `${start.getDate()} t/m ${eind.getDate()}`,
      start,
      eind,
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return weken;
}

function weekVanDatum(weken, datum) {
  const d = new Date(datum);
  const gevonden = weken.find((w) => d >= w.start && d <= w.eind);
  return gevonden ? gevonden.id : weken[0]?.id;
}

/* ------------------------------------------------------------------ */

export default function Huishoudboek() {
  const [config, setConfig] = useState(null);
  const [maandData, setMaandData] = useState(null);
  const [huidigeMaand, setHuidigeMaand] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [tab, setTab] = useState("weken");
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState(null);

  const sleutel = maandKey(huidigeMaand);
  const weken = useMemo(
    () => wekenVanMaand(huidigeMaand.getFullYear(), huidigeMaand.getMonth()),
    [huidigeMaand]
  );

  /* ---------- laden ---------- */
  useEffect(() => {
    (async () => {
      let cfg = STANDAARD_CONFIG;
      try {
        const r = await window.storage.get("config");
        if (r?.value) cfg = { ...STANDAARD_CONFIG, ...JSON.parse(r.value) };
      } catch (e) {
        /* nog geen config opgeslagen — standaard gebruiken */
      }
      setConfig(cfg);
    })();
  }, []);

  useEffect(() => {
    if (!config) return;
    setLaden(true);
    (async () => {
      let data = null;
      try {
        const r = await window.storage.get(`maand:${sleutel}`);
        if (r?.value) data = JSON.parse(r.value);
      } catch (e) {
        /* maand bestaat nog niet */
      }
      if (!data) {
        data = {
          betaald: {},
          bedragen: {},
          uitgaven: [],
        };
      }
      setMaandData(data);
      setLaden(false);
    })();
  }, [sleutel, config]);

  /* ---------- opslaan ---------- */
  const bewaarMaand = async (nieuw) => {
    setMaandData(nieuw);
    try {
      await window.storage.set(`maand:${sleutel}`, JSON.stringify(nieuw));
      setFout(null);
    } catch (e) {
      setFout("Opslaan lukte niet. Probeer het zo nog eens.");
    }
  };

  const bewaarConfig = async (nieuw) => {
    setConfig(nieuw);
    try {
      await window.storage.set("config", JSON.stringify(nieuw));
      setFout(null);
    } catch (e) {
      setFout("Instellingen opslaan lukte niet.");
    }
  };

  /* ---------- berekeningen ---------- */
  const b = useMemo(() => {
    if (!config || !maandData) return null;

    const budgetVast = (config.salaris * config.slices.vast) / 100;
    const budgetPers = (config.salaris * config.slices.persoonlijk) / 100;
    const sparen = (config.salaris * config.slices.sparen) / 100;

    const bedragVan = (vl) =>
      maandData.bedragen[vl.id] !== undefined
        ? maandData.bedragen[vl.id]
        : vl.bedrag;

    const vasteVast = config.vasteLasten.filter((v) => v.cat === "vast");
    const vastePers = config.vasteLasten.filter((v) => v.cat === "persoonlijk");

    const somVast = vasteVast.reduce((s, v) => s + bedragVan(v), 0);
    const somPers = vastePers.reduce((s, v) => s + bedragVan(v), 0);

    const weekpotVast = budgetVast - somVast;
    const weekpotPers = budgetPers - somPers;

    const perWeekVast = weekpotVast / weken.length;
    const perWeekPers = weekpotPers / weken.length;

    const uitgegevenVast = maandData.uitgaven
      .filter((u) => u.cat === "vast")
      .reduce((s, u) => s + u.bedrag, 0);
    const uitgegevenPers = maandData.uitgaven
      .filter((u) => u.cat === "persoonlijk")
      .reduce((s, u) => s + u.bedrag, 0);

    const alleVaste = [...vasteVast, ...vastePers];
    const aantalBetaald = alleVaste.filter((v) => maandData.betaald[v.id]).length;
    const openstaand = alleVaste
      .filter((v) => !maandData.betaald[v.id])
      .reduce((s, v) => s + bedragVan(v), 0);

    return {
      budgetVast, budgetPers, sparen,
      vasteVast, vastePers, bedragVan,
      somVast, somPers,
      weekpotVast, weekpotPers,
      perWeekVast, perWeekPers,
      uitgegevenVast, uitgegevenPers,
      overVast: weekpotVast - uitgegevenVast,
      overPers: weekpotPers - uitgegevenPers,
      aantalBetaald, totaalVaste: alleVaste.length, openstaand,
    };
  }, [config, maandData, weken]);

  /* ---------- acties ---------- */
  const zetBetaald = (id) => {
    const betaald = { ...maandData.betaald };
    if (betaald[id]) delete betaald[id];
    else betaald[id] = true;
    bewaarMaand({ ...maandData, betaald });
  };

  const pasBedragAan = (id, bedrag) =>
    bewaarMaand({
      ...maandData,
      bedragen: { ...maandData.bedragen, [id]: bedrag },
    });

  const voegUitgaafToe = (uitgaaf) => {
    const nieuweWinkels = config.winkels.includes(uitgaaf.naam)
      ? config.winkels
      : [uitgaaf.naam, ...config.winkels].slice(0, 60);
    if (nieuweWinkels !== config.winkels)
      bewaarConfig({ ...config, winkels: nieuweWinkels });
    bewaarMaand({
      ...maandData,
      uitgaven: [...maandData.uitgaven, { ...uitgaaf, id: Date.now() }],
    });
  };

  const verwijderUitgaaf = (id) =>
    bewaarMaand({
      ...maandData,
      uitgaven: maandData.uitgaven.filter((u) => u.id !== id),
    });

  const wisselMaand = (richting) => {
    const d = new Date(huidigeMaand);
    d.setMonth(d.getMonth() + richting);
    setHuidigeMaand(d);
  };

  /* ---------- render ---------- */
  if (laden || !config || !maandData || !b) {
    return (
      <div className="hb-root">
        <style>{CSS}</style>
        <div className="hb-laden">Even je maand ophalen…</div>
      </div>
    );
  }

  return (
    <div className="hb-root">
      <style>{CSS}</style>

      <header className="hb-top">
        <div className="hb-maandnav">
          <button className="hb-pijl" onClick={() => wisselMaand(-1)} aria-label="Vorige maand">‹</button>
          <h1>
            {MAANDEN[huidigeMaand.getMonth()]}
            <span className="hb-jaar">{huidigeMaand.getFullYear()}</span>
          </h1>
          <button className="hb-pijl" onClick={() => wisselMaand(1)} aria-label="Volgende maand">›</button>
        </div>

        <div className="hb-status">
          {b.aantalBetaald} van {b.totaalVaste} vaste lasten betaald
          {b.openstaand > 0 && <> · nog <strong>{euro(b.openstaand)}</strong> te gaan</>}
        </div>
      </header>

      {fout && <div className="hb-fout">{fout}</div>}

      <div className="hb-potten">
        <Pot titel="Vaste lasten" over={b.overVast} pot={b.weekpotVast} />
        <Pot titel="Persoonlijk" over={b.overPers} pot={b.weekpotPers} />
        <Pot titel="Sparen" over={b.sparen} pot={b.sparen} rustig />
      </div>

      <nav className="hb-tabs">
        {[
          ["weken", "Weken"],
          ["vast", "Vaste lasten"],
          ["instel", "Instellingen"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={tab === k ? "hb-tab hb-tab-aan" : "hb-tab"}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </nav>

      {tab === "weken" && (
        <Weken
          weken={weken}
          uitgaven={maandData.uitgaven}
          perWeekVast={b.perWeekVast}
          perWeekPers={b.perWeekPers}
          winkels={config.winkels}
          onToevoegen={voegUitgaafToe}
          onVerwijderen={verwijderUitgaaf}
        />
      )}

      {tab === "vast" && (
        <VasteLasten
          b={b}
          betaald={maandData.betaald}
          onToggle={zetBetaald}
          onBedrag={pasBedragAan}
        />
      )}

      {tab === "instel" && (
        <Instellingen config={config} onOpslaan={bewaarConfig} b={b} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Pot({ titel, over, pot, rustig }) {
  const negatief = over < 0;
  const perc = pot > 0 ? Math.max(0, Math.min(100, (over / pot) * 100)) : 0;
  return (
    <div className="hb-pot">
      <div className="hb-pot-titel">{titel}</div>
      <div className={negatief ? "hb-pot-bedrag hb-rood" : "hb-pot-bedrag"}>
        {euro(over)}
      </div>
      {!rustig && (
        <>
          <div className="hb-balk">
            <div
              className={negatief ? "hb-balk-vul hb-balk-rood" : "hb-balk-vul"}
              style={{ width: `${negatief ? 100 : perc}%` }}
            />
          </div>
          <div className="hb-pot-sub">van {euro(pot)}</div>
        </>
      )}
      {rustig && <div className="hb-pot-sub">opzij gezet</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Weken({ weken, uitgaven, perWeekVast, perWeekPers, winkels, onToevoegen, onVerwijderen }) {
  const vandaag = new Date();
  const actieveWeek = weekVanDatum(weken, vandaag);
  const [open, setOpen] = useState(actieveWeek);

  return (
    <div className="hb-weken">
      {weken.map((w) => {
        const eigen = uitgaven.filter((u) => u.week === w.id);
        const vast = eigen.filter((u) => u.cat === "vast").reduce((s, u) => s + u.bedrag, 0);
        const pers = eigen.filter((u) => u.cat === "persoonlijk").reduce((s, u) => s + u.bedrag, 0);
        const isOpen = open === w.id;
        const isNu = w.id === actieveWeek;

        return (
          <section key={w.id} className={isOpen ? "hb-week hb-week-open" : "hb-week"}>
            <button className="hb-week-kop" onClick={() => setOpen(isOpen ? null : w.id)}>
              <span className="hb-week-label">
                {w.label}
                {isNu && <span className="hb-nu">deze week</span>}
              </span>
              <span className="hb-week-cijfers">
                <em className={perWeekVast - vast < 0 ? "hb-rood" : ""}>
                  {euro(perWeekVast - vast)}
                </em>
                <em className={perWeekPers - pers < 0 ? "hb-rood" : ""}>
                  {euro(perWeekPers - pers)}
                </em>
              </span>
            </button>

            {isOpen && (
              <div className="hb-week-body">
                <div className="hb-kolomkop">
                  <span>over voor vaste lasten</span>
                  <span>over voor persoonlijk</span>
                </div>

                <ul className="hb-lijst">
                  {eigen.length === 0 && (
                    <li className="hb-leeg">Nog niks ingevuld deze week.</li>
                  )}
                  {eigen.map((u) => (
                    <li key={u.id} className="hb-regel">
                      <span className={`hb-dot hb-dot-${u.cat}`} />
                      <span className="hb-regel-naam">{u.naam}</span>
                      <span className="hb-regel-bedrag">{euro(u.bedrag)}</span>
                      <button
                        className="hb-wis"
                        onClick={() => onVerwijderen(u.id)}
                        aria-label={`${u.naam} verwijderen`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>

                <Invoer weekId={w.id} winkels={winkels} onToevoegen={onToevoegen} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Invoer({ weekId, winkels, onToevoegen }) {
  const [bedrag, setBedrag] = useState("");
  const [naam, setNaam] = useState("");
  const [cat, setCat] = useState("vast");
  const bedragRef = useRef(null);

  const verstuur = () => {
    const n = parseFloat(String(bedrag).replace(",", "."));
    if (!n || !naam.trim()) return;
    onToevoegen({ bedrag: n, naam: naam.trim(), cat, week: weekId });
    setBedrag("");
    setNaam("");
    bedragRef.current?.focus();
  };

  return (
    <div className="hb-invoer">
      <div className="hb-invoer-rij">
        <input
          ref={bedragRef}
          className="hb-veld hb-veld-bedrag"
          inputMode="decimal"
          placeholder="0,00"
          value={bedrag}
          onChange={(e) => setBedrag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && verstuur()}
        />
        <input
          className="hb-veld"
          placeholder="Waaraan?"
          list="hb-winkels"
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && verstuur()}
        />
        <datalist id="hb-winkels">
          {winkels.map((w) => (
            <option key={w} value={w} />
          ))}
        </datalist>
      </div>

      <div className="hb-invoer-rij">
        <div className="hb-keuze">
          <button
            className={cat === "vast" ? "hb-keuze-knop hb-keuze-aan" : "hb-keuze-knop"}
            onClick={() => setCat("vast")}
          >
            Vaste lasten
          </button>
          <button
            className={cat === "persoonlijk" ? "hb-keuze-knop hb-keuze-aan" : "hb-keuze-knop"}
            onClick={() => setCat("persoonlijk")}
          >
            Persoonlijk
          </button>
        </div>
        <button className="hb-toevoegen" onClick={verstuur}>
          Zet erbij
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function VasteLasten({ b, betaald, onToggle, onBedrag }) {
  const groepen = [
    { titel: "Vaste lasten", items: b.vasteVast, som: b.somVast },
    { titel: "Abonnementen", items: b.vastePers, som: b.somPers },
  ];

  return (
    <div className="hb-vast">
      {groepen.map((g) => (
        <section key={g.titel} className="hb-groep">
          <header className="hb-groep-kop">
            <h2>{g.titel}</h2>
            <span>{euro(g.som)}</span>
          </header>
          <ul className="hb-lijst">
            {g.items.map((v) => {
              const isBetaald = !!betaald[v.id];
              return (
                <li
                  key={v.id}
                  className={isBetaald ? "hb-regel hb-regel-betaald" : "hb-regel"}
                >
                  <button
                    className="hb-stempel"
                    onClick={() => onToggle(v.id)}
                    aria-pressed={isBetaald}
                    aria-label={`${v.naam} als betaald markeren`}
                  >
                    {isBetaald ? "V" : ""}
                  </button>
                  <span className="hb-regel-naam">{v.naam}</span>
                  <input
                    className="hb-bedragveld"
                    inputMode="decimal"
                    value={b.bedragVan(v)}
                    onChange={(e) =>
                      onBedrag(v.id, parseFloat(e.target.value.replace(",", ".")) || 0)
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="hb-hint">
        Tik op het vakje zodra iets afgeschreven is. Bedragen die deze maand
        anders zijn, pas je hier aan — volgende maand staat het weer op je
        standaardbedrag.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Instellingen({ config, onOpslaan, b }) {
  const [salaris, setSalaris] = useState(config.salaris);
  const [slices, setSlices] = useState(config.slices);
  const totaal = slices.vast + slices.persoonlijk + slices.sparen;

  const zet = (k, v) => setSlices({ ...slices, [k]: Number(v) || 0 });

  return (
    <div className="hb-instel">
      <label className="hb-label">
        Salaris per maand
        <input
          className="hb-veld"
          inputMode="decimal"
          value={salaris}
          onChange={(e) => setSalaris(parseFloat(e.target.value.replace(",", ".")) || 0)}
        />
      </label>

      <div className="hb-slices">
        {[
          ["vast", "Vaste lasten"],
          ["persoonlijk", "Persoonlijk"],
          ["sparen", "Sparen"],
        ].map(([k, l]) => (
          <label key={k} className="hb-label">
            {l}
            <div className="hb-perc">
              <input
                className="hb-veld"
                inputMode="numeric"
                value={slices[k]}
                onChange={(e) => zet(k, e.target.value)}
              />
              <span>%</span>
            </div>
            <small>{euro((salaris * slices[k]) / 100)}</small>
          </label>
        ))}
      </div>

      <div className={totaal === 100 ? "hb-totaal" : "hb-totaal hb-rood"}>
        Samen {totaal}%{totaal !== 100 && " — dit moet 100% zijn"}
      </div>

      <button
        className="hb-toevoegen hb-breed"
        disabled={totaal !== 100}
        onClick={() => onOpslaan({ ...config, salaris, slices })}
      >
        Bewaar
      </button>

      <div className="hb-uitleg">
        <h3>Hoe de weekpot werkt</h3>
        <p>
          Van je vaste-lastenbudget ({euro(b.budgetVast)}) gaan de vaste lasten
          af ({euro(b.somVast)}). Wat overblijft ({euro(b.weekpotVast)}) verdeelt
          zich over de weken. Zelfde verhaal voor persoonlijk.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

.hb-root {
  --papier: #E9EDE4;
  --papier-op: #F6F8F2;
  --inkt: #1B2A24;
  --inkt-zacht: #5C6B62;
  --lijn: #C6D0BE;
  --stempel: #8C2F39;
  --rood: #B23A2F;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  background: var(--papier);
  color: var(--inkt);
  min-height: 100vh;
  padding: 20px 16px 64px;
  max-width: 640px;
  margin: 0 auto;
  -webkit-font-smoothing: antialiased;
}

.hb-laden { padding: 48px 0; text-align: center; color: var(--inkt-zacht); }

.hb-top { border-bottom: 2px solid var(--inkt); padding-bottom: 12px; margin-bottom: 18px; }
.hb-maandnav { display: flex; align-items: baseline; justify-content: center; gap: 14px; }
.hb-maandnav h1 {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 34px; font-weight: 400; margin: 0; letter-spacing: -0.01em;
}
.hb-jaar { font-size: 16px; color: var(--inkt-zacht); margin-left: 8px; font-family: 'IBM Plex Mono', monospace; }
.hb-pijl {
  background: none; border: none; font-size: 26px; line-height: 1;
  color: var(--inkt-zacht); cursor: pointer; padding: 4px 10px; border-radius: 4px;
}
.hb-pijl:hover { color: var(--inkt); }
.hb-pijl:focus-visible, .hb-tab:focus-visible, .hb-stempel:focus-visible,
.hb-veld:focus-visible, .hb-toevoegen:focus-visible, .hb-keuze-knop:focus-visible {
  outline: 2px solid var(--stempel); outline-offset: 2px;
}
.hb-status { text-align: center; font-size: 13px; color: var(--inkt-zacht); margin-top: 6px; }
.hb-status strong { font-family: 'IBM Plex Mono', monospace; color: var(--inkt); }

.hb-fout {
  background: #F7E4E2; border-left: 3px solid var(--rood);
  padding: 10px 12px; font-size: 13px; margin-bottom: 14px;
}

.hb-potten { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 22px; }
.hb-pot { background: var(--papier-op); border: 1px solid var(--lijn); padding: 12px 10px; }
.hb-pot-titel { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--inkt-zacht); }
.hb-pot-bedrag {
  font-family: 'IBM Plex Mono', monospace; font-size: 19px; font-weight: 500;
  margin: 6px 0 8px; font-variant-numeric: tabular-nums;
}
.hb-rood { color: var(--rood); }
.hb-balk { height: 3px; background: var(--lijn); }
.hb-balk-vul { height: 100%; background: var(--inkt); }
.hb-balk-rood { background: var(--rood); }
.hb-pot-sub { font-size: 11px; color: var(--inkt-zacht); margin-top: 6px; font-family: 'IBM Plex Mono', monospace; }

.hb-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--lijn); margin-bottom: 16px; }
.hb-tab {
  background: none; border: none; padding: 10px 14px; font-size: 14px;
  color: var(--inkt-zacht); cursor: pointer; border-bottom: 2px solid transparent;
  font-family: inherit;
}
.hb-tab-aan { color: var(--inkt); border-bottom-color: var(--stempel); font-weight: 500; }

.hb-week { border-bottom: 1px solid var(--lijn); }
.hb-week-kop {
  width: 100%; background: none; border: none; padding: 13px 2px;
  display: flex; justify-content: space-between; align-items: center;
  cursor: pointer; font-family: inherit; font-size: 15px; color: var(--inkt); text-align: left;
}
.hb-week-label { display: flex; align-items: center; gap: 8px; }
.hb-nu {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
  background: var(--inkt); color: var(--papier); padding: 2px 6px;
}
.hb-week-cijfers { display: flex; gap: 14px; font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-style: normal; }
.hb-week-cijfers em { font-style: normal; font-variant-numeric: tabular-nums; }
.hb-week-open { background: var(--papier-op); }
.hb-week-body { padding: 0 2px 16px; }
.hb-kolomkop {
  display: flex; justify-content: flex-end; gap: 14px;
  font-size: 10px; color: var(--inkt-zacht); text-transform: uppercase;
  letter-spacing: 0.05em; margin-bottom: 10px;
}

.hb-lijst { list-style: none; margin: 0; padding: 0; }
.hb-regel {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 0; border-bottom: 1px solid var(--lijn);
}
.hb-regel:last-child { border-bottom: none; }
.hb-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.hb-dot-vast { background: var(--inkt); }
.hb-dot-persoonlijk { background: var(--stempel); }
.hb-regel-naam { flex: 1; font-size: 14px; }
.hb-regel-bedrag { font-family: 'IBM Plex Mono', monospace; font-size: 14px; font-variant-numeric: tabular-nums; }
.hb-wis {
  background: none; border: none; color: var(--inkt-zacht); font-size: 18px;
  cursor: pointer; padding: 0 4px; line-height: 1;
}
.hb-wis:hover { color: var(--rood); }
.hb-leeg { color: var(--inkt-zacht); font-size: 13px; padding: 10px 0; font-style: italic; }

.hb-invoer { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
.hb-invoer-rij { display: flex; gap: 8px; }
.hb-veld {
  flex: 1; min-width: 0; padding: 10px; font-size: 15px;
  border: 1px solid var(--lijn); background: #fff; color: var(--inkt);
  font-family: inherit; border-radius: 0;
}
.hb-veld-bedrag { max-width: 110px; font-family: 'IBM Plex Mono', monospace; }
.hb-keuze { display: flex; flex: 1; }
.hb-keuze-knop {
  flex: 1; padding: 9px 6px; font-size: 13px; cursor: pointer;
  border: 1px solid var(--lijn); background: #fff; color: var(--inkt-zacht);
  font-family: inherit;
}
.hb-keuze-knop + .hb-keuze-knop { border-left: none; }
.hb-keuze-aan { background: var(--inkt); color: var(--papier); border-color: var(--inkt); }
.hb-toevoegen {
  padding: 9px 18px; background: var(--stempel); color: #fff; border: none;
  font-size: 14px; cursor: pointer; font-family: inherit;
}
.hb-toevoegen:disabled { background: var(--lijn); color: var(--inkt-zacht); cursor: not-allowed; }
.hb-breed { width: 100%; padding: 12px; margin-top: 6px; }

.hb-groep { margin-bottom: 26px; }
.hb-groep-kop {
  display: flex; justify-content: space-between; align-items: baseline;
  border-bottom: 2px solid var(--inkt); padding-bottom: 6px; margin-bottom: 4px;
}
.hb-groep-kop h2 { font-family: 'Instrument Serif', serif; font-size: 21px; font-weight: 400; margin: 0; }
.hb-groep-kop span { font-family: 'IBM Plex Mono', monospace; font-size: 14px; }

.hb-stempel {
  width: 26px; height: 26px; flex-shrink: 0; cursor: pointer;
  border: 1px solid var(--lijn); background: #fff;
  font-family: 'Instrument Serif', serif; font-size: 19px; line-height: 1;
  color: var(--stempel); padding: 0;
  display: flex; align-items: center; justify-content: center;
}
.hb-regel-betaald .hb-stempel {
  transform: rotate(-9deg); border-color: var(--stempel); background: transparent;
}
.hb-regel-betaald .hb-regel-naam,
.hb-regel-betaald .hb-bedragveld { color: var(--inkt-zacht); }
.hb-bedragveld {
  width: 78px; text-align: right; border: none; background: transparent;
  font-family: 'IBM Plex Mono', monospace; font-size: 14px; color: var(--inkt);
  font-variant-numeric: tabular-nums; padding: 4px;
}
.hb-bedragveld:focus { background: #fff; outline: 1px solid var(--lijn); }
.hb-hint { font-size: 12px; color: var(--inkt-zacht); line-height: 1.6; }

.hb-instel { display: flex; flex-direction: column; gap: 16px; }
.hb-label { display: flex; flex-direction: column; gap: 5px; font-size: 13px; color: var(--inkt-zacht); }
.hb-label small { font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
.hb-slices { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.hb-perc { display: flex; align-items: center; gap: 5px; }
.hb-perc .hb-veld { font-family: 'IBM Plex Mono', monospace; }
.hb-totaal { font-size: 13px; color: var(--inkt-zacht); }
.hb-uitleg { border-top: 1px solid var(--lijn); padding-top: 14px; margin-top: 6px; }
.hb-uitleg h3 { font-family: 'Instrument Serif', serif; font-weight: 400; font-size: 18px; margin: 0 0 6px; }
.hb-uitleg p { font-size: 13px; line-height: 1.6; color: var(--inkt-zacht); margin: 0; }

@media (max-width: 420px) {
  .hb-potten { grid-template-columns: 1fr 1fr; }
  .hb-pot:last-child { grid-column: span 2; }
  .hb-week-cijfers { font-size: 12px; gap: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
`;
