-- Agrega las columnas de fecha que el sync de Excel necesita pero que
-- no existian en la migracion original 0002.  Si la DB ya las tiene
-- (agregadas manualmente via dashboard), este archivo queda como
-- registro y puede ignorarse con IF NOT EXISTS.
alter table public.avaluos
  add column if not exists fecha_envio_perito date,
  add column if not exists fecha_envio_visita date;

create index if not exists avaluos_fecha_envio_visita_idx
  on public.avaluos (fecha_envio_visita);
