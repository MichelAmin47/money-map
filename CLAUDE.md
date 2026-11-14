# CLAUDE.md

Leidend document voor wie aan deze repo werkt. Het beschrijft wat er nu staat.
`BRIEF.md` is de oorspronkelijke opdracht en is op punten verouderd; bij
verschil geldt dit bestand. `README.md` is de installatiehandleiding voor de
gebruiker (Supabase, GitHub, telefoon).

## Wat de app is

Huishoudboek (repo `money-map`) is een persoonlijk huishoudboek voor **één
gebruiker**. Het vervangt een Google Sheet die hij elke maand met de hand
bijhield.

- De gebruiker voert alles zelf in. Er is **geen bankkoppeling en geen
  CSV-import, en dat blijft zo**. Stel het niet voor en bouw het niet.
- Het belangrijkste gebruik is **snel een uitgave invoeren op een iPhone**, met
  de app op het beginscherm (PWA, standalone). Elke wijziging moet daar goed
  werken: numeriek toetsenbord, grote tikvlakken, weinig tikken.
- De app draait in productie en wordt dagelijks gebruikt. Wijzigingen mogen
  bestaande gegevens niet breken.

## Regels

1. **Geen persoonlijke data in de repo.** De repo is publiek. Geen salaris,
   geen saldo, geen namen of bedragen van vaste lasten: niet in code, niet in
   migraties, niet in seed-data en niet in tests. Tests gebruiken verzonnen
   namen en ronde bedragen; de enige uitzonderingen zijn de controlegetallen
   uit de sheet die de gebruiker zelf als test heeft opgegeven (zie "Tests").
   Echte gegevens komen binnen via *Instellingen → Importeer startdata* en via
   invoer in de app. `startdata.json` staat in `.gitignore`.
2. **Alles in het Nederlands**: teksten in de app, namen in de code
   (`weekblokken`, `bewaarPeriode`), commentaar, commits en documentatie.
   Bedragen in `nl-NL`-notatie (`€ 1.234,56`); invoer met een komma moet
   werken (`parseBedrag` in `src/logica/geld.ts`).
3. **Eerst mobiel, vanaf 360px breed.** Tikvlakken minimaal 44px (`--tik`),
   invoervelden 16px lettergrootte (anders zoomt iOS in), zichtbare focus,
   `prefers-reduced-motion` wordt gerespecteerd. Controleer schermen in
   demo-modus op 360px.
4. **Tests voor rekenlogica en datalaag.** Elke wijziging in `src/logica` of
   `src/data` krijgt Vitest-tests. `npm test`, `npm run typecheck` en
   `npm run build` moeten slagen.
5. **Migraties voer je niet uit.** Zie "Supabase".
6. **Bedragen in centen** in alle TypeScript-code (zie "Architectuur").

## Commando's

```bash
npm install
npm run dev                  # http://localhost:5173/money-map/ (heeft .env.local nodig)
VITE_DEMO=true npm run dev   # demo-modus: geen Supabase, geen login, data in localStorage
npm test                     # Vitest, eenmalig
npm run typecheck            # tsc --noEmit
npm run build                # typecheck + productie-build in dist/
```

Demo-modus bewaart alles in `localStorage` onder de sleutel `hb-demo`. In de
console zet `hbDemoMislukken(true)` het opslaan op "mislukt", om de foutmelding
en "Opnieuw proberen" te zien. Zonder `.env.local` en zonder demo-modus toont
de app een scherm "nog niet gekoppeld".

## Domeinbegrippen en rekenregels

Alle rekenlogica staat in `src/logica/` en is puur (geen React, geen opslag).

### Periode

Een periode loopt **van salaris tot salaris**, niet per kalendermaand.

- `Periode` (`overzicht.ts`): `startdatum`, `einddatum` (de laatste dag, dus de
  dag vóór het volgende salaris), en een **snapshot** van `salaris`,
  `verdeling`, `weekStartDag`, plus `startsaldo`.
- Starten gaat met "Nieuwe periode starten" (`ui/NieuwePeriode.tsx` →
  `Boek.startPeriode`). De knop staat **alleen in Instellingen**; Vandaag
  verwijst er alleen met een link naar (welkomstscherm en "periode voorbij"). De gebruiker kiest de startdatum (standaard vandaag),
  de verwachte volgende salarisdatum (standaard één maand later, `plusMaand`)
  en het startsaldo.
- Komt het salaris eerder dan verwacht, dan wordt de vorige periode ingekort
  tot de dag vóór de nieuwe startdatum.
- De **lopende periode** is altijd de laatst gestarte (`periodes.at(-1)`).
  Eerdere periodes zijn alleen-lezen; na "Toch bewerken" (met bevestiging) zijn
  ze voor die sessie bewerkbaar (`Staat.ontgrendeld`).
- Instellingen bewaren werkt ook de snapshot van de lopende periode bij
  (`Boek.werkLopendeBij`). Eerdere periodes houden hun eigen snapshot.
- Een uitgave hoort bij een periode via `periodeId`, niet via zijn datum.

### Weekblokken (`weken.ts`)

`weekblokken(start, eind, weekStartDag)` deelt een periode op.

- De **startdag van de week is instelbaar** (0 = zondag … 6 = zaterdag). De
  standaard in de code en de database is zaterdag (zoals de sheet); de
  gebruiker heeft hem nu op **maandag** staan.
- Een blok begint op elke startdag die binnen de periode valt. Een periode van
  een maand heeft daardoor altijd 4 of 5 blokken, en geen week telt in twee
  periodes mee.
- **Eerste blok:** begint op de startdatum van de periode. Dagen vóór de eerste
  startdag horen bij blok 1, dat daardoor langer dan 7 dagen kan zijn.
- **Laatste blok:** eindigt op de einddatum van de periode en is dus meestal
  korter dan 7 dagen. De dagen erna horen bij de volgende periode.
- Voorbeeld (in de tests): 13 nov t/m 17 dec met startdag maandag geeft
  "13 t/m 22", "23 t/m 29", "30 t/m 6", "7 t/m 13", "14 t/m 17".
- Valt er geen startdag in de periode, dan is er één blok voor de hele periode.
- `weekIndexVoorDatum(blokken, datum)`: het laatste blok waarvan de start op of
  vóór de datum ligt. Een datum vóór de periode telt in blok 1, een datum erna
  in het laatste blok.
- De weekindeling wordt nergens opgeslagen; hij wordt steeds uit de datums
  berekend.

### De drie potten (`potten.ts`)

Het salaris wordt verdeeld over drie potten; standaard **62 / 25 / 13**, per
periode instelbaar (de som moet 100 zijn, `verdelingKlopt`).

| Pot (`Pot`) | In de app | Gebruik |
| --- | --- | --- |
| `vast` | Vaste lasten | vaste lasten, daarna de weekpot voor boodschappen e.d. |
| `persoonlijk` | Persoonlijk | abonnementen en termijnen, daarna de weekpot voor hobby, uit eten, kleding |
| `extra` | Extra | eenmalige grotere uitgaven en ontvangen geld; wat overblijft is wat echt gespaard wordt |

`verdeelPotten` rondt elke pot afzonderlijk af op hele centen, net als de
sheet. `WeekPot` is `vast | persoonlijk`: alleen die twee hebben een weekpot en
vaste lasten.

### Weekpot en doorschuiven (`potten.ts`, `overzicht.ts`)

- **Weekpot** = pot − vaste lasten in die pot (alle regels van de periode, met
  of zonder V). `weekpot()`.
- De weekpot wordt gelijk over de blokken verdeeld (`verdeelOverWeken`); centen
  die niet te delen zijn gaan naar de eerste weken, zodat de som exact klopt.
- **Doorschuiven** (`schuifDoor`): wat een week overhoudt gaat naar de volgende
  week; een tekort gaat er daar af. Per week en per pot levert dat een
  `WeekStand`: `basis` (weekbedrag), `doorgeschoven`, `beschikbaar`
  (basis + doorgeschoven), `uitgegeven`, `over` (schuift door) en `eigenOver`
  (basis − uitgegeven, zonder doorschuiven).
- De **kop van een week** toont `eigenOver`, ingeklapt en opengeklapt. Een
  **opengeklapte week** heeft de kolomnamen boven die bedragen en, als er iets
  is doorgeschoven, één kleine regel eronder: per kolom `doorgeschoven`
  ("+ € 45,00" of "− € 12,00", `formatMetTeken`) met daaronder `over` ("samen
  over"). Een kolom met €0 doorgeschoven blijft leeg; zijn beide €0, dan staat
  de regel er niet. Daaronder staan de uitgaven.
- Uitgaven uit de pot **Extra tellen niet mee** in de weekbedragen.
  Extra = salaris × percentage − alle extra-uitgaven van de periode.
- `berekenOverzicht(periode, regels, uitgaven)` in `overzicht.ts` leidt alle
  cijfers van één periode af: potten, weken, status van de vaste lasten en het
  saldo. De UI rekent zelf niets uit.

### Vaste lasten, de V en termijnen (`termijnen.ts`)

- `VasteLast` is de **standaardlijst**. `PeriodeRegel` is de **snapshot** van
  een vaste last in één periode: eigen `bedrag`, `betaald` en `termijnNr`.
- **De V (betaald):** tik op het vakje bij een vaste last en er verschijnt een
  schuine V-stempel; de regel wordt grijs. Hoeveel er nog openstaat, staat op
  Overzicht ("Nog te betalen").
- Het bedrag van een regel is per periode aan te passen; het standaardbedrag
  blijft staan. Op het scherm Vaste lasten is het bedrag gewone tekst: een tik
  op de rij (niet op het vakje) opent het bewerkvenster (`PostFormulier`) met
  bovenaan "Bedrag deze periode" en, in de lopende periode, daaronder de post
  zelf (naam, standaardbedrag, pot, termijnen, verwijderen). In een ontgrendelde
  eerdere periode staat er alleen het periodebedrag. Wijzig je het standaardbedrag, dan volgt de lopende periode
  alleen als het bedrag daar niet al afweek (`Boek.wijzigVasteLast`).
- **Termijnen:** `termijnHuidig` / `termijnTotaal`, getoond als
  "Naam · 3/8" (`termijnLabel`). Bij een nieuwe periode (`bouwNieuwePeriode`)
  gaat een post die al in de vorige periode stond één termijn verder; stond hij
  daar nog niet, dan begint hij op de ingevulde termijn. Na de laatste termijn
  doet de post niet meer mee en wordt hij `actief: false`.
- **Eenmalige post = termijn 1/1.** Hij telt één periode mee en verdwijnt
  daarna vanzelf. Aanmaken via *Vaste lasten → Post toevoegen*.
- **Aankoop in termijnen:** de schakelaar "In termijnen" in het
  uitgaveformulier (alleen in de lopende periode, minimaal 2 termijnen) maakt
  een termijnpost in Persoonlijk; de eerste termijn telt nu mee en staat meteen
  op betaald (`Boek.voegTermijnAankoopToe`).
- Een nieuwe periode neemt alle actieve vaste lasten mee met het
  standaardbedrag en zonder V.

### Uitgaven en ontvangen geld

- `Uitgave`: `datum`, `bedrag`, `omschrijving`, `pot`, `aangemaaktOp`.
- **Ontvangen geld of een terugbetaling is een negatief bedrag.** De schakelaar
  "Ontvangen / terugbetaling" in het formulier draait het teken om. Een
  negatief bedrag maakt de week ruimer, vult Extra aan en verhoogt het saldo;
  er is nergens aparte logica voor.
- In een opengeklapte week (`groepen.ts`, `groepeerUitgaven`) worden uitgaven
  met dezelfde naam in dezelfde pot één regel ("Naam (2×)" met het totaal).
  Namen worden vergeleken zonder verschil in hoofdletters en zonder spaties aan
  begin of eind. Dezelfde naam in een andere pot blijft een aparte regel. De
  volgorde is die van de eerste uitgave. Extra staat niet in de week.
- **Invoeren** gaat met `ui/UitgaveInvoer.tsx`, op Vandaag, in een open week
  op Weken en op Extra. Het formulier is **standaard ingeklapt** achter de knop
  "+ Uitgave" over de volle breedte: geen veld krijgt vanzelf focus, dus het
  toetsenbord komt niet omhoog bij het openen van de app. Een tik op de knop
  klapt het formulier open met de focus op het bedrag en schuift het boven het
  toetsenbord. Na "Zet erbij" blijft het open en leeg, met de focus weer op
  het bedrag. "Klaar" in de kop klapt het in; dat gebeurt ook vanzelf bij een
  andere tab, week of periode (het onderdeel wordt dan opnieuw opgebouwd), en
  wat half was ingevuld is dan weg. Het bewerkvenster van een bestaande uitgave
  gebruikt `UitgaveFormulier` rechtstreeks en is altijd open.
- Snelknoppen: de 6 vaakst gebruikte omschrijvingen (`topWinkels`), aangevuld
  met de geïmporteerde winkels. Het scherm Extra heeft een eigen lijst.

### Saldo (`overzicht.ts`, `berekenSaldo`)

```
saldo = startsaldo + salaris − (vaste lasten met een V + alle uitgaven in de periode)
```

- Uitgaven tellen uit alle drie de potten. Ontvangen geld is negatief en telt
  dus vanzelf op.
- Vaste lasten **zonder V tellen nog niet mee**: het saldo is wat er nu op de
  rekening hoort te staan.
- Het salaris komt uit de snapshot van de periode.
- **Startsaldo** staat per periode in `hb_periodes.startsaldo` en kan negatief
  zijn. Bij een nieuwe periode is het voorstel het saldo van de vorige periode
  op dat moment (`Boek.eindsaldoLopende`); zonder vorige periode 0. Het is in
  het scherm "Nieuwe periode starten" aan te passen, en later via een tik op
  het saldo in de kop of via *Instellingen → Saldo en startsaldo*
  (`ui/SaldoBlad.tsx`, `Boek.wijzigStartsaldo`).
- Het startsaldo wordt bij het starten vastgelegd. Wijzigt de vorige periode
  daarna nog, dan schuift het niet mee.
- Het numerieke toetsenbord van iOS heeft geen minteken; daarom heeft het
  saldoveld een schakelaar "Onder nul" (`ui/SaldoVeld.tsx`, `parseSaldo`).

### Kerncijfers (`overzicht.ts`, `berekenKerncijfers`)

De cijfers bovenaan de tab Overzicht, met de namen uit de sheet. Ze zitten ook
in `berekenOverzicht` (`overzicht.kern`).

| Label | Formule |
| --- | --- |
| Salaris | salaris uit de snapshot van de periode |
| Saldo | het saldo hierboven (`overzicht.saldo.saldo`) |
| Total | alle vaste lasten van de periode (met of zonder V) + alle uitgaven |
| Uitgave | vaste lasten met een V + alle uitgaven |
| Rest | salaris − Total |
| Wrk rest | salaris − Uitgave |

Uitgaven tellen uit alle drie de potten; ontvangen geld is negatief en telt
vanzelf mee. Het startsaldo doet niet mee: Saldo = Wrk rest + startsaldo.

### Tab Overzicht (`ui/schermen/Overzicht.tsx`)

Het hele plaatje van de periode in beeld, **alleen-lezen**; bladeren tussen
periodes werkt zoals overal. Vier delen: de kerncijfers; per pot het
percentage, het budget (salaris × percentage) en wat er over is (dezelfde
bedragen als de potten op Vandaag); alle kosten ("Nog te betalen: € X (n
posten)", de lijsten Vaste lasten en Abonnementen & termijnen met een kleine V
bij afgevinkte posten, en Extra met de datum en in de kop, rechts, wat er nog
over is in de pot Extra: `overzicht.extra.over`, hetzelfde bedrag als bij
"Per pot", rood als het negatief is; de andere twee koppen hebben geen
bedrag); en alle weken opengeklapt
(`WeekBlok` met `alleenLezen`: geen knoppen, geen formulier, samengevoegde
regels klappen niet uit). Op een telefoon staan de twee lijsten naast elkaar
met Extra eronder; vanaf 900px staan ze alle drie naast elkaar en is de pagina
breder (`hb-root-breed`, alleen op deze tab).

## Architectuur

Vite + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`), als PWA
(`vite-plugin-pwa`, service worker met `autoUpdate`). Geen router-bibliotheek,
geen state-bibliotheek, geen CSS-framework.

```
src/
  logica/   pure rekenlogica + tests
    geld.ts        centen, formatEuro, formatMetTeken, formatInvoer, parseBedrag, parseSaldo
    datum.ts       ISO-datums ("2026-11-13"), rekenen in UTC, formatKort/formatMetDag
    potten.ts      verdeling, weekpot, verdeelOverWeken, schuifDoor
    weken.ts       weekblokken, weekIndexVoorDatum
    termijnen.ts   VasteLast, PeriodeRegel, bouwNieuwePeriode, termijnLabel
    overzicht.ts   Periode, Uitgave, berekenOverzicht, berekenSaldo,
                   berekenKerncijfers, topWinkels
    groepen.ts     groepeerUitgaven (samenvoegen in een week)
    startdata.ts   import-/exportformaat, leesStartdata (validatie)
  data/     opslag en toestand
    backend.ts          de interface Backend
    supabaseBackend.ts  rijen ↔ domeinobjecten, euro ↔ centen
    geheugenBackend.ts  demo-backend (localStorage)
    supabase.ts         client, DEMO-vlag
    boek.ts             de store: toestand + alle acties
    wachtrij.ts         opslag-wachtrij
  ui/       schermen en onderdelen
    context.ts          useBoek, useStaat, useBeeld, useWinkels
    WeekBlok.tsx        weekblok, uitgaven in kolommen; UitgavenLijst (scherm Extra)
    UitgaveInvoer.tsx   knop "+ Uitgave" met het inklapbare formulier
    UitgaveFormulier.tsx, Potten.tsx, Blad.tsx (dialoog), Inloggen.tsx
    NieuwePeriode.tsx, SaldoBlad.tsx, SaldoVeld.tsx
    schermen/           Vandaag, Weken, Overzicht, VasteLasten, Extra, Instellingen
  App.tsx   schil: sessie, kop met periode en saldo, tabs, meldingen
  stijl.css alle stijl, klassen met voorvoegsel hb-
```

- **Bedragen in centen.** In alle TypeScript-code is een bedrag een heel aantal
  centen (`Centen`), zodat er geen afrondingsfouten ontstaan. Alleen aan de
  randen wordt omgerekend: de database (numeric in euro's, in
  `supabaseBackend.ts`), de import/export (euro's, `startdata.ts` en
  `Boek.exporteer`) en het scherm (`formatEuro`, `parseBedrag`).
- **Datums** zijn ISO-strings zonder tijd; rekenen gebeurt in UTC zodat
  zomertijd geen dag verschuift. `vandaagISO()` gebruikt de lokale datum.
- **Backend-interface** (`backend.ts`): `laadBasis`, `laadPeriode` en
  schrijfacties die allemaal **idempotent** zijn (upsert op id, verwijderen op
  id), zodat een mislukte actie veilig opnieuw kan. Twee implementaties:
  `maakSupabaseBackend` (productie) en `maakGeheugenBackend` (demo). Een nieuw
  veld moet in beide, en in de nep-backend van `boek.test.ts` als die het raakt.
- **De store** (`Boek` in `boek.ts`): één object met de toestand (`Staat`) en
  alle acties, gekoppeld aan React via `useSyncExternalStore`. Elke actie past
  de toestand **meteen** aan (optimistisch) en zet het opslaan in de wachtrij.
  Ids worden in de client gemaakt (`crypto.randomUUID()`).
- **De opslag-wachtrij** (`Wachtrij`): slaat wijzigingen één voor één en in
  volgorde op. Mislukt er één, dan stopt de rij en wachten latere wijzigingen,
  zodat nooit een oudere versie over een nieuwere heen wordt geschreven.
  Bovenaan verschijnt "Opslaan lukte niet" met "Opnieuw proberen"; bij het
  `online`-event wordt het vanzelf opnieuw geprobeerd. De rij staat alleen in
  het geheugen; bij sluiten met wachtende wijzigingen waarschuwt de browser.
- **Laden:** `laad()` haalt de basis en de lopende periode op. Eerdere periodes
  worden pas geladen als je ernaartoe bladert (`kiesPeriode`).
- **`useBeeld()`** geeft de periode in beeld met `berekenOverzicht` erover, plus
  `isLopende` en `bewerkbaar`. Schermen lezen daaruit en roepen acties op
  `useBoek()` aan.
- **Tabs via de hash** (`#/weken`), zodat verversen op GitHub Pages geen 404
  geeft. Er zijn zes tabs: Vandaag, Weken, Vaste lasten, Extra, Overzicht en
  Instellingen. Die laatste heet in de tabbalk "Instellen" (met het volledige
  woord als `aria-label`), zodat alle zes op 360px passen.
- **Invoervelden voor bedragen** houden een string bij en parsen pas bij
  opslaan of blur, zodat "12," te typen is.

## Datamodel

Vijf tabellen in het schema `public`, allemaal met voorvoegsel `hb_`.
Migraties staan in `supabase/migrations/`:

- `20261113120000_hb_huishoudboek.sql`: tabellen, indexen, RLS, rechten.
- `20261113180000_hb_periodes_startsaldo.sql`: kolom `startsaldo`.

Bedragen zijn `numeric(12, 2)` in euro's. Elke tabel heeft
`user_id uuid default auth.uid()` met een verwijzing naar `auth.users`
(`on delete cascade`).

**`hb_instellingen`** (één rij per gebruiker, `user_id` is de primary key)

| Kolom | Type | Opmerking |
| --- | --- | --- |
| `salaris` | numeric | ≥ 0 |
| `perc_vast`, `perc_persoonlijk`, `perc_extra` | smallint | samen 100 (check) |
| `week_startdag` | smallint | 0 = zondag … 6 = zaterdag, standaard 6 |
| `winkels` | text[] | aanvulling voor de snelknoppen |
| `bijgewerkt_op` | timestamptz | |

**`hb_vaste_lasten`** (de standaardlijst)

| Kolom | Type | Opmerking |
| --- | --- | --- |
| `id` | uuid | |
| `naam` | text | niet leeg |
| `standaard_bedrag` | numeric | |
| `pot` | text | `vast` of `persoonlijk` |
| `termijn_huidig`, `termijn_totaal` | smallint null | beide null, of 1 ≤ huidig ≤ totaal |
| `actief` | boolean | false na de laatste termijn |
| `volgorde` | integer | |
| `aangemaakt_op` | timestamptz | |

**`hb_periodes`** (met snapshot van salaris en verdeling)

| Kolom | Type | Opmerking |
| --- | --- | --- |
| `id` | uuid | |
| `startdatum`, `einddatum` | date | einddatum ≥ startdatum; uniek op (`user_id`, `startdatum`) |
| `salaris` | numeric | snapshot |
| `perc_vast`, `perc_persoonlijk`, `perc_extra` | smallint | snapshot, samen 100 |
| `week_startdag` | smallint | snapshot |
| `startsaldo` | numeric | standaard 0, mag negatief |
| `aangemaakt_op` | timestamptz | |

**`hb_periode_vaste_lasten`** (snapshot van de vaste lasten per periode)

| Kolom | Type | Opmerking |
| --- | --- | --- |
| `id` | uuid | |
| `periode_id` | uuid | FK (`periode_id`, `user_id`) → `hb_periodes`, cascade |
| `vaste_last_id` | uuid null | wordt null als de standaardpost verdwijnt; uniek per periode |
| `naam`, `pot`, `bedrag` | | kopie, per periode aan te passen |
| `betaald` | boolean | de V |
| `termijn_nr`, `termijn_totaal` | smallint null | |
| `volgorde` | integer | |

**`hb_uitgaven`**

| Kolom | Type | Opmerking |
| --- | --- | --- |
| `id` | uuid | |
| `periode_id` | uuid | FK (`periode_id`, `user_id`) → `hb_periodes`, cascade |
| `datum` | date | bepaalt het weekblok |
| `bedrag` | numeric | negatief = ontvangen |
| `omschrijving` | text | |
| `pot` | text | `vast`, `persoonlijk` of `extra` |
| `aangemaakt_op` | timestamptz | |

**Afscherming (RLS).** Het project heeft ook gebruikers van een andere app, dus
"ingelogd" is niet genoeg.

- RLS staat aan op elke tabel.
- Policies bestaan alleen voor de rol `authenticated`, voor select, insert,
  update en delete, steeds met `user_id = (select auth.uid())`.
- De rol `anon` heeft geen policies en ook geen tabelrechten (`revoke all`,
  daarna alleen `grant … to authenticated`).
- Geen `SECURITY DEFINER`, en ook verder geen functies of triggers.
- De samengestelde foreign keys op (`periode_id`, `user_id`) zorgen dat een
  regel of uitgave nooit aan de periode van een ander kan hangen.
- De client stuurt `user_id` nooit mee; de default vult hem in.

**Snapshots.** Een periode legt zijn salaris, verdeling, startdag en startsaldo
vast, en krijgt eigen regels voor de vaste lasten. Zo blijven oude periodes
kloppen als de instellingen of de standaardlijst later veranderen.

## Supabase

- De app draait in het **bestaande Supabase-project "filmavond"**, dat ook door
  een andere app wordt gebruikt, met eigen tabellen en gebruikers.
- **Maak of wijzig alleen `hb_`-objecten.** Raak geen andere tabellen,
  functies, policies of instellingen aan.
- **Migraties voert Claude Code niet uit**, ook niet als er Supabase-tools
  beschikbaar zijn. Zet een nieuw bestand in `supabase/migrations/`; de
  gebruiker laat het uitvoeren.
- Migraties zijn **additief en idempotent**: `add column if not exists`,
  bestaande data blijft ongemoeid. Geen persoonlijke data in een migratie.
- De backend leest een nog ontbrekende kolom als standaardwaarde
  (`startsaldo ?? 0`), zodat de app blijft laden als de deploy vóór de
  migratie komt. Schrijven naar de kolom lukt dan nog niet.
- **Inloggen gaat met e-mail en wachtwoord** (`signInWithPassword`, in
  `ui/Inloggen.tsx`). Niet met een magic link of e-mailcode: de e-mailtemplates
  aanpassen kan niet zonder eigen SMTP, en op iOS opent een link uit de mail in
  Safari en niet in de app op het beginscherm, die een eigen opslag heeft.
- **Aanmelden is dicht.** De app heeft geen registratie en geen "wachtwoord
  vergeten"; het account wordt in het Supabase-dashboard beheerd. Het is
  hetzelfde account als in de andere app.
- De sessie staat in `localStorage` (`storageKey: "hb-sessie"`) en wordt vanzelf
  ververst; `detectSessionInUrl` staat uit.
- De client gebruikt `VITE_SUPABASE_URL` en `VITE_SUPABASE_PUBLISHABLE_KEY`
  (`sb_publishable_…`). De publishable key mag in de browser staan; de
  afscherming zit in RLS.

## Deploy

- **GitHub Pages** via `.github/workflows/deploy.yml` ("Test en deploy"). Bij
  een push naar `main`: `npm ci`, tests, build, upload, deploy. Bij een pull
  request draaien alleen de tests en de build.
- Secrets in GitHub Actions: `VITE_SUPABASE_URL` en
  `VITE_SUPABASE_PUBLISHABLE_KEY`. Ontbreken ze op `main`, dan stopt de
  workflow met een duidelijke fout.
- **`base` in Vite**: de workflow zet `VITE_BASE` op `/<repo-naam>/`; lokaal is
  de standaard `/money-map/` (`vite.config.ts`). Het PWA-manifest gebruikt
  dezelfde `base` voor `start_url` en `scope`.
- Een merge naar `main` staat dus binnen een paar minuten live. Hoort er een
  migratie bij, laat die dan eerst uitvoeren.

## Vormgeving

Papier en inkt: een rustig kasboek, geen dashboard. Alle stijl staat in
`src/stijl.css`.

| Token | Waarde | Gebruik |
| --- | --- | --- |
| `--papier` | `#e9ede4` | achtergrond (groengrijs papier) |
| `--papier-op` | `#f6f8f2` | kaarten, open weekblok, dialoog |
| `--inkt` | `#1b2a24` | tekst, dikke lijnen |
| `--inkt-zacht` | `#56655c` | labels, bijschriften |
| `--lijn` | `#c6d0be` | dunne lijnen, randen |
| `--stempel` | `#8c2f39` | de V, hoofdknop, actieve tab, links |
| `--rood` | `#a8322a` | negatieve bedragen, fouten |
| `--groen` | `#2f6b4a` | ontvangen geld, "gelukt" |
| `--wit` | `#fff` | invoervelden |

- **Lettertypes** (lokaal via `@fontsource`, geen externe verzoeken):
  **Instrument Serif** voor koppen (`--serif`), **IBM Plex Sans** voor tekst
  (`--sans`), **IBM Plex Mono** voor bedragen (`--mono`, met
  `tabular-nums`).
- **De V-stempel** is de signatuur: een schuine (−9°) serif-V in stempelrood,
  bij betaalde vaste lasten, op het inlogscherm en in de iconen.
- Rechte hoeken, geen schaduwen. Labels klein, in hoofdletters met
  letterafstand.
- `--kolom` is de breedte van de kolommen Vaste lasten en Persoonlijk in een
  weekblok (88px, 80px onder de 400px). De ingeklapte rij, de tabel en de
  uitgavenlijst gebruiken hem alle drie, zodat de bedragen recht onder elkaar
  staan.
- Negatief is rood (`hb-rood`), ontvangen is groen (`hb-groen`).
- **Vaste lasten:** een rij is 44px hoog (`hb-post`). Het vakje is 22px, in een
  tikvlak van 44×44px (`hb-stempel`).
- **Overzicht** (`hb-ov-…`) is een leesscherm: tekst van 11–13px, namen worden
  afgekort met "…", bedragen blijven heel en rechts uitgelijnd.

## Tests

- `src/logica/logica.test.ts`: bedragen, potten, weekpot, doorschuiven,
  weekindeling, termijnen, overzicht, snelknoppen, import.
- `src/logica/saldo.test.ts`, `src/logica/groepen.test.ts`,
  `src/logica/kerncijfers.test.ts`.
- `src/data/boek.test.ts`: de store met een nep-backend (import, periodes,
  termijnen, optimistisch opslaan, startsaldo, export).
- `src/data/backends.test.ts`: het omzetten van periodes in beide backends.
- Controlegetallen uit de sheet die als test vastliggen: de weekpot bij een
  bekend salaris en bedrag aan vaste lasten, wat er van Extra over is, het
  saldo en de kerncijfers (Total, Uitgave, Rest, Wrk rest). Laat deze tests staan; voeg geen andere echte bedragen toe.
- Er zijn geen component- of end-to-end-tests. Schermen controleer je met de
  hand in demo-modus op 360px. Voor de invoer: Vandaag openen (geen veld heeft
  focus, geen bedragveld in beeld) → tik op "+ Uitgave" → de focus staat op het
  bedrag; na "Zet erbij" weer; "Klaar" of een andere tab klapt het in.

## Geschiedenis van keuzes

### Eerste PR (de app zelf)

- **Bedragen in centen**, per pot afgerond: zo komt de app op de cent overeen
  met de sheet.
- **Weekblokken op basis van de startdag binnen de periode**: een maand heeft
  dan altijd 4 of 5 blokken en geen week telt dubbel. In het prototype telde
  een week over de maandgrens in twee maanden mee.
- **Snapshots per periode** (salaris, verdeling, startdag, vaste lasten): oude
  periodes blijven kloppen.
- **Weekindeling en doorschuiven worden berekend, niet opgeslagen**: er kan
  niets uit de pas lopen.
- **Optimistische store met een wachtrij die stopt bij een fout**: invoeren
  voelt direct, en de volgorde van opslaan blijft gegarandeerd.
- **Idempotente schrijfacties en ids uit de client**: opnieuw proberen is
  altijd veilig.
- **Tabs via de hash**: geen 404 bij verversen op GitHub Pages.
- **Knoppen voor de vaakst gebruikte winkels in plaats van `<datalist>`**: dat
  werkt slecht op iOS.
- **Demo-modus**: de app is uit te proberen zonder Supabase en zonder echte
  gegevens.
- **Import is idempotent** (zelfde naam en pot = bijwerken), met een optie om
  eerst alles te vervangen.
- **Inloggen met wachtwoord in plaats van een e-mailcode** (zie "Supabase").
  De brief vroeg om een code; dat bleek niet werkbaar.
- **Eigen lettertypes via `@fontsource`**: werkt offline en zonder verzoeken
  naar derden.

### Tweede ronde (na het eerste dagelijkse gebruik)

- **Ingeklapte weekrij toont het eigen weekbedrag min de uitgaven**, niet
  "beschikbaar". Met het doorgeschoven bedrag erbij was niet te zien hoe een
  week zelf was gegaan. Het doorschuiven is niet veranderd; `eigenOver` is een
  extra veld naast de bestaande.
- **Eerste en laatste blok lopen tot de grenzen van de periode**, in
  `weekblokken()` zelf (`start`/`eind`), niet alleen in het label. Het label
  volgt daardoor uit de data en de blokken dekken de periode precies. De
  toewijzing van datums is gelijk gebleven; een test vergelijkt hem met de oude
  indeling.
- **Uitgaven in een week in twee kolommen**, onder de koppen Vaste lasten en
  Persoonlijk. De potnaam en het gekleurde bolletje zijn daar vervallen omdat
  de kolom het al zegt. Extra staat alleen nog op het scherm Extra.
- **Uitgaven met dezelfde naam in dezelfde pot zijn één regel**, uit te klappen
  naar de losse uitgaven. Het samenvoegen is alleen weergave; in de database
  blijven het losse uitgaven.
- **Saldo in de kop**, het eerste getal dat je ziet: dit hield de gebruiker in
  de sheet bij. Vaste lasten tellen pas mee met een V, zodat het saldo te
  vergelijken is met de bankrekening.
- **Startsaldo per periode** in plaats van een doorlopend berekend saldo: de
  gebruiker kan het gelijkzetten met de werkelijkheid, en een fout in een oude
  periode werkt niet door.
- **Startsaldo aanpassen via een tik op het saldo**, met dezelfde ingang in
  Instellingen. Het blad toont ook de opbouw, zodat te zien is waar het getal
  vandaan komt.
- **Schakelaar "Onder nul"** bij het saldoveld, omdat het numerieke toetsenbord
  van iOS geen minteken heeft.

### Derde ronde (rustiger schermen en de tab Overzicht)

- **"Nieuwe periode starten" alleen nog in Instellingen**: op Vandaag werd de
  knop per ongeluk aangetikt. Het welkomstscherm en de melding "periode
  voorbij" verwijzen met een link naar Instellingen.
- **Het blok met vijf regels is uit de opengeklapte week**: de kop toont al wat
  er over is. Wat overblijft is de doorgeschoven-regel, alleen als die niet €0
  is. Per kolom past "+ € 45,00 doorgeschoven · samen € 112,34 over" niet in
  80px; daarom staan de woorden één keer links en de twee bedragen per kolom
  onder elkaar.
- **Kolomnamen boven de bedragen in de kop van een open week**; de lijst op
  Weken houdt daarnaast zijn ene kopregel voor de ingeklapte weken.
- **Bedrag van een vaste last is tekst, bewerken gaat in een venster**: geen
  dubbele lijn meer en geen bedrag dat per ongeluk wijzigt. Eén venster voor
  het periodebedrag én de post zelf, in plaats van een tik op de naam voor het
  een en een invoerveld voor het ander. `wijzigVasteLast` wordt alleen
  aangeroepen als er aan de post iets veranderd is, zodat een afwijkend
  periodebedrag blijft afwijken.
- **Namen van vaste lasten op één regel** (afgekort met "…"), zodat elke rij
  44px blijft.
- **Kerncijfers in `src/logica`** (`berekenKerncijfers`), met de
  controlegetallen uit de sheet als test.
- **Overzicht tussen Extra en Instellen in de tabbalk** (de invoertabs staan
  bij elkaar, het leesscherm erna), en "Instellen" als kort label:
  zes tabs van 60px op 360px, zonder scrollen of verborgen tabs.
- **Overzicht hergebruikt `WeekBlok`** met `alleenLezen`, zodat de weken er
  hetzelfde uitzien als op Weken.
- **Alleen het Overzicht wordt breed op een groot scherm**; de invoerschermen
  blijven een smalle kolom.

### Vierde ronde (invoer inklapbaar, rustiger kop)

- **Invoerformulier standaard ingeklapt achter "+ Uitgave"**: Vandaag opende
  met de focus op het bedrag, waardoor op de telefoon meteen het toetsenbord
  omhoog kwam, ook als de gebruiker alleen wilde kijken. Eén onderdeel
  (`UitgaveInvoer`) voor Vandaag, Weken en Extra.
- **Openen met `flushSync`**: het formulier staat er dan nog binnen de tik,
  zodat iOS de focus toestaat en het toetsenbord toont.
- **Inklappen bij tab-, week- of periodewissel volgt uit het opnieuw opbouwen
  van het scherm**; de open/dicht-stand staat bewust niet in de store.
- **"Klaar" als tekstknop in plaats van "×"**: een "×" leest als weggooien.
- **Bedrag in de kop van Extra op Overzicht**: wat er in Extra over is, is wat
  de gebruiker spaart. Alleen daar; bij de andere twee lijsten past het niet
  en zegt het minder.
- **Regel "X van Y betaald · nog € Z te gaan" uit de kop**: de kop is nu
  alleen de periode en het saldo. `overzicht.status` blijft bestaan voor "Nog
  te betalen" op Overzicht.

## Bekende beperkingen

- **Geen offline gegevens.** De app-schil werkt offline, maar laden vraagt
  verbinding en wachtende wijzigingen staan alleen in het geheugen. Sluit je de
  app terwijl opslaan mislukt, dan zijn ze weg.
- **Geen synchronisatie tussen toestellen.** Een wijziging op een ander
  toestel zie je pas na opnieuw laden.
- **Een periode is niet te verwijderen** en zijn datums zijn niet aan te
  passen, behalve het automatisch inkorten bij een nieuwe periode.
- **De export is een back-up, geen herstel.** De import leest alleen
  instellingen, vaste lasten en winkels, niet de periodes.
- **Het startsaldo van een nieuwe periode is een momentopname.** Latere
  wijzigingen in de vorige periode werken niet door.
- **Een uitgave met een datum buiten de periode** blijft bij de periode waarin
  hij is ingevoerd en telt in het eerste of laatste blok.
- **Een Extra-uitgave die je op Vandaag invoert** verschijnt niet in de week,
  alleen op het scherm Extra.
- **De startdag van de week wijzigen** verandert de blokken van de lopende
  periode, en daarmee de weekbedragen.
- **"In termijnen" in het uitgaveformulier** begint bij 2 termijnen en komt
  altijd in Persoonlijk. Een eenmalige post (1/1) of een termijnpost in Vaste
  lasten maak je op het scherm Vaste lasten.
- **De snelknoppen** kijken naar de laatste 400 uitgaven.
- **Geen component- of end-to-end-tests.**

## Bewust niet gebouwd

- **Bankkoppeling en CSV-import**: de gebruiker wil zelf invoeren. Dit is een
  besluit, geen achterstand.
- Meerdere gebruikers of gedeelde huishoudens.
- Grafieken of overzichten over meerdere periodes.
- Registreren en "wachtwoord vergeten" in de app.
- Herstellen vanuit een export.
- Wachtende wijzigingen bewaren na het sluiten van de app (offline-wachtrij).
- Categorieën of labels naast de drie potten.
