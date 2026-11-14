import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Backend } from "./data/backend";
import { Boek } from "./data/boek";
import { maakGeheugenBackend } from "./data/geheugenBackend";
import { DEMO, supabase } from "./data/supabase";
import { maakSupabaseBackend } from "./data/supabaseBackend";
import { formatKort, jaarVan } from "./logica/datum";
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
  ["overzicht", "Overzicht"],
  ["vast", "Vaste lasten"],
  ["extra", "Extra"],
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

export function App() {
  if (DEMO) return <MetBoek sleutel="demo" backend={demoBackend()} />;
  if (!supabase) return <NietIngesteld />;
  return <MetSessie />;
}

let demo: Backend | null = null;
function demoBackend(): Backend {
  if (!demo) {
    const b = maakGeheugenBackend();
    // Alleen in demo-modus: opslaan laten mislukken om de foutmelding te zien.
    (window as unknown as Record<string, unknown>).hbDemoMislukken = b.laatMislukken;
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
  // undefined = nog aan het kijken of er een bewaarde sessie is
  const [sessie, setSessie] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    void sb.auth.getSession().then(({ data }) => setSessie(data.session));
    const { data } = sb.auth.onAuthStateChange((_gebeurtenis, s) => setSessie(s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  const backend = useMemo(() => maakSupabaseBackend(sb), [sb]);

  if (sessie === undefined) return <Laden tekst="Even kijken of je nog ingelogd bent…" />;
  if (!sessie) return <Inloggen supabase={sb} />;
  return (
    <MetBoek
      sleutel={sessie.user.id}
      backend={backend}
      onUitloggen={() => void sb.auth.signOut()}
    />
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
  onUitloggen,
}: {
  sleutel: string;
  backend: Backend;
  onUitloggen?: () => void;
}) {
  // Eén Boek per ingelogde gebruiker.
  const boek = useMemo(() => new Boek(backend), [sleutel, backend]);
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

  // Waarschuw bij sluiten zolang er nog iets niet is opgeslagen.
  const wachtend = s.opslag.wachtend;
  useEffect(() => {
    if (wachtend === 0) return;
    const op = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", op);
    return () => window.removeEventListener("beforeunload", op);
  }, [wachtend]);

  if (s.fase === "laden") return <Laden tekst="Even je periode ophalen…" />;
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

  const { periode, overzicht, isLopende, bewerkbaar } = beeld;
  const index = s.periodes.findIndex((p) => p.id === periode?.id);
  const vorige = index > 0 ? s.periodes[index - 1] : undefined;
  const volgende = index >= 0 ? s.periodes[index + 1] : undefined;
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
        {overzicht && (
          <div className="hb-status">
            {overzicht.status.betaald} van {overzicht.status.totaal} betaald
            {overzicht.status.openstaand > 0 && (
              <>
                {" "}
                · nog <strong>{formatEuro(overzicht.status.openstaand)}</strong> te gaan
              </>
            )}
          </div>
        )}
      </header>

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
            {!bewerkbaar && (
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
