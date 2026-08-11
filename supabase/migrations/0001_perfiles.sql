-- Tabla de perfiles de la plataforma Valtech
-- Roles disponibles: encargado, perito, digitador
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text not null,
  cargo text not null check (cargo in ('encargado', 'perito', 'digitador')),
  created_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- Cada usuario solo ve y actualiza su propio perfil
create policy "Perfil propio: lectura"
  on public.perfiles for select
  using (auth.uid() = id);

create policy "Perfil propio: actualizacion"
  on public.perfiles for update
  using (auth.uid() = id);

-- Ejemplo para asignar un perfil (correr como admin en el SQL editor):
-- insert into public.perfiles (id, email, nombre, cargo)
-- values ('<UUID del usuario en auth.users>', 'correo@dominio.com', 'Nombre Completo', 'encargado');
