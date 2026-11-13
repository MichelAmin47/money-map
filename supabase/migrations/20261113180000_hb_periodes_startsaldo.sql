-- Huishoudboek: startsaldo per periode, voor het saldo in de kop van de app.
--
--   saldo = startsaldo + salaris − (vaste lasten met een V + alle uitgaven)
--
-- Additief en idempotent: voegt alleen een kolom toe aan hb_periodes en mag
-- vaker gedraaid worden. Bestaande periodes krijgen 0; het echte startsaldo
-- van de lopende periode vult de gebruiker daarna zelf in de app in.
-- De bestaande RLS-policies en tabelrechten van hb_periodes dekken de kolom al.
-- Raakt niets aan buiten hb_periodes.

alter table public.hb_periodes
  add column if not exists startsaldo numeric(12, 2) not null default 0;

comment on column public.hb_periodes.startsaldo is
  'Saldo op de rekening vóór het salaris van deze periode (kan negatief zijn).';
