-- Activa RLS en avaluos (ver 0002, que la dejaba desactivada).
-- Modelo de acceso:
--   - Cualquier usuario autenticado puede LEER los avaluos (los 3 roles
--     consultan la misma tabla).
--   - Las ESCRITURAS (upsert/delete desde el sync del Excel) solo las puede
--     hacer service_role, que bypasea RLS. El sync corre en el proceso
--     principal del Electron con la clave de servicio, nunca con la anon.
--   - El rol anon (clave publica del bundle) queda sin permisos.
alter table public.avaluos enable row level security;

create policy "Avaluos: lectura autenticados"
  on public.avaluos for select
  to authenticated
  using (true);

-- No se crean policies de insert/update/delete: solo service_role (bypass RLS)
-- puede escribir. Si mas adelante se quiere que el encargado edite desde la
-- web, agregar aqui una policy de update con using/check restringido a cargo.
