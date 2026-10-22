-- Burracando · storico delle partite nel cloud
-- Una riga per partita. Ogni utente legge e modifica solo le proprie (Row Level Security).
-- Le partite eliminate dall'app restano con eliminata = true, così l'eliminazione
-- arriva anche sugli altri dispositivi dell'utente.

create table public.partite (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  creata_il timestamptz not null,
  aggiornata bigint not null,
  eliminata boolean not null default false,
  regolamento text not null,
  obiettivo integer not null,
  giocatori text[] not null,
  squadre text[] not null,
  totali integer[] not null,
  num_manche integer not null default 0,
  finita boolean not null default false,
  vincitore text,
  dati jsonb not null check (pg_column_size(dati) < 1000000),
  salvata_il timestamptz not null default now(),
  primary key (user_id, id)
);

comment on table public.partite is 'Storico delle partite di Burracando: una riga per partita, visibile solo al suo proprietario.';
comment on column public.partite.aggiornata is 'Ultima modifica fatta sul dispositivo, in millisecondi: decide quale versione vince nella sincronizzazione.';
comment on column public.partite.squadre is 'Nomi dei giocatori o delle coppie, nello stesso ordine di totali.';
comment on column public.partite.dati is 'La partita completa come la salva l''app: giocatori, squadre e manche con i dettagli del conteggio.';
comment on column public.partite.salvata_il is 'Quando la riga è stata scritta o aggiornata sul server.';

create function public.partite_salvata_il() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.salvata_il := now();
  return new;
end;
$$;

create trigger partite_salvata_il
before update on public.partite
for each row execute function public.partite_salvata_il();

alter table public.partite enable row level security;

create policy "Leggo solo le mie partite" on public.partite
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Aggiungo solo partite mie" on public.partite
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Modifico solo le mie partite" on public.partite
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Elimino solo le mie partite" on public.partite
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.partite from anon;
grant select, insert, update, delete on public.partite to authenticated;
