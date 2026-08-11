-- Tabla de perfiles de la plataforma Valtech
-- Roles disponibles: encargado, perito, digitador
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text not null,
  cargo text check (cargo in ('encargado', 'perito', 'digitador')),
  created_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- Cada usuario solo ve y actualiza su propio perfil
create policy "Perfil propio: lectura"
  on public.perfiles for select
  using (auth.uid() = id);

create policy "Perfil propio: insercion"
  on public.perfiles for insert
  with check (auth.uid() = id);

create policy "Perfil propio: actualizacion"
  on public.perfiles for update
  using (auth.uid() = id);

-- El perfil se crea automaticamente al iniciar sesion con Google (cargo queda
-- sin asignar hasta que un administrador lo configure).
-- Ejemplo para asignar el cargo (correr como admin en el SQL editor):
-- update public.perfiles set cargo = 'encargado' where id = '<UUID del usuario>';
