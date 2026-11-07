alter table public.pilot_pqrs
  add column tower text not null default '' check (char_length(tower) <= 40),
  add column apartment text not null default '' check (char_length(apartment) <= 40),
  add column owner text not null default '' check (char_length(owner) <= 120);

grant insert (tower, apartment, owner) on public.pilot_pqrs to authenticated;
