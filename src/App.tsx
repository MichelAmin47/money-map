import { useEffect, useMemo, useState } from "react";
import type { Backend } from "./data/backend";
import { Boek } from "./data/boek";
import { maakGeheugenBackend, type DemoStoring } from "./data/geheugenBackend";
import {
  leesBewaardeGebruiker,
  leesMomentopname,
  standaardOpslag,
  wisMomentopname,
  type Opslag,
} from "./data/momentopname";
import { DEMO, SESSIE_SLEUTEL, supabase } from "./data/supabase";
import { maakSupabaseBackend } from "./data/supabaseBackend";
import { isStoring, metTijdslimiet } from "./data/tijdslimiet";
import { formatKort, formatMoment, jaarVan } from "./logica/datum";
import { formatEuro } from "./logica/geld";
import { BoekContext, useBeeld, useBoek, useStaat } from "./ui/context";
import { Inloggen } from "./ui/Inloggen";
import { NieuwePeriode } from "./ui/NieuwePeriode";
import { SaldoBlad } from "./ui/SaldoBlad";
import { Extra } from "./ui/schermen/Extra";
import { Instellingen } from "./ui/schermen/Instellingen";
import { Overzicht } from "./ui/schermen/Overzicht";
import { Vandaag } from "./ui/schermen/Vandaag";
import { VasteLasten } from "./ui/schermen/VasteLasten";
import { Weken } from "./ui/schermen/Weken";

const TABS = [
  ["vandaag", "Vandaag"],
  ["weken", "Weken"],
  ["vast", "Vaste lasten"],
  ["extra", "Extra"],
  ["overzicht", "Overzicht"],
  // Kort label: met zes tabs past "Instellingen" niet op 360px.
  ["instellingen", "Instellen", "Instellingen"],
] as const;
type Tab = (typeof TABS)[number][0];

// Tabs via de hash (#/weken): werkt op GitHub Pages zonder 404 bij verversen.
const tabUitHash = (): Tab => {
  const naam = window.location.hash.replace(/^#\/?/, "");
  return TABS.some(([k]) => k === naam) ? (naam as Tab) : "vandaag";
};

function useTab(): Tab {
  const [tab, setTab] = useState(tabUitHash);
  useEffect(() => {
    const op = () => {
      setTab(tabUitHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", op);
    return () => window.removeEventListener("hashchange", op);
  }, []);
  return tab;
}

/** Hoe vaak de app het bij een storing op de achtergrond opnieuw probeert. */
const OPNIEUW_MS = 30_000;

export function App() {
  if (DEMO) {
    return <MetBoek sleutel="demo" backend={demoBackend()} opslag={standaardOpslag()} />;
  }
  if (!supabase) return <NietIngesteld />;
  return <MetSessie />;
}

let demo: Backend | null = null;
function demoBackend(): Backend {
  if (!demo) {
    // Storingsmodus: ?storing=1 laat elk verzoek hangen, ?storing=fout geeft
    // meteen een netwerkfout. In de console zet hbDemoStoring(false) hem uit.
    const param = new URLSearchParams(window.location.search).get("storing");
    const stand: DemoStoring = param === "fout" ? "fout" : param ? "hangen" : "uit";
    const b = maakGeheugenBackend(stand);
    // Alleen in demo-modus: opslaan laten mislukken om de foutmelding te zien.
    const w = window as unknown as Record<string, unknown>;
    w.hbDemoMislukken = b.laatMislukken;
    w.hbDemoStoring = (aan: boolean | DemoStoring) =>
      b.zetStoring(aan === true ? "hangen" : aan === false ? "uit" : aan);
    demo = b;
  }
  return demo;
}

function NietIngesteld() {
  return (
    <main className="hb-root hb-inlog">
      <h1>Huishoudboek</h1>
      <p className="hb-veldfout">
        De app is nog niet gekoppeld aan Supabase. Zet <code>VITE_SUPABASE_URL</code> en{" "}
        <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code> (lokaal) of als
        GitHub Actions secrets (deploy). Zie de README.
      </p>
    </main>
  );
}

function MetSessie() {
  const sb = supabase!;
  const opslag = useMemo(standaardOpslag, []);
  // De login staat op dit toestel; die lezen we zonder netwerk, zodat een
  // hangende Auth het opstarten niet tegenhoudt. undefined = nog onbekend,
  // null = niet ingelogd, anders de user_id.
  const [gebruiker, setGebruiker] = useState<string | null | undefined>(
    () => leesBewaardeGebruiker(opslag, SESSIE_SLEUTEL) ?? undefined,
  );
  const [storing, setStoring] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [poging, setPoging] = useState(0);
  const onbekend = gebruiker === undefined;

  // Geen leesbare login op het toestel: vraag het aan Supabase, met tijdslimiet.
  useEffect(() => {
    if (!onbekend) return;
    let weg = false;
    setBezig(true);
    metTijdslimiet(sb.auth.getSession())
      .then(
        ({ data, error }) => {
          if (weg) return;
          if (data.session) setGebruiker(data.session.user.id);
          // Verlengen lukte niet door een storing: de login blijft bewaard.
          else if (error && isStoring(error)) setStoring(true);
          else setGebruiker(null);
        },
        () => !weg && setStoring(true),
      )
      .finally(() => !weg && setBezig(false));
    return () => {
      weg = true;
    };
  }, [sb, onbekend, poging]);

  // Ook hier af en toe opnieuw proberen, en als de app weer in beeld komt.
  useEffect(() => {
    if (!onbekend || !storing) return;
    const probeer = () => setPoging((n) => n + 1);
    const zichtbaar = () => document.visibilityState === "visible" && probeer();
    const klok = window.setInterval(probeer, OPNIEUW_MS);
    document.addEventListener("visibilitychange", zichtbaar);
    return () => {
      window.clearInterval(klok);
      document.removeEventListener("visibilitychange", zichtbaar);
    };
  }, [onbekend, storing]);

  useEffect(() => {
    const { data } = sb.auth.onAuthStateChange((gebeurtenis, s) => {
      if (s) {
        setStoring(false);
        setGebruiker(s.user.id);
      } else if (gebeurtenis === "SIGNED_OUT") {
        // Alleen een echte uitlog telt. Bij een storing meldt Supabase soms een
        // lege INITIAL_SESSION terwijl de login gewoon bewaard blijft.
        wisMomentopname(opslag);
        setGebruiker(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [sb, opslag]);

  // Zonder login hoort er geen momentopname te zijn; van een ander account
  // wordt hij bij het lezen gewist.
  useEffect(() => {
    if (gebruiker === null) wisMomentopname(opslag);
    else if (gebruiker) leesMomentopname(opslag, gebruiker);
  }, [gebruiker, opslag]);

  const backend = useMemo(() => maakSupabaseBackend(sb), [sb]);

  if (onbekend) {
    if (!storing) return <Laden tekst="Even kijken of je nog ingelogd bent…" />;
    return <StoringScherm bezig={bezig} onOpnieuw={() => setPoging((n) => n + 1)} />;
  }
  if (!gebruiker) return <Inloggen supabase={sb} />;
  return (
    <MetBoek
      sleutel={gebruiker}
      backend={backend}
      opslag={opslag}
      onUitloggen={() => {
        wisMomentopname(opslag);
        setGebruiker(null);
        // Alleen op dit toestel uitloggen: dat lukt ook zonder verbinding.
        void sb.auth.signOut({ scope: "local" });
      }}
    />
  );
}

/** Supabase reageert niet en er is niets bewaard om te tonen. */
function StoringScherm({ onOpnieuw, bezig = false }: { onOpnieuw: () => void; bezig?: boolean }) {
  return (
    <main className="hb-root">
      <div className="hb-storing hb-storing-scherm" role="alert">
        <h2>Supabase reageert niet</h2>
        <p>Je gegevens zijn veilig; probeer het zo opnieuw.</p>
        <p className="hb-hint">Je blijft ingelogd. De app probeert het zelf ook elke halve minuut.</p>
        <button className="hb-knop hb-knop-hoofd" disabled={bezig} onClick={onOpnieuw}>
          {bezig ? "Bezig…" : "Opnieuw proberen"}
        </button>
      </div>
    </main>
  );
}

function Laden({ tekst }: { tekst: string }) {
  return (
    <main className="hb-root">
      <div className="hb-laden">{tekst}</div>
    </main>
  );
}

function MetBoek({
  sleutel,
  backend,
  opslag,
  onUitloggen,
}: {
  sleutel: string;
  backend: Backend;
  opslag: Opslag | null;
  onUitloggen?: () => void;
}) {
  // Eén Boek per ingelogde gebruiker.
  const boek = useMemo(
    () => new Boek(backend, { gebruiker: sleutel, opslag }),
    [sleutel, backend, opslag],
  );
  useEffect(() => {
    void boek.laad();
  }, [boek]);
  return (
    <BoekContext.Provider value={boek}>
      <Schil onUitloggen={onUitloggen} />
    </BoekContext.Provider>
  );
}

function Schil({ onUitloggen }: { onUitloggen?: () => void }) {
  const boek = useBoek();
  const s = useStaat();
  const beeld = useBeeld();
  const tab = useTab();
  const [nieuwePeriode, setNieuwePeriode] = useState(false);
  const [saldoOpen, setSaldoOpen] = useState(false);

  // Zodra er weer verbinding is: wachtende wijzigingen opnieuw proberen.
  useEffect(() => {
    window.addEventListener("online", boek.opnieuwOpslaan);
    return () => window.removeEventListener("online", boek.opnieuwOpslaan);
  }, [boek]);

  // Storing bij het opstarten: af en toe opnieuw proberen, en meteen als de
  // app weer in beeld komt of er weer verbinding is.
  const storing = s.alleenLezen != null || (s.fase === "fout" && s.laadStoring);
  useEffect(() => {
    if (!storing) return;
    const probeer = () => void boek.laad({ stil: true });
    const zichtbaar = () => document.visibilityState === "visible" && probeer();
    const klok = window.setInterval(probeer, OPNIEUW_MS);
    document.addEventListener("visibilitychange", zichtbaar);
    window.addEventListener("online", probeer);
    return () => {
      window.clearInterval(klok);
      document.removeEventListener("visibilitychange", zichtbaar);
      window.removeEventListener("online", probeer);
    };
  }, [boek, storing]);

  // Waarschuw bij sluiten zolang er nog iets niet is opgeslagen.
  const wachtend = s.opslag.wachtend;
  useEffect(() => {
    if (wachtend === 0) return;
    const op = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", op);
    return () => window.removeEventListener("beforeunload", op);
  }, [wachtend]);

  if (s.fase === "laden") return <Laden tekst="Even je periode ophalen…" />;
  if (s.fase === "fout" && s.laadStoring) {
    return <StoringScherm bezig={s.opnieuwBezig} onOpnieuw={() => void boek.laad({ stil: true })} />;
  }
  if (s.fase === "fout") {
    return (
      <main className="hb-root">
        <div className="hb-fout" role="alert">
          <p>Je gegevens ophalen lukte niet. Heb je verbinding?</p>
          <p className="hb-fout-detail">{s.laadFout}</p>
          <button className="hb-knop hb-knop-hoofd" onClick={() => void boek.laad()}>
            Opnieuw proberen
          </button>
        </div>
      </main>
    );
  }

  const { periode, overzicht, isLopende, bewerkbaar, alleenLezen } = beeld;
  // Alleen lezen: bladeren kan alleen naar periodes die in de momentopname zitten.
  const periodes = alleenLezen ? s.periodes.filter((p) => s.data[p.id]) : s.periodes;
  const index = periodes.findIndex((p) => p.id === periode?.id);
  const vorige = index > 0 ? periodes[index - 1] : undefined;
  const volgende = index >= 0 ? periodes[index + 1] : undefined;
  const lopende = s.periodes.at(-1);
  const openNieuwePeriode = () => setNieuwePeriode(true);

  return (
    <div className={tab === "overzicht" ? "hb-root hb-root-breed" : "hb-root"}>
      <header className="hb-top">
        <div className="hb-periodenav">
          <button
            className="hb-pijl"
            disabled={!vorige}
            onClick={() => vorige && void boek.kiesPeriode(vorige.id)}
            aria-label="Vorige periode"
          >
            ‹
          </button>
          <h1>
            {periode ? (
              <>
                {formatKort(periode.startdatum)} – {formatKort(periode.einddatum)}
                <span className="hb-jaar">{jaarVan(periode.einddatum)}</span>
              </>
            ) : (
              "Huishoudboek"
            )}
          </h1>
          <button
            className="hb-pijl"
            disabled={!volgende}
            onClick={() => volgende && void boek.kiesPeriode(volgende.id)}
            aria-label="Volgende periode"
          >
            ›
          </button>
        </div>
        {overzicht && (
          <button
            className="hb-saldo"
            onClick={() => setSaldoOpen(true)}
            aria-label={`Saldo ${formatEuro(overzicht.saldo.saldo)}: opbouw bekijken`}
          >
            <span className="hb-saldo-label">Saldo</span>
            <span
              className={
                overzicht.saldo.saldo < 0 ? "hb-saldo-bedrag hb-rood" : "hb-saldo-bedrag"
              }
            >
              {formatEuro(overzicht.saldo.saldo)}
            </span>
          </button>
        )}
      </header>

      {s.alleenLezen && (
        <div className="hb-storing" role="status">
          <p>
            <strong>Geen verbinding · gegevens van {formatMoment(new Date(s.alleenLezen.bewaardOp))}</strong>
          </p>
          <p>
            Alleen lezen. Invoeren kan weer zodra Supabase reageert; de app probeert het zelf elke
            halve minuut.
          </p>
          <button
            className="hb-knop hb-knop-hoofd"
            disabled={s.opnieuwBezig}
            onClick={() => void boek.laad({ stil: true })}
          >
            {s.opnieuwBezig ? "Bezig…" : "Opnieuw proberen"}
          </button>
        </div>
      )}

      {s.opslag.fout && (
        <div className="hb-fout" role="alert">
          <p>
            <strong>Opslaan lukte niet.</strong>{" "}
            {s.opslag.wachtend > 0 &&
              `${s.opslag.wachtend} ${s.opslag.wachtend === 1 ? "wijziging staat" : "wijzigingen staan"} nog alleen op dit toestel. Houd de app open.`}
          </p>
          <p className="hb-fout-detail">{s.opslag.fout}</p>
          <button className="hb-knop hb-knop-hoofd" onClick={boek.opnieuwOpslaan}>
            Opnieuw proberen
          </button>
        </div>
      )}

      {periode && !isLopende && (
        <div className="hb-melding">
          <p>
            {bewerkbaar
              ? "Eerdere periode, nu bewerkbaar."
              : "Eerdere periode: alleen-lezen."}
          </p>
          <div className="hb-melding-knoppen">
            {!bewerkbaar && !alleenLezen && (
              <button
                className="hb-knop hb-knop-rustig"
                onClick={() => {
                  if (
                    window.confirm(
                      "Deze periode is afgesloten. Wil je hem toch bewerken? Wijzigingen veranderen de cijfers van toen.",
                    )
                  ) {
                    boek.ontgrendel(periode.id);
                  }
                }}
              >
                Toch bewerken
              </button>
            )}
            {lopende && (
              <button
                className="hb-knop hb-knop-rustig"
                onClick={() => void boek.kiesPeriode(lopende.id)}
              >
                Naar lopende periode
              </button>
            )}
          </div>
        </div>
      )}

      <main key={periode?.id ?? "geen"} className={s.periodeLaden ? "hb-bezig" : undefined}>
        {s.periodeLaden ? (
          <div className="hb-laden">Periode ophalen…</div>
        ) : (
          <>
            {tab === "vandaag" && <Vandaag />}
            {tab === "weken" && <Weken />}
            {tab === "overzicht" && <Overzicht />}
            {tab === "vast" && <VasteLasten />}
            {tab === "extra" && <Extra />}
            {tab === "instellingen" && (
              <Instellingen
                onNieuwePeriode={openNieuwePeriode}
                onSaldo={() => setSaldoOpen(true)}
                onUitloggen={onUitloggen}
              />
            )}
          </>
        )}
      </main>

      <nav className="hb-tabs" aria-label="Schermen">
        {TABS.map(([k, l, voluit]) => (
          <a
            key={k}
            href={`#/${k}`}
            className={tab === k ? "hb-tab hb-tab-aan" : "hb-tab"}
            aria-current={tab === k ? "page" : undefined}
            aria-label={voluit}
          >
            {l}
          </a>
        ))}
      </nav>

      {nieuwePeriode && <NieuwePeriode onSluit={() => setNieuwePeriode(false)} />}
      {saldoOpen && periode && overzicht && (
        <SaldoBlad
          periode={periode}
          saldo={overzicht.saldo}
          bewerkbaar={bewerkbaar}
          onSluit={() => setSaldoOpen(false)}
        />
      )}
    </div>
  );
}
