# Opdracht: Huishoudboek-webapp (PWA)

Bouw een persoonlijke budget-app voor één gebruiker, voor dagelijks gebruik op de telefoon. Hij vervangt een Google Sheet die de gebruiker nu elke maand met de hand bijhoudt. De gebruiker wil zelf invoeren: **geen bankkoppeling, geen CSV-import**. Het doel is sneller invoeren en beter overzicht.

`reference/huishoudboek.jsx` is een eerste prototype. Neem daar de look & feel en de basislogica uit over. Kopieer de opslaglaag niet: die gebruikt `window.storage`, en dat bestaat buiten Claude niet.

Alle teksten in de app zijn in het Nederlands. Bedragen in euro, `nl-NL`-notatie, en invoer met komma moet werken.

---

## Stack en hosting

- **Vite + React + TypeScript**, als PWA (manifest, service worker, icoon). Op iOS moet de app aan het beginscherm toe te voegen zijn.
- **Hosting: GitHub Pages**, uitgerold via GitHub Actions bij elke push naar `main`. Zet `base` in Vite goed op de repo-naam. Gebruik geen client-side router die bij een refresh een 404 geeft: tabs via state of een hash-router.
- **Data: Supabase** (Postgres + Auth), in een **bestaand Supabase-project dat al door een andere app gebruikt wordt**. Maak geen nieuw project aan.
  - **Alle tabellen krijgen het voorvoegsel `hb_`** (bijvoorbeeld `hb_uitgaven`) en staan in het `public`-schema.
  - Raak bestaande tabellen, functies en policies niet aan. Migraties maken alleen `hb_`-objecten aan.
  - Gebruik de bestaande Supabase Auth. Dezelfde gebruiker logt in.
  - **Afscherming:** het project heeft al andere gebruikers (van de filmavond-app), dus "ingelogd" is niet genoeg.
    - Elke `hb_`-tabel krijgt RLS-policies met `user_id = auth.uid()`, alleen voor de rol `authenticated`.
    - Er komen geen policies voor de rol `anon`.
    - `user_id` krijgt de default `auth.uid()`.
    - Gebruik geen `SECURITY DEFINER`-functies.
  - **Inloggen met een 6-cijferige code per e-mail** (`signInWithOtp` + `verifyOtp` met type `email`), **niet met een magic link**. Op iOS opent een link uit de mail in Safari en niet in de app op het beginscherm, en dan blijft de app uitgelogd.
  - Er is maar één gebruiker. De sessie blijft bewaard, zodat inloggen zelden nodig is.
  - Gebruik `shouldCreateUser: false`: nieuwe accounts aanmaken kan niet vanuit de app.
  - Elke tabel heeft een `user_id`, en Row Level Security staat aan op elke tabel.
  - Zet de migraties in `supabase/migrations/`. **Voer ze niet zelf uit.** Ik draai ze zelf.
  - De Supabase-URL en de publishable key (`sb_publishable_…`) komen uit `VITE_SUPABASE_URL` en `VITE_SUPABASE_PUBLISHABLE_KEY`. Lokaal staan ze in `.env.local` (gitignored), bij de deploy komen ze uit GitHub Actions secrets.
- **Er komt geen persoonlijke data in de repo** (de repo kan publiek zijn): geen salaris, geen namen van vaste lasten, geen bedragen. Startdata komt binnen via de import-functie (zie onder).
- Schrijf een `README.md` met de stappen: migraties draaien in het bestaande project, de Pages-URL toevoegen aan de toegestane redirect-URL's, de secrets zetten en de eerste deploy.

---

## Begrippen (zo werkt het systeem van de gebruiker)

**Periode.** Een periode loopt van salaris tot salaris, niet per kalendermaand. De gebruiker start een nieuwe periode met de knop **"Nieuwe periode starten"** en kiest daarbij:
- de startdatum (standaard: vandaag);
- de verwachte volgende salarisdatum (standaard: de startdatum + 1 maand).

**Weken.** De periode wordt opgedeeld in weekblokken van 7 dagen.
- De startdag van de week is instelbaar (standaard **zaterdag**, zoals in de huidige sheet).
- Het aantal weekblokken bepaalt hoe de weekpot verdeeld wordt (meestal 4 of 5 blokken).
- Toon elk blok als "13 t/m 19", met het weeknummer erbij.

**Drie potten.** Het salaris wordt over drie potten verdeeld; de percentages zijn instelbaar (standaard 62 / 25 / 13). Voor elke pot geldt:
- **Vaste lasten (62%).** Pot = salaris × 62%. Daarvan gaan eerst de vaste lasten in deze pot af. Wat overblijft is de **weekpot**, die gelijk over de weekblokken verdeeld wordt. Wekelijkse uitgaven (boodschappen, slager, drogist) gaan van die weekpot af.
- **Persoonlijk (25%).** Werkt hetzelfde: abonnementen en termijnbetalingen gaan eraf, de rest is de weekpot voor uitgaven aan hobby's, uit eten en kleding.
- **Extra (13%).** In de sheet heet deze pot "Sparen", maar hij wordt gebruikt voor eenmalige grotere uitgaven: cadeaus, Bux-inleg, kapper, een reis. Daarnaast komt hier geld binnen, als negatieve bedragen (terugbetalingen, geld dat iemand overmaakt). Wat er aan het eind over is, is wat er echt gespaard wordt.
  - Controle uit de sheet: 613,66 − 327 aan extra's = 286,66 over. Dat klopt.

**Doorschuiven per week.** Wat je in een week overhoudt, schuift door naar de volgende week. Geef je meer uit, dan gaat dat tekort van de volgende week af.
- Toon per week **"beschikbaar"**: het basisbedrag plus wat er doorgeschoven is.
- Dit vervangt de regels "Week X Over" uit de sheet.

**Vaste lasten en de V.**
- Elke vaste last heeft een vinkje "betaald". Tik je het aan, dan verschijnt een V-stempel (zie het prototype) en wordt de regel grijs.
- Bovenaan staat: "13 van 29 betaald · nog €412 te gaan".
- Het bedrag kan per periode afwijken (het Waterschap wisselt bijvoorbeeld). De standaardwaarde blijft dan staan.

**Termijnen.** Dit is de belangrijkste nieuwe functie, want nu typt de gebruiker elke maand "Zalando shorts 2/3" en "Waterschap 3/8" opnieuw over.
- Een vaste last of een aankoop kan termijnen hebben: `huidig` / `totaal`.
- Toon die als "Waterschap · 3/8".
- Bij een nieuwe periode gaat `huidig` met 1 omhoog. Na de laatste termijn verdwijnt de post vanzelf.
- Bij het invoeren van een uitgave zit een optie **"in termijnen (aantal)"**. De app maakt dan zelf een termijnpost aan in de pot Persoonlijk voor de komende periodes, en de eerste termijn telt in de huidige periode mee.

**Nieuwe periode starten** (dit vervangt het maandelijkse dupliceren van het tabblad):
- Alle vaste lasten worden meegenomen, met de vinkjes weer leeg en de termijnen één verder.
- Weekuitgaven en extra's beginnen leeg.
- De vorige periode blijft bewaard en is terug te bladeren, alleen-lezen. Na een bevestiging mag hij ook bewerkbaar zijn.

---

## Schermen

1. **Vandaag** (startscherm)
   - Bovenaan de drie potten met wat er nog over is, en de status van de vaste lasten.
   - Daaronder de huidige week, opengeklapt: "beschikbaar" per pot, de uitgaven van deze week en het invoerformulier.
   - Snel invoeren is het belangrijkste:
     - een bedragveld met numeriek toetsenbord dat focus krijgt;
     - **knoppen met de 6 vaakst gebruikte winkels** (geen `<datalist>`: dat werkt slecht op iOS) plus een vrij tekstveld;
     - een keuze tussen Vaste lasten, Persoonlijk en Extra;
     - een schakelaar "ontvangen / terugbetaling" die het bedrag negatief maakt;
     - de datum staat standaard op vandaag en bepaalt in welke week de uitgave komt.
   - Na het opslaan wordt het formulier leeg en krijgt het bedragveld weer focus.
2. **Weken.** Alle weekblokken van de periode, in- en uitklapbaar, met per blok "beschikbaar" voor Vaste lasten en voor Persoonlijk.
3. **Vaste lasten.** Twee groepen: Vaste lasten en Abonnementen & termijnen.
   - De V-stempel om aan te tikken.
   - Het bedrag is per periode aan te passen.
   - Posten zijn toe te voegen, te bewerken en te verwijderen (naam, standaardbedrag, pot, termijnen). **Dit ontbreekt in het prototype.**
4. **Extra.** Een lijst van de eenmalige posten en het ontvangen geld, met wat er van de pot Extra over is.
5. **Instellingen**
   - Salaris en verdeling. Opslaan kan alleen als de percentages samen 100 zijn.
   - Startdag van de week.
   - **Export en import als JSON.** Het importformaat staat in `startdata.json` (zie onder). De import moet idempotent zijn, of eerst vragen of de bestaande gegevens vervangen moeten worden.

Bij alle uitgaven werkt bewerken en verwijderen (in het prototype kan alleen verwijderen).

---

## Bekende fouten in het prototype: niet overnemen

- `window.storage` werkt buiten Claude niet. Vervang het door Supabase.
- Het bedragveld bij de vaste lasten parst bij elke toetsaanslag, waardoor je "12," niet kunt typen. Houd de invoer als string bij en parse pas bij blur of opslaan.
- De periode is per kalendermaand en de weken beginnen op maandag. Dat klopt niet met het systeem van de gebruiker (zie Begrippen).
- Een week die over de maandgrens loopt, telt in twee maanden mee. Bij periodes op basis van de startdatum verdwijnt dit probleem.
- Er is geen manier om vaste lasten toe te voegen.
- Er is geen doorschuiven per week en geen pot Extra.

---

## Datamodel (voorstel, mag je verbeteren)

- `hb_instellingen` (user_id, salaris, perc_vast, perc_persoonlijk, perc_extra, week_startdag)
- `hb_vaste_lasten` (id, user_id, naam, standaard_bedrag, pot, termijn_huidig null, termijn_totaal null, actief, volgorde)
- `hb_periodes` (id, user_id, startdatum, einddatum, aantal_weken, salaris_snapshot, verdeling_snapshot)
- `hb_periode_vaste_lasten` (periode_id, vaste_last_id, bedrag, betaald, termijn_nr), waarbij een nieuwe periode een snapshot van de vaste lasten krijgt
- `hb_uitgaven` (id, user_id, periode_id, datum, bedrag, omschrijving, pot: vast|persoonlijk|extra, aangemaakt_op)

Bereken de weekindeling en wat er doorschuift in de client, uit de datums. Sla dat niet op.

---

## Importformaat (`startdata.json`)

```json
{
  "versie": 1,
  "instellingen": { "salaris": 0, "verdeling": { "vast": 62, "persoonlijk": 25, "extra": 13 }, "weekStartDag": "zaterdag" },
  "vasteLasten": [
    { "naam": "Huur", "bedrag": 0, "pot": "vast" },
    { "naam": "Waterschap", "bedrag": 0, "pot": "vast", "termijn": { "huidig": 3, "totaal": 8 } }
  ],
  "winkels": ["Jumbo", "AH"]
}
```

Commit het echte bestand niet. De gebruiker importeert het zelf via Instellingen.

---

## Vormgeving

Neem de stijl van het prototype over: papierachtige groengrijze achtergrond, Instrument Serif voor koppen, IBM Plex Mono voor bedragen en de schuine V-stempel als signatuur.

Verder:
- eerst ontworpen voor mobiel (vanaf 360px breed);
- grote tikvlakken, minimaal 44px;
- zichtbare focus;
- `prefers-reduced-motion` wordt gerespecteerd.

---

## Kwaliteit en oplevering

- **Unit tests (Vitest) voor de rekenlogica:**
  - de verdeling over de potten;
  - de weekpot;
  - het doorschuiven, ook bij overschrijding;
  - het doorschuiven van termijnen bij een nieuwe periode en het verdwijnen na de laatste termijn;
  - de weekindeling bij verschillende startdagen.
- **Controle tegen de sheet:**
  - salaris 4720,49, vaste lasten in de pot vast 2488 → weekpot vast 438,70;
  - pot extra 613,66 met 327 aan posten → 286,66 over.
- **Werk in kleine commits** met duidelijke berichten.
- **Optimistische UI:** een invoer is meteen zichtbaar en wordt op de achtergrond opgeslagen. Mislukt het opslaan, dan volgt een duidelijke melding en kun je het opnieuw proberen.
- **Als je klaar bent:** een korte samenvatting van wat er staat, wat ik in Supabase en GitHub nog moet instellen, en welke keuzes je zelf gemaakt hebt.

**Buiten scope:** bankkoppeling, CSV-import, meerdere gebruikers, grafieken over meerdere periodes.
