'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Entrega } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

export default function Historico() {
  const router = useRouter()
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/login'); return }
      const hoje = new Date().toISOString().split('T')[0]
      const { data: rows } = await supabase
        .from('entregas')
        .select('*')
        .eq('user_id', data.session.user.id)
        .gte('criado_em', hoje)
        .order('criado_em', { ascending: false })
      setEntregas(rows || [])
      setCarregando(false)
    })
  }, [router])

  const entregues = entregas.filter(e => e.status === 'entregue').length
  const pendentes = entregas.filter(e => e.status === 'pendente').length

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <div className="bg-blue-600 text-white px-4 pt-10 pb-6">
        <h1 className="text-xl font-bold">📋 Histórico de Hoje</h1>
        <div className="flex gap-4 mt-3">
          <div className="bg-blue-700 rounded-xl px-4 py-2 text-center flex-1">
            <p className="text-2xl font-bold">{entregas.length}</p>
            <p className="text-blue-200 text-xs">total</p>
          </div>
          <div className="bg-green-500 rounded-xl px-4 py-2 text-center flex-1">
            <p className="text-2xl font-bold">{entregues}</p>
            <p className="text-green-100 text-xs">entregues</p>
          </div>
          <div className="bg-yellow-500 rounded-xl px-4 py-2 text-center flex-1">
            <p className="text-2xl font-bold">{pendentes}</p>
            <p className="text-yellow-100 text-xs">pendentes</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-2">
        {carregando && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!carregando && entregas.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-gray-600">Nenhum pacote escaneado hoje</p>
          </div>
        )}

        {entregas.map(entrega => (
          <div key={entrega.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
            <span className="text-2xl">{entrega.status === 'entregue' ? '✅' : '⏳'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{entrega.endereco || entrega.cep}</p>
              <p className="text-xs text-gray-400 font-mono">{entrega.cep}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
              entrega.status === 'entregue'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {entrega.status === 'entregue' ? 'Entregue' : 'Pendente'}
            </span>
          </div>
        ))}
      </div>

      <NavBar />
    </div>
  )
}
