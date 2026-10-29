-- sendLetter : lettres éphémères, hébergées dans le projet Supabase « slase-custom-3d ».
-- Tout vit dans le schéma privé « sendletter » (non exposé par l'API) ; le navigateur
-- ne passe que par les fonctions public.can_send, public.create_letter et public.open_letter.
-- Seuls les comptes Google listés dans sendletter.allowed_emails peuvent créer des lettres ;
-- le filtre est ici et non dans l'authentification, partagée avec Slase Custom 3D.
-- Rien ici ne touche aux tables, règles d'accès ou fichiers de Slase Custom 3D.

create extension if not exists pg_cron;

create schema sendletter;
revoke all on schema sendletter from public, anon, authenticated;

-- Réglages modifiables depuis le tableau de bord Supabase (Table Editor > schéma sendletter).
-- Une seule ligne.
create table sendletter.settings (
  id boolean primary key default true check (id),
  read_window interval not null default '5 minutes',  -- durée de lecture après la 1re ouverture
  unopened_ttl interval not null default '7 days'     -- durée de vie d'un lien jamais ouvert
);
insert into sendletter.settings default values;

-- Expéditeurs autorisés, modifiables depuis le tableau de bord (adresses en minuscules).
create table sendletter.allowed_emails (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);
insert into sendletter.allowed_emails (email) values ('ezechiellasmseboua@gmail.com');

create table sendletter.letters (
  slug text primary key,
  sender_id uuid not null references auth.users (id) on delete cascade,
  theme text not null check (theme in ('invitation', 'birthday', 'crush')),
  fields jsonb not null check (jsonb_typeof(fields) = 'object' and octet_length(fields::text) <= 8000),
  created_at timestamptz not null default now(),
  opened_at timestamptz
);

-- Ceinture et bretelles : RLS active sans aucune politique, en plus du schéma fermé.
alter table sendletter.settings enable row level security;
alter table sendletter.letters enable row level security;
alter table sendletter.allowed_emails enable row level security;

create function sendletter.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from sendletter.allowed_emails where email = lower(auth.jwt() ->> 'email')
  )
$$;

-- Appelée par la page de configuration juste après la connexion.
create function public.can_send()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select sendletter.is_allowed()
$$;

-- Enregistre une lettre et renvoie son identifiant court (10 caractères, sans 0/O/1/l/i).
create function public.create_letter(p_theme text, p_fields jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  bytes bytea;
  new_slug text;
begin
  if not sendletter.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  loop
    bytes := extensions.gen_random_bytes(10);
    new_slug := '';
    for i in 0..9 loop
      new_slug := new_slug || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
    end loop;
    begin
      insert into sendletter.letters (slug, sender_id, theme, fields) values (new_slug, auth.uid(), p_theme, p_fields);
      return new_slug;
    exception when unique_violation then
      -- collision (très improbable) : on retire un identifiant
    end;
  end loop;
end;
$$;

-- Ouvre une lettre. La 1re ouverture démarre le compte à rebours ; ensuite la lettre
-- n'est renvoyée que pendant read_window. Réponse : { status: 'ok' | 'expired' | 'not_found', ... }
create function public.open_letter(p_slug text)
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

revoke all on function sendletter.is_allowed() from public;
revoke all on function public.can_send() from public, anon;
revoke all on function public.create_letter(text, jsonb) from public, anon;
revoke all on function public.open_letter(text) from public;
grant execute on function public.can_send() to authenticated;
grant execute on function public.create_letter(text, jsonb) to authenticated;
-- Les destinataires lisent sans compte
grant execute on function public.open_letter(text) to anon, authenticated;

-- Nettoyage toutes les 5 minutes : lettres lues et expirées, ou jamais ouvertes et périmées.
select cron.schedule(
  'sendletter-purge',
  '*/5 * * * *',
  $$
    delete from sendletter.letters l
    using sendletter.settings s
    where (l.opened_at is not null and l.opened_at + s.read_window < now())
       or (l.opened_at is null and l.created_at + s.unopened_ttl < now())
  $$
);
