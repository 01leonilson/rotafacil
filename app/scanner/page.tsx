'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { extrairCepAutomatico, buscarEndereco, formatarCep } from '@/lib/utils'
import NavBar from '@/components/NavBar'

export default function Scanner() {
  const router = useRouter()
  const scannerRef = useRef<HTMLDivElement>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<'aguardando' | 'processando' | 'sucesso' | 'erro'>('aguardando')
  const [totalHoje, setTotalHoje] = useState(0)
  const scannerInstance = useRef<unknown>(null)
  const processando = useRef(false)

  // Estado para entrada manual de CEP
  const [pendente, setPendente] = useState<{ codigo: string } | null>(null)
  const [cepManual, setCepManual] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/login'); return }
      setUserId(data.session.user.id)
      const hoje = new Date().toISOString().split('T')[0]
      const { count } = await supabase
        .from('entregas')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', data.session.user.id)
        .gte('criado_em', hoje)
      setTotalHoje(count || 0)
    })
  }, [router])

  useEffect(() => {
    if (!userId || !scannerRef.current) return

    type ScannerInstance = { render: (success: (text: string) => void, error: () => void) => void; clear: () => Promise<void> }
    let html5QrcodeScanner: ScannerInstance | null = null

    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      html5QrcodeScanner = new Html5QrcodeScanner(
        'scanner-container',
        { fps: 10, qrbox: { width: 250, height: 150 }, rememberLastUsedCamera: true },
        false
      ) as ScannerInstance

      html5QrcodeScanner.render(
        async (decodedText: string) => {
          if (processando.current) return
          processando.current = true
          setStatus('processando')

          const { cep, endereco } = await extrairCepAutomatico(decodedText)

          if (cep) {
            // CEP encontrado automaticamente — salva direto
            await salvarEntrega(decodedText, cep, endereco)
          } else {
            // CEP não encontrado — pede entrada manual
            setStatus('aguardando')
            setPendente({ codigo: decodedText })
            setCepManual('')
          }
        },
        () => {}
      )

      scannerInstance.current = html5QrcodeScanner
    })

    return () => {
      html5QrcodeScanner?.clear().catch(() => {})
    }
  }, [userId])

  async function salvarEntrega(codigo: string, cep: string, endereco: string) {
    const { error } = await supabase.from('entregas').insert({
      user_id: userId,
      codigo,
      cep,
      endereco,
      status: 'pendente',
    })

    if (error) {
      setStatus('erro')
    } else {
      setStatus('sucesso')
      setTotalHoje(n => n + 1)
    }

    setTimeout(() => {
      setStatus('aguardando')
      processando.current = false
    }, 1500)
  }

  async function confirmarCepManual() {
    if (!pendente) return
    const numeros = cepManual.replace(/\D/g, '')
    if (numeros.length !== 8) return

    setSalvando(true)
    const cep = formatarCep(numeros)
    const endereco = await buscarEndereco(numeros)
    await salvarEntrega(pendente.codigo, cep, endereco)
    setPendente(null)
    setSalvando(false)
  }

  function formatarInput(valor: string) {
    const n = valor.replace(/\D/g, '').slice(0, 8)
    return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n
  }

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <div className="bg-blue-600 text-white px-4 pt-10 pb-6">
        <h1 className="text-xl font-bold">📷 Escanear Etiqueta</h1>
        <p className="text-blue-200 text-sm mt-1">{totalHoje} pacotes adicionados hoje</p>
      </div>

      <div className="px-4 mt-4">
        {/* Status */}
        {status === 'sucesso' && (
          <div className="bg-green-100 text-green-700 rounded-xl p-3 mb-4 text-center font-medium">
            ✅ Pacote adicionado!
          </div>
        )}
        {status === 'erro' && (
          <div className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-center font-medium">
            ❌ Erro ao salvar. Tente novamente.
          </div>
        )}
        {status === 'processando' && (
          <div className="bg-blue-100 text-blue-700 rounded-xl p-3 mb-4 text-center font-medium">
            ⏳ Processando...
          </div>
        )}

        {/* Modal de CEP manual */}
        {pendente && (
          <div className="bg-white rounded-2xl shadow-md p-4 mb-4 border border-yellow-300">
            <p className="text-sm font-semibold text-gray-700 mb-1">CEP não identificado</p>
            <p className="text-xs text-gray-400 font-mono break-all mb-3">{pendente.codigo}</p>
            <label className="text-xs text-gray-500 mb-1 block">Digite o CEP da etiqueta</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="00000-000"
              value={cepManual}
              onChange={e => setCepManual(formatarInput(e.target.value))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-mono tracking-widest text-center focus:outline-none focus:border-blue-500 mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setPendente(null); processando.current = false }}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCepManual}
                disabled={cepManual.replace(/\D/g, '').length !== 8 || salvando}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-40"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {/* Scanner */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div id="scanner-container" ref={scannerRef} />
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Aponte a câmera para o código de barras ou QR code da etiqueta
        </p>
      </div>

      <NavBar />
    </div>
  )
}
