-- sendLetter : durées d'expiration et de suppression réglables depuis l'interface.
-- Les durées transitent en secondes. Elles s'appliquent aussi aux lettres déjà envoyées,
-- car les échéances sont calculées à la lecture.

-- Lisible par tout expéditeur autorisé (message d'avertissement après l'envoi) ; null sinon.
create function public.get_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'read_window', extract(epoch from s.read_window)::integer,
    'unopened_ttl', extract(epoch from s.unopened_ttl)::integer,
    'history_ttl', extract(epoch from s.history_ttl)::integer
  )
  from sendletter.settings s
  where sendletter.is_allowed()
$$;

-- Modifiable par les administrateurs uniquement.
create function public.update_settings(p_read_window integer, p_unopened_ttl integer, p_history_ttl integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not sendletter.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_read_window is null or p_read_window not between 60 and 86400 then
    raise exception 'invalid_read_window' using errcode = '22023';
  end if;
  if p_unopened_ttl is null or p_unopened_ttl not between 60 and 90 * 86400 then
    raise exception 'invalid_unopened_ttl' using errcode = '22023';
  end if;
  if p_history_ttl is null or p_history_ttl not between 86400 and 365 * 86400 then
    raise exception 'invalid_history_ttl' using errcode = '22023';
  end if;
  -- Sinon une lettre pourrait disparaître de l'historique avant même l'expiration de son lien
  if p_history_ttl < p_unopened_ttl then
    raise exception 'history_shorter_than_link' using errcode = '22023';
  end if;

  update sendletter.settings
     set read_window = make_interval(secs => p_read_window),
         unopened_ttl = make_interval(secs => p_unopened_ttl),
         history_ttl = make_interval(secs => p_history_ttl);
end;
$$;

revoke all on function public.get_settings() from public, anon;
revoke all on function public.update_settings(integer, integer, integer) from public, anon;
grant execute on function public.get_settings() to authenticated;
grant execute on function public.update_settings(integer, integer, integer) to authenticated;
