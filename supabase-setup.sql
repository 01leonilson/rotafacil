-- Execute este SQL no painel do Supabase (SQL Editor)

create table if not exists entregas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  codigo text not null,
  cep text not null,
  endereco text default '',
  status text default 'pendente' check (status in ('pendente', 'entregue')),
  foto_url text,
  criado_em timestamptz default now(),
  entregue_em timestamptz
);

-- Segurança: cada usuário só vê suas próprias entregas
alter table entregas enable row level security;

create policy "usuarios veem proprias entregas"
  on entregas for all
  using (auth.uid() = user_id);

-- Índice para performance
create index on entregas(user_id, criado_em desc);
create index on entregas(cep);
