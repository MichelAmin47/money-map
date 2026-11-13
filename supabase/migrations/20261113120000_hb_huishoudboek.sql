-- Huishoudboek: alle objecten hebben het voorvoegsel hb_ en staan in public.
-- Deze migratie maakt alleen nieuwe hb_-tabellen, -indexen en -policies aan en
-- raakt niets aan van de andere app in dit project.
--
-- Afscherming: RLS staat aan op elke tabel. Policies gelden alleen voor de rol
-- `authenticated` en alleen voor rijen met user_id = auth.uid(). De rol `anon`
-- krijgt geen policies en ook geen tabelrechten. Geen SECURITY DEFINER.

begin;

-- ---------------------------------------------------------------------------
-- Instellingen: één rij per gebruiker
-- ---------------------------------------------------------------------------
create table public.hb_instellingen (
  user_id          uuid primary key default auth.uid()
                     references auth.users (id) on delete cascade,
  salaris          numeric(12, 2) not null default 0 check (salaris >= 0),
  perc_vast        smallint not null default 62 check (perc_vast between 0 and 100),
  perc_persoonlijk smallint not null default 25 check (perc_persoonlijk between 0 and 100),
  perc_extra       smallint not null default 13 check (perc_extra between 0 and 100),
  -- 0 = zondag … 6 = zaterdag
  week_startdag    smallint not null default 6 check (week_startdag between 0 and 6),
  -- Aanvulling voor de snelknoppen zolang er nog weinig uitgaven zijn
  winkels          text[] not null default '{}',
  bijgewerkt_op    timestamptz not null default now(),
  constraint hb_instellingen_verdeling_100
    check (perc_vast + perc_persoonlijk + perc_extra = 100)
);

-- ---------------------------------------------------------------------------
-- Vaste lasten: de standaardlijst die elke nieuwe periode wordt meegenomen
-- ---------------------------------------------------------------------------
create table public.hb_vaste_lasten (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid()
                     references auth.users (id) on delete cascade,
  naam             text not null check (length(trim(naam)) > 0),
  standaard_bedrag numeric(12, 2) not null default 0,
  pot              text not null check (pot in ('vast', 'persoonlijk')),
  -- Termijn die in de lopende periode valt, bv. 3 van 8. Beide null = geen termijnen.
  termijn_huidig   smallint,
  termijn_totaal   smallint,
  actief           boolean not null default true,
  volgorde         integer not null default 0,
  aangemaakt_op    timestamptz not null default now(),
  constraint hb_vaste_lasten_termijn check (
    (termijn_huidig is null and termijn_totaal is null)
    or (termijn_huidig >= 1 and termijn_totaal >= termijn_huidig)
  )
);

create index hb_vaste_lasten_user_idx on public.hb_vaste_lasten (user_id, volgorde);

-- ---------------------------------------------------------------------------
-- Periodes: van salaris tot salaris, met een snapshot van salaris en verdeling
-- ---------------------------------------------------------------------------
create table public.hb_periodes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid()
                     references auth.users (id) on delete cascade,
  startdatum       date not null,
  -- Laatste dag van de periode (de dag vóór het volgende salaris)
  einddatum        date not null,
  salaris          numeric(12, 2) not null check (salaris >= 0),
  perc_vast        smallint not null check (perc_vast between 0 and 100),
  perc_persoonlijk smallint not null check (perc_persoonlijk between 0 and 100),
  perc_extra       smallint not null check (perc_extra between 0 and 100),
  week_startdag    smallint not null check (week_startdag between 0 and 6),
  aangemaakt_op    timestamptz not null default now(),
  constraint hb_periodes_datums check (einddatum >= startdatum),
  constraint hb_periodes_verdeling_100
    check (perc_vast + perc_persoonlijk + perc_extra = 100),
  constraint hb_periodes_start_uniek unique (user_id, startdatum),
  -- Doel van de samengestelde foreign keys hieronder
  constraint hb_periodes_id_user_uniek unique (id, user_id)
);

-- ---------------------------------------------------------------------------
-- Vaste lasten per periode: snapshot met bedrag, vinkje en termijnnummer
-- ---------------------------------------------------------------------------
create table public.hb_periode_vaste_lasten (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  periode_id     uuid not null,
  -- Null zodra de standaardpost verwijderd is; de periode blijft leesbaar
  vaste_last_id  uuid references public.hb_vaste_lasten (id) on delete set null,
  naam           text not null,
  pot            text not null check (pot in ('vast', 'persoonlijk')),
  bedrag         numeric(12, 2) not null default 0,
  betaald        boolean not null default false,
  termijn_nr     smallint,
  termijn_totaal smallint,
  volgorde       integer not null default 0,
  constraint hb_periode_vaste_lasten_periode_fk
    foreign key (periode_id, user_id)
    references public.hb_periodes (id, user_id) on delete cascade,
  constraint hb_periode_vaste_lasten_uniek unique (periode_id, vaste_last_id)
);

create index hb_periode_vaste_lasten_periode_idx
  on public.hb_periode_vaste_lasten (periode_id, volgorde);
create index hb_periode_vaste_lasten_user_idx
  on public.hb_periode_vaste_lasten (user_id);
create index hb_periode_vaste_lasten_vaste_last_idx
  on public.hb_periode_vaste_lasten (vaste_last_id);

-- ---------------------------------------------------------------------------
-- Uitgaven: weekuitgaven (vast/persoonlijk) en extra's; negatief = ontvangen
-- ---------------------------------------------------------------------------
create table public.hb_uitgaven (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  periode_id    uuid not null,
  datum         date not null,
  bedrag        numeric(12, 2) not null,
  omschrijving  text not null,
  pot           text not null check (pot in ('vast', 'persoonlijk', 'extra')),
  aangemaakt_op timestamptz not null default now(),
  constraint hb_uitgaven_periode_fk
    foreign key (periode_id, user_id)
    references public.hb_periodes (id, user_id) on delete cascade
);

create index hb_uitgaven_periode_idx on public.hb_uitgaven (periode_id, datum);
create index hb_uitgaven_user_idx on public.hb_uitgaven (user_id, aangemaakt_op desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.hb_instellingen         enable row level security;
alter table public.hb_vaste_lasten         enable row level security;
alter table public.hb_periodes             enable row level security;
alter table public.hb_periode_vaste_lasten enable row level security;
alter table public.hb_uitgaven             enable row level security;

-- hb_instellingen
create policy hb_instellingen_select on public.hb_instellingen
  for select to authenticated using (user_id = (select auth.uid()));
create policy hb_instellingen_insert on public.hb_instellingen
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy hb_instellingen_update on public.hb_instellingen
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy hb_instellingen_delete on public.hb_instellingen
  for delete to authenticated using (user_id = (select auth.uid()));

-- hb_vaste_lasten
create policy hb_vaste_lasten_select on public.hb_vaste_lasten
  for select to authenticated using (user_id = (select auth.uid()));
create policy hb_vaste_lasten_insert on public.hb_vaste_lasten
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy hb_vaste_lasten_update on public.hb_vaste_lasten
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy hb_vaste_lasten_delete on public.hb_vaste_lasten
  for delete to authenticated using (user_id = (select auth.uid()));

-- hb_periodes
create policy hb_periodes_select on public.hb_periodes
  for select to authenticated using (user_id = (select auth.uid()));
create policy hb_periodes_insert on public.hb_periodes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy hb_periodes_update on public.hb_periodes
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy hb_periodes_delete on public.hb_periodes
  for delete to authenticated using (user_id = (select auth.uid()));

-- hb_periode_vaste_lasten
create policy hb_periode_vaste_lasten_select on public.hb_periode_vaste_lasten
  for select to authenticated using (user_id = (select auth.uid()));
create policy hb_periode_vaste_lasten_insert on public.hb_periode_vaste_lasten
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy hb_periode_vaste_lasten_update on public.hb_periode_vaste_lasten
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy hb_periode_vaste_lasten_delete on public.hb_periode_vaste_lasten
  for delete to authenticated using (user_id = (select auth.uid()));

-- hb_uitgaven
create policy hb_uitgaven_select on public.hb_uitgaven
  for select to authenticated using (user_id = (select auth.uid()));
create policy hb_uitgaven_insert on public.hb_uitgaven
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy hb_uitgaven_update on public.hb_uitgaven
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy hb_uitgaven_delete on public.hb_uitgaven
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Tabelrechten: anon krijgt niets, authenticated alleen gewone CRUD
-- ---------------------------------------------------------------------------
revoke all on table
  public.hb_instellingen,
  public.hb_vaste_lasten,
  public.hb_periodes,
  public.hb_periode_vaste_lasten,
  public.hb_uitgaven
from anon, authenticated, public;

grant select, insert, update, delete on table
  public.hb_instellingen,
  public.hb_vaste_lasten,
  public.hb_periodes,
  public.hb_periode_vaste_lasten,
  public.hb_uitgaven
to authenticated;

commit;
