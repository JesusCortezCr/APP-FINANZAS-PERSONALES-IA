-- ============================================================
-- FINANZAS IA - BASE DE DATOS COMPLETA
-- Ejecuta esto en Supabase SQL Editor
-- ============================================================

-- 1. Extensiones
create extension if not exists "uuid-ossp";

-- 2. Tabla de Categorías (elimina y recrea con más datos)
drop table if exists public.movimiento cascade;
drop table if exists public.categoria cascade;

create table public.categoria (
    id uuid default uuid_generate_v4() primary key,
    nombre text not null,
    icono text,
    tipo text check (tipo in ('ingreso', 'gasto', 'ambos')),
    usuario_id uuid references auth.users(id) on delete cascade,
    created_at timestamp with time zone default now()
);

-- 3. Tabla de Movimientos
create table public.movimiento (
    id uuid default uuid_generate_v4() primary key,
    usuario_id uuid references auth.users(id) on delete cascade not null,
    categoria_id uuid references public.categoria(id) on delete set null,
    tipo text check (tipo in ('ingreso', 'gasto')),
    tipo_registro text check (tipo_registro in ('manual', 'ia')),
    monto decimal(12,2) not null,
    fecha date not null default current_date,
    descripcion text,
    descripcion_ia text,
    imagen_url text,
    medio_pago text,
    created_at timestamp with time zone default now()
);

-- 4. Tabla de Perfil
create table if not exists public.perfil (
    id uuid references auth.users(id) on delete cascade primary key,
    nombre text,
    avatar_url text,
    moneda text default 'PEN',
    created_at timestamp with time zone default now()
);

-- 5. Seguridad (RLS)
alter table public.categoria enable row level security;
alter table public.movimiento enable row level security;
alter table public.perfil enable row level security;

-- Políticas para Categorías
create policy "Ver categorias globales o propias" on public.categoria for select
    using (usuario_id is null or auth.uid() = usuario_id);
create policy "Insertar propias categorias" on public.categoria for insert
    with check (auth.uid() = usuario_id);
create policy "Eliminar propias categorias" on public.categoria for delete
    using (auth.uid() = usuario_id);

-- Políticas para Movimientos
create policy "Ver propios movimientos" on public.movimiento for select
    using (auth.uid() = usuario_id);
create policy "Insertar propios movimientos" on public.movimiento for insert
    with check (auth.uid() = usuario_id);
create policy "Actualizar propios movimientos" on public.movimiento for update
    using (auth.uid() = usuario_id);
create policy "Borrar propios movimientos" on public.movimiento for delete
    using (auth.uid() = usuario_id);

-- Políticas para Perfil
create policy "Ver propio perfil" on public.perfil for select
    using (auth.uid() = id);
create policy "Insertar propio perfil" on public.perfil for insert
    with check (auth.uid() = id);
create policy "Actualizar propio perfil" on public.perfil for update
    using (auth.uid() = id);

-- 6. Trigger para crear perfil automáticamente al registrarse
create or replace function public.manejar_nuevo_usuario()
returns trigger as $$
begin
  insert into public.perfil (id, nombre)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.manejar_nuevo_usuario();

-- 7. Categorías globales por defecto (50 categorías)
insert into public.categoria (nombre, icono, tipo) values
-- GASTOS - Alimentación y Bebidas
('Restaurantes', '🍽️', 'gasto'),
('Supermercado', '🛒', 'gasto'),
('Comida rápida', '🍔', 'gasto'),
('Cafetería', '☕', 'gasto'),
('Delivery', '🛵', 'gasto'),
-- GASTOS - Transporte
('Transporte público', '🚌', 'gasto'),
('Taxi / Uber', '🚕', 'gasto'),
('Combustible', '⛽', 'gasto'),
('Estacionamiento', '🅿️', 'gasto'),
('Mantenimiento auto', '🔧', 'gasto'),
-- GASTOS - Salud
('Farmacia', '💊', 'gasto'),
('Médico / Clínica', '🏥', 'gasto'),
('Seguro médico', '🩺', 'gasto'),
('Gimnasio', '💪', 'gasto'),
('Salud mental', '🧠', 'gasto'),
-- GASTOS - Educación
('Matrícula / Pensión', '🎓', 'gasto'),
('Libros y útiles', '📚', 'gasto'),
('Cursos online', '💻', 'gasto'),
('Idiomas', '🌐', 'gasto'),
-- GASTOS - Hogar
('Alquiler', '🏠', 'gasto'),
('Electricidad', '💡', 'gasto'),
('Agua', '💧', 'gasto'),
('Internet / Cable', '📡', 'gasto'),
('Celular', '📱', 'gasto'),
('Limpieza', '🧹', 'gasto'),
('Reparaciones', '🔨', 'gasto'),
-- GASTOS - Entretenimiento
('Streaming', '🎬', 'gasto'),
('Videojuegos', '🎮', 'gasto'),
('Salidas / Ocio', '🎉', 'gasto'),
('Viajes', '✈️', 'gasto'),
('Deportes', '⚽', 'gasto'),
-- GASTOS - Ropa y Cuidado personal
('Ropa y calzado', '👗', 'gasto'),
('Peluquería / Belleza', '✂️', 'gasto'),
('Accesorios', '👜', 'gasto'),
-- GASTOS - Finanzas
('Cuotas / Deudas', '💳', 'gasto'),
('Impuestos', '📋', 'gasto'),
('Seguros', '🛡️', 'gasto'),
-- GASTOS - Mascotas y Otros
('Mascotas', '🐾', 'gasto'),
('Regalos', '🎁', 'gasto'),
('Donaciones', '❤️', 'gasto'),
('Otros gastos', '📦', 'gasto'),
-- INGRESOS
('Salario', '💼', 'ingreso'),
('Freelance', '💻', 'ingreso'),
('Negocio propio', '🏪', 'ingreso'),
('Inversiones', '📈', 'ingreso'),
('Alquiler cobrado', '🏠', 'ingreso'),
('Bonos / Comisiones', '🎯', 'ingreso'),
('Otros ingresos', '💰', 'ingreso'),
-- AMBOS
('Transferencias', '↔️', 'ambos'),
('Ahorro', '🏦', 'ambos')
on conflict do nothing;
