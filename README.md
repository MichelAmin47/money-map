# Huishoudboek

Persoonlijke budget-app (PWA) voor op de telefoon: salaris over drie potten, een
weekpot die doorschuift, vaste lasten met een V-stempel, en termijnen die
vanzelf meelopen. [CLAUDE.md](CLAUDE.md) beschrijft hoe de app in elkaar zit
en is leidend; [BRIEF.md](BRIEF.md) is de oorspronkelijke opdracht en op punten
verouderd.

- **Stack:** Vite + React + TypeScript, Supabase (Postgres + Auth), GitHub Pages.
- **Geen persoonlijke data in de repo.** Salaris, vaste lasten en bedragen
  komen binnen via *Instellingen → Importeer startdata*.

## Eenmalig instellen

### 1. Supabase (bestaand project)

De app gebruikt het bestaande project en maakt alleen objecten met het
voorvoegsel `hb_` aan. Bestaande tabellen, functies en policies blijven
ongemoeid.

1. **Migraties draaien.** Open in het Supabase-dashboard de *SQL Editor* en
   voer de bestanden uit `supabase/migrations/` in volgorde uit (of met de CLI:
   `supabase link` en daarna `supabase db push`):
   - [`20261113120000_hb_huishoudboek.sql`](supabase/migrations/20261113120000_hb_huishoudboek.sql):
     de tabellen, RLS en rechten. Draait in één transactie.
   - [`20261113180000_hb_periodes_startsaldo.sql`](supabase/migrations/20261113180000_hb_periodes_startsaldo.sql):
     het startsaldo per periode. Voegt alleen een kolom toe en mag vaker
     gedraaid worden. Vul daarna in de app het startsaldo van de lopende
     periode in (tik op het saldo bovenaan).
2. **Account met wachtwoord.** Inloggen gaat met e-mailadres en wachtwoord
   (`signInWithPassword`). De app heeft bewust geen registratie en geen
   "wachtwoord vergeten". Zet het wachtwoord in het dashboard:
   *Authentication → Users* → je gebruiker → *Reset password* of *Update
   user*. Bestaat de gebruiker nog niet, maak hem daar dan aan met *Add user →
   Create new user* (vink *Auto Confirm User* aan). Dit is hetzelfde account
   als in de andere app van dit project: een nieuw wachtwoord geldt daar ook.
3. **E-mailprovider aan.** Controleer bij *Authentication → Sign In /
   Providers → Email* dat de provider *Email* aan staat. De rest van die
   instellingen hoeft voor deze app niet te veranderen.
4. **Redirect-URL.** Voeg bij *Authentication → URL Configuration → Redirect
   URLs* de Pages-URL toe: `https://<gebruiker>.github.io/money-map/`. Voor
   inloggen met wachtwoord is dit niet strikt nodig, maar zo staat de app
   netjes tussen de toegestane adressen.
5. **Sessieduur.** De sessie blijft bewaard op het toestel en wordt vanzelf
   ververst. Dat werkt zolang bij *Authentication → Sessions* geen *time-box*
   of *inactivity timeout* is ingesteld (standaard staan die uit).
6. Noteer de **Project URL** en de **publishable key** (`sb_publishable_…`)
   uit *Project Settings → API Keys*. De publishable key mag in de browser
   staan; de afscherming zit in Row Level Security.

### 2. GitHub

1. *Settings → Secrets and variables → Actions → New repository secret*:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
2. *Settings → Pages → Build and deployment → Source*: kies **GitHub Actions**.
3. **Eerste deploy:** merge naar `main` (of start de workflow *Test en deploy*
   handmatig via *Actions → Run workflow*). Elke push naar `main` rolt daarna
   vanzelf uit. De app staat op `https://<gebruiker>.github.io/money-map/`.

De workflow zet `base` automatisch op de naam van de repo. Lokaal staat die in
`vite.config.ts` (`/money-map/`); pas dat aan als de repo anders gaat heten.

### 3. Op de telefoon

1. Open de Pages-URL in Safari → *Deel* → **Zet op beginscherm**.
2. Open de app vanaf het beginscherm en log in met je e-mailadres en
   wachtwoord. Log in vanuit de app op het beginscherm zelf: die heeft op iOS
   een eigen opslag, los van Safari. De sessie blijft daarna bewaard; opnieuw
   inloggen is alleen nodig na *Uitloggen* of als je het wachtwoord wijzigt.
3. *Instellingen → Importeer startdata (JSON)* en kies je `startdata.json`
   (formaat: zie BRIEF.md). Twee keer importeren geeft geen dubbelen: posten
   met dezelfde naam en pot worden bijgewerkt.
4. Start je eerste periode met **Nieuwe periode starten** (startdatum = de dag
   dat je salaris binnenkwam).

`startdata.json` staat in `.gitignore`; commit het echte bestand niet.

## Lokaal ontwikkelen

```bash
npm install
cp .env.example .env.local   # vul de Supabase-URL en publishable key in
npm run dev                  # http://localhost:5173/money-map/
npm test                     # unit tests (Vitest)
npm run build                # typecheck + productie-build in dist/
```

Zonder Supabase uitproberen kan met demo-modus; gegevens staan dan alleen in
de browser (localStorage) en er is geen login:

```bash
VITE_DEMO=true npm run dev
```

## Hoe het rekent

- **Potten.** Salaris × percentage, per pot afgerond op centen. Van *Vaste
  lasten* en *Persoonlijk* gaan eerst de vaste posten af; de rest is de
  **weekpot**. *Extra* is salaris × percentage min de extra posten (ontvangen
  geld is een negatief bedrag).
- **Weken.** Een weekblok begint op de ingestelde startdag (standaard
  zaterdag). Bij een periode horen de blokken waarvan die startdag in de
  periode valt; dat zijn er bij een maand altijd 4 of 5, en geen blok telt in
  twee periodes mee. Het eerste blok begint op de startdatum van de periode
  (dagen vóór de eerste startdag tellen bij week 1), het laatste eindigt op de
  einddatum.
- **Doorschuiven.** Beschikbaar = weekbedrag + wat de vorige week over was
  (of tekort kwam). Een ingeklapte week toont alleen het eigen weekbedrag min
  de uitgaven van die week.
- **Saldo.** Startsaldo + salaris − (vaste lasten met een V + alle uitgaven
  van de periode). Een nieuwe periode begint standaard op het saldo van de
  vorige; het startsaldo is aan te passen via een tik op het saldo bovenaan.
- **Termijnen.** Bij een nieuwe periode gaat elke termijnpost één verder; na
  de laatste termijn doet hij niet meer mee.
- **Controle tegen de sheet** zit in de tests: salaris 4720,49 met 2488 aan
  vaste lasten → weekpot 438,70; pot extra 613,66 − 327 → 286,66.

## Structuur

| Pad | Inhoud |
| --- | --- |
| `src/logica/` | Pure rekenlogica (centen, datums, potten, weken, termijnen, import) met tests |
| `src/data/` | Opslag: Supabase-backend, demo-backend, de store (`boek.ts`) en de opslag-wachtrij |
| `src/ui/` | Schermen en onderdelen |
| `supabase/migrations/` | SQL voor de `hb_`-tabellen, RLS-policies en rechten |
| `CLAUDE.md` | Hoe de app werkt en waarom: begrippen, architectuur, datamodel, regels |
| `reference/` | Het eerste prototype (alleen ter referentie) |

## Datamodel en afscherming

Vijf tabellen in `public`: `hb_instellingen`, `hb_vaste_lasten`,
`hb_periodes`, `hb_periode_vaste_lasten` en `hb_uitgaven`.

- Elke tabel heeft `user_id` met default `auth.uid()` en RLS aan.
- Policies bestaan alleen voor de rol `authenticated` en eisen
  `user_id = auth.uid()`. Andere ingelogde gebruikers van het project zien dus
  niets.
- De rol `anon` heeft geen policies en ook geen tabelrechten.
- Geen `SECURITY DEFINER`-functies (er zijn helemaal geen functies).
- De weekindeling en het doorschuiven worden niet opgeslagen maar in de app
  berekend uit de datums.

## Opslaan en offline

Een invoer is meteen zichtbaar en wordt op de achtergrond opgeslagen, in
volgorde. Mislukt het opslaan, dan verschijnt bovenaan een melding met
**Opnieuw proberen**; latere wijzigingen wachten tot het weer lukt (ook
automatisch zodra er weer verbinding is). Wachtende wijzigingen staan alleen in
het geheugen: houd de app open tot de melding weg is. De app-schil werkt
offline (service worker); voor de gegevens is verbinding nodig.
