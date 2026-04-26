'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Entrega } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

export default function Dashboard() {
  const router = useRouter()
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [carregando, setCarregando] = useState(true)
  const [nome, setNome] = useState('')
  const [marcando, setMarcando] = useState<string | null>(null)
  const [bairroSelecionado, setBairroSelecionado] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/login'); return }
      setNome(data.session.user.user_metadata?.nome || 'Entregador')
      await carregarEntregas(data.session.user.id)
    })
  }, [router])

  async function carregarEntregas(userId: string) {
    setCarregando(true)
    const hoje = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('entregas')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pendente')
      .gte('criado_em', hoje)
      .order('bairro', { ascending: true })
      .order('cep', { ascending: true })
    setEntregas(data || [])
    setCarregando(false)
  }

  async function marcarEntregue(id: string) {
    setMarcando(id)
    await supabase.from('entregas').update({
      status: 'entregue',
      entregue_em: new Date().toISOString(),
    }).eq('id', id)
    setEntregas(prev => prev.filter(e => e.id !== id))
    setMarcando(null)
  }

  function abrirMapa(entrega: Entrega) {
    const query = entrega.endereco || entrega.cep
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank')
  }

  async function sair() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Bairros únicos com contagem
  const bairros = [...new Map(
    entregas
      .filter(e => e.bairro)
      .map(e => [e.bairro, entregas.filter(x => x.bairro === e.bairro).length])
  ).entries()].sort((a, b) => a[0].localeCompare(b[0]))

  const entregasFiltradas = bairroSelecionado
    ? entregas.filter(e => e.bairro === bairroSelecionado)
    : entregas

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 pt-10 pb-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-blue-200 text-sm">Olá,</p>
            <h1 className="text-xl font-bold">{nome} 👋</h1>
          </div>
          <button onClick={sair} className="text-blue-200 text-sm underline">Sair</button>
        </div>
        <div className="mt-4 bg-blue-700 rounded-xl p-4 text-center">
          <p className="text-4xl font-bold">{entregas.length}</p>
          <p className="text-blue-200 text-sm mt-1">entregas pendentes hoje</p>
        </div>
      </div>

      {/* Filtro de bairros */}
      {bairros.length > 0 && (
        <div className="px-4 mt-4">
          <p className="text-xs text-gray-500 mb-2 font-medium">FILTRAR POR BAIRRO</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setBairroSelecionado(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                bairroSelecionado === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              Todos ({entregas.length})
            </button>
            {bairros.map(([bairro, count]) => (
              <button
                key={bairro}
                onClick={() => setBairroSelecionado(bairro === bairroSelecionado ? null : bairro)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  bairroSelecionado === bairro
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {bairro} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="px-4 mt-4 space-y-3">
        {carregando && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!carregando && entregasFiltradas.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🎉</div>
            <p className="font-medium text-gray-600">
              {bairroSelecionado ? `Nenhuma entrega em ${bairroSelecionado}` : 'Nenhuma entrega pendente!'}
            </p>
            <p className="text-sm mt-1">Use o scanner para adicionar pacotes</p>
          </div>
        )}

        {entregasFiltradas.map((entrega, i) => (
          <div key={entrega.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">
                  CEP {entrega.cep}
                </span>
              </div>
              <span className="text-xs text-gray-400 font-mono">{entrega.codigo.slice(0, 12)}...</span>
            </div>
            {entrega.bairro && (
              <p className="text-xs text-gray-500 mt-1 ml-8">{entrega.bairro}</p>
            )}
            <p className="text-sm text-gray-700 mt-1 mb-3 ml-8">{entrega.endereco || 'Endereço não encontrado'}</p>
            <div className="flex gap-2">
              <button
                onClick={() => abrirMapa(entrega)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm font-medium active:bg-gray-200"
              >
                🗺️ Navegar
              </button>
              <button
                onClick={() => marcarEntregue(entrega.id)}
                disabled={marcando === entrega.id}
                className="flex-1 bg-green-500 text-white py-2 rounded-xl text-sm font-medium active:bg-green-600 disabled:opacity-50"
              >
                {marcando === entrega.id ? '...' : '✅ Entregue'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <NavBar />
    </div>
  )
}
