-- Burracando · limite di domande al giorno per la chat "Chiedi"
-- La tabella la usa solo la funzione chiedi (con la chiave di servizio): l'app non può leggerla né scriverla.

create table public.uso_chat (
  user_id uuid not null references auth.users (id) on delete cascade,
  giorno date not null,
  domande integer not null default 0,
  primary key (user_id, giorno)
);

comment on table public.uso_chat is 'Domande fatte alla chat "Chiedi" per utente e giorno (ora italiana), per il limite giornaliero.';

alter table public.uso_chat enable row level security;
revoke all on public.uso_chat from anon, authenticated;

-- Conta una domanda se oggi l'utente non ha raggiunto il limite: restituisce true se può farla.
create function public.conta_domanda(utente uuid, limite integer) returns boolean
language sql
set search_path = ''
as $$
  insert into public.uso_chat as u (user_id, giorno, domande)
  values (utente, (now() at time zone 'Europe/Rome')::date, 1)
  on conflict (user_id, giorno) do update set domande = u.domande + 1
  where u.domande < limite
  returning true;
$$;

-- Se la risposta non arriva, la domanda non conta.
create function public.restituisci_domanda(utente uuid) returns void
language sql
set search_path = ''
as $$
  update public.uso_chat set domande = greatest(domande - 1, 0)
  where user_id = utente and giorno = (now() at time zone 'Europe/Rome')::date;
$$;

revoke execute on function public.conta_domanda(uuid, integer) from public, anon, authenticated;
revoke execute on function public.restituisci_domanda(uuid) from public, anon, authenticated;
grant execute on function public.conta_domanda(uuid, integer) to service_role;
grant execute on function public.restituisci_domanda(uuid) to service_role;
