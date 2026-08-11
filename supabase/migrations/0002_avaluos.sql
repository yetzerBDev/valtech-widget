-- Tabla de avaluos sincronizada desde el Excel maestro (hoja "Ingreso Datos")
-- Clave unica: No. Avalúo (columna H del Excel, unica en los datos)
create table public.avaluos (
  no_avaluo text primary key,
  fecha_banco date,
  recibe date,
  tipo text,
  area_solicitud text,
  estatus text,
  codigo text,
  perito text,
  digitador text,
  oficial_credito text,
  solicitante text,
  identidad text,
  telefono text,
  propietario text,
  direccion text,
  departamento text,
  sucursal text,
  sitio_avaluo text,
  categoria text,
  observaciones text,
  tiempo_entrega text,
  tiempo text,
  dias_abierto numeric,
  encuesta text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists avaluos_estatus_idx on public.avaluos (estatus);
create index if not exists avaluos_perito_idx on public.avaluos (perito);
create index if not exists avaluos_digitador_idx on public.avaluos (digitador);

-- Nota: RLS desactivada por ahora (tool interno, el Excel es la fuente de verdad).
-- Mas adelante se puede endurecer con policies de solo lectura + service_role.
