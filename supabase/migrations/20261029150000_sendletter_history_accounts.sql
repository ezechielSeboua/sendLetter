-- sendLetter : historique des lettres et gestion des comptes autorisés depuis l'interface.
-- Toujours limité au schéma sendletter et à des fonctions public.* préfixées par leur usage.

-- Une lettre expirée perd son contenu mais garde une trace (destinataire, titre, dates)
-- pendant history_ttl, pour l'historique de l'expéditeur.
alter table sendletter.settings add column history_ttl interval not null default '90 days';
alter table sendletter.letters add column purged_at timestamptz;
create index letters_sender_created_idx on sendletter.letters (sender_id, created_at desc);

-- Les administrateurs gèrent la liste des comptes autorisés.
alter table sendletter.allowed_emails add column is_admin boolean not null default false;
update sendletter.allowed_emails set is_admin = true where email = 'ezechiellasmseboua@gmail.com';

create function sendletter.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from sendletter.allowed_emails
    where email = lower(auth.jwt() ->> 'email') and is_admin
  )
$$;

-- Droits de l'utilisateur connecté, lus par l'interface juste après la connexion.
create function public.sender_info()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('allowed', sendletter.is_allowed(), 'admin', sendletter.is_admin())
$$;

-- Une lettre dont le contenu a été effacé ne peut plus être lue, même si les durées changent.
create or replace function public.open_letter(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg sendletter.settings;
  l sendletter.letters;
begin
  select * into cfg from sendletter.settings;
  select * into l from sendletter.letters where slug = p_slug for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if l.purged_at is not null then
    return jsonb_build_object('status', 'expired');
  end if;

  if l.opened_at is null then
    if l.created_at + cfg.unopened_ttl < now() then
      return jsonb_build_object('status', 'expired');
    end if;
    update sendletter.letters set opened_at = now() where slug = p_slug returning * into l;
  end if;

  if l.opened_at + cfg.read_window < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'theme', l.theme,
    'fields', l.fields,
    'expires_at', l.opened_at + cfg.read_window
  );
end;
$$;

-- Historique de l'expéditeur connecté.
-- status : 'sent' (pas encore ouverte), 'opened' (ouverte au moins une fois), 'expired' (jamais ouverte, délai dépassé).
-- expires_at : fin de lecture pour une lettre ouverte, fin de validité du lien sinon.
create function public.list_my_letters()
returns table (
  slug text,
  theme text,
  recipient text,
  title text,
  created_at timestamptz,
  opened_at timestamptz,
  expires_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.slug,
    l.theme,
    l.fields ->> 'recipient',
    l.fields ->> 'title',
    l.created_at,
    l.opened_at,
    case when l.opened_at is not null then l.opened_at + s.read_window else l.created_at + s.unopened_ttl end,
    case
      when l.opened_at is not null then 'opened'
      when l.purged_at is not null or l.created_at + s.unopened_ttl < now() then 'expired'
      else 'sent'
    end
  from sendletter.letters l
  cross join sendletter.settings s
  where sendletter.is_allowed() and l.sender_id = auth.uid()
  order by l.created_at desc
$$;

-- Annule une lettre pas encore ouverte, ou la retire de l'historique.
create function public.delete_my_letter(p_slug text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not sendletter.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from sendletter.letters where slug = p_slug and sender_id = auth.uid();
  return found;
end;
$$;

create function public.list_allowed_emails()
returns table (email text, is_admin boolean, added_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not sendletter.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
    select a.email, a.is_admin, a.added_at from sendletter.allowed_emails a order by a.added_at;
end;
$$;

-- Ajoute un compte, ou met à jour son rôle s'il existe déjà.
create function public.add_allowed_email(p_email text, p_admin boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text := lower(trim(p_email));
begin
  if not sendletter.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if v = lower(auth.jwt() ->> 'email') and not p_admin then
    raise exception 'cannot_demote_self' using errcode = '22023';
  end if;
  insert into sendletter.allowed_emails (email, is_admin) values (v, p_admin)
  on conflict (email) do update set is_admin = excluded.is_admin;
end;
$$;

-- Retire un compte. On ne peut pas se retirer soi-même (il resterait sans administrateur).
-- Les lettres déjà envoyées par ce compte restent lisibles jusqu'à leur expiration.
create function public.remove_allowed_email(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not sendletter.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if lower(p_email) = lower(auth.jwt() ->> 'email') then
    raise exception 'cannot_remove_self' using errcode = '22023';
  end if;
  delete from sendletter.allowed_emails where email = lower(p_email);
end;
$$;

revoke all on function sendletter.is_admin() from public;
revoke all on function public.sender_info() from public, anon;
revoke all on function public.list_my_letters() from public, anon;
revoke all on function public.delete_my_letter(text) from public, anon;
revoke all on function public.list_allowed_emails() from public, anon;
revoke all on function public.add_allowed_email(text, boolean) from public, anon;
revoke all on function public.remove_allowed_email(text) from public, anon;
grant execute on function public.sender_info() to authenticated;
grant execute on function public.list_my_letters() to authenticated;
grant execute on function public.delete_my_letter(text) to authenticated;
grant execute on function public.list_allowed_emails() to authenticated;
grant execute on function public.add_allowed_email(text, boolean) to authenticated;
grant execute on function public.remove_allowed_email(text) to authenticated;

-- Nettoyage : à l'expiration, le contenu est effacé (seuls destinataire et titre restent) ;
-- après history_ttl, la trace disparaît aussi. Remplace la tâche précédente du même nom.
select cron.schedule(
  'sendletter-purge',
  '*/5 * * * *',
  $$
    update sendletter.letters l
       set fields = jsonb_strip_nulls(jsonb_build_object('recipient', l.fields -> 'recipient', 'title', l.fields -> 'title')),
           purged_at = now()
      from sendletter.settings s
     where l.purged_at is null
       and ((l.opened_at is not null and l.opened_at + s.read_window < now())
         or (l.opened_at is null and l.created_at + s.unopened_ttl < now()));

    delete from sendletter.letters l
     using sendletter.settings s
     where l.created_at + s.history_ttl < now();
  $$
);
