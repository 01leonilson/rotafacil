import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Entrega = {
  id: string
  user_id: string
  codigo: string
  cep: string
  endereco: string
  bairro: string
  status: 'pendente' | 'entregue'
  foto_url?: string
  criado_em: string
  entregue_em?: string
}
