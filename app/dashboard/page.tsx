'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Entrega } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

function horaFormatada(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function Dashboard() {
  const router = useRouter()
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [carregando, setCarregando] = useState(true)
  const [nome, setNome] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [marcando, setMarcando] = useState<string | null>(null)
  const [bairroSelecionado, setBairroSelecionado] = useState<string | null>(null)

  // Modo seleção
  const [modoSelecao, setModoSelecao] = useState(false)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [removendo, setRemovendo] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/login'); return }
      setNome(data.session.user.user_metadata?.nome || 'Entregador')
      setUserId(data.session.user.id)
      await carregarEntregas(data.session.user.id)
    })
  }, [router])

  async function carregarEntregas(uid: string) {
    setCarregando(true)
    const hoje = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('entregas')
      .select('*')
      .eq('user_id', uid)
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

  function toggleSelecao(id: string) {
    setSelecionadas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function entrarModoSelecao() {
    setModoSelecao(true)
    setSelecionadas(new Set())
  }

  function sairModoSelecao() {
    setModoSelecao(false)
    setSelecionadas(new Set())
  }

  function selecionarTodas() {
    setSelecionadas(new Set(entregasFiltradas.map(e => e.id)))
  }

  async function removerSelecionadas() {
    if (selecionadas.size === 0) return
    setRemovendo(true)
    const ids = [...selecionadas]
    await supabase.from('entregas').delete().in('id', ids)
    setEntregas(prev => prev.filter(e => !selecionadas.has(e.id)))
    sairModoSelecao()
    setRemovendo(false)
  }

  const bairros = [...new Map(
    entregas
      .filter(e => e.bairro)
      .map(e => [e.bairro, entregas.filter(x => x.bairro === e.bairro).length])
  ).entries()].sort((a, b) => a[0].localeCompare(b[0]))

  const entregasFiltradas = bairroSelecionado
    ? entregas.filter(e => e.bairro === bairroSelecionado)
    : entregas

  const todasSelecionadas = selecionadas.size === entregasFiltradas.length && entregasFiltradas.length > 0

  return (
    <div className="min-h-screen pb-32 bg-gray-50">
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
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setBairroSelecionado(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                bairroSelecionado === null ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              Todos ({entregas.length})
            </button>
            {bairros.map(([bairro, count]) => (
              <button
                key={bairro}
                onClick={() => setBairroSelecionado(bairro === bairroSelecionado ? null : bairro)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  bairroSelecionado === bairro ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {bairro} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barra de ações da lista */}
      {!carregando && entregasFiltradas.length > 0 && (
        <div className="px-4 mt-4 flex justify-between items-center">
          <p className="text-xs text-gray-500 font-medium">
            {entregasFiltradas.length} ENTREGA{entregasFiltradas.length !== 1 ? 'S' : ''}
          </p>
          {modoSelecao ? (
            <div className="flex gap-3">
              <button onClick={todasSelecionadas ? sairModoSelecao : selecionarTodas} className="text-xs text-blue-600 font-medium">
                {todasSelecionadas ? 'Desmarcar todas' : 'Selecionar todas'}
              </button>
              <button onClick={sairModoSelecao} className="text-xs text-gray-500 font-medium">
                Cancelar
              </button>
            </div>
          ) : (
            <button onClick={entrarModoSelecao} className="text-xs text-blue-600 font-medium">
              Selecionar
            </button>
          )}
        </div>
      )}

      {/* Lista */}
      <div className="px-4 mt-2 space-y-3">
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

        {entregasFiltradas.map((entrega, i) => {
          const selecionada = selecionadas.has(entrega.id)
          return (
            <div
              key={entrega.id}
              onClick={() => modoSelecao && toggleSelecao(entrega.id)}
              className={`bg-white rounded-2xl p-4 shadow-sm transition-all ${
                modoSelecao ? 'cursor-pointer' : ''
              } ${selecionada ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  {modoSelecao ? (
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selecionada ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}>
                      {selecionada && <span className="text-white text-xs">✓</span>}
                    </div>
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                  )}
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">
                    CEP {entrega.cep}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  🕐 {horaFormatada(entrega.criado_em)}
                </span>
              </div>

              {entrega.bairro && (
                <p className="text-xs text-gray-500 mt-1 ml-8">{entrega.bairro}</p>
              )}
              <p className="text-sm text-gray-700 mt-1 mb-3 ml-8">
                {entrega.endereco || 'Endereço não encontrado'}
              </p>

              {!modoSelecao && (
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
              )}
            </div>
          )
        })}
      </div>

      {/* Barra flutuante de remoção */}
      {modoSelecao && selecionadas.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-10">
          <button
            onClick={removerSelecionadas}
            disabled={removendo}
            className="w-full bg-red-500 text-white py-4 rounded-2xl font-semibold text-base shadow-lg active:bg-red-600 disabled:opacity-60"
          >
            {removendo ? 'Removendo...' : `Remover ${selecionadas.size} entrega${selecionadas.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      <NavBar />
    </div>
  )
}
