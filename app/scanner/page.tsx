'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  extrairCepAutomatico,
  buscarEnderecoDetalhado,
  montarEndereco,
  formatarCep,
  type EnderecoDetalhado,
} from '@/lib/utils'
import NavBar from '@/components/NavBar'

export default function Scanner() {
  const router = useRouter()
  const scannerRef = useRef<HTMLDivElement>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [totalHoje, setTotalHoje] = useState(0)
  const [status, setStatus] = useState<'aguardando' | 'processando' | 'sucesso' | 'erro'>('aguardando')
  const processando = useRef(false)

  // Fallback manual
  const [pendente, setPendente] = useState<{ codigo: string } | null>(null)
  const [cepManual, setCepManual] = useState('')
  const [qd, setQd] = useState('')
  const [lote, setLote] = useState('')
  const [numero, setNumero] = useState('')
  const [preview, setPreview] = useState<EnderecoDetalhado | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)
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

    type SI = { render: (ok: (t: string) => void, err: () => void) => void; clear: () => Promise<void> }
    let scanner: SI | null = null

    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      scanner = new Html5QrcodeScanner(
        'scanner-container',
        { fps: 10, qrbox: { width: 260, height: 160 }, rememberLastUsedCamera: true },
        false
      ) as SI

      scanner.render(async (texto) => {
        if (processando.current) return
        processando.current = true
        setStatus('processando')

        const { cep, endereco, bairro } = await extrairCepAutomatico(texto)

        if (cep) {
          await salvarEntrega(texto, cep, endereco, bairro)
        } else {
          setStatus('aguardando')
          abrirFallback(texto)
        }
      }, () => {})

      scannerInstance.current = scanner
    })

    return () => { scanner?.clear().catch(() => {}) }
  }, [userId])

  const scannerInstance = useRef<unknown>(null)

  async function salvarEntrega(codigo: string, cep: string, endereco: string, bairro = '') {
    const { error } = await supabase.from('entregas').insert({
      user_id: userId,
      codigo,
      cep,
      endereco,
      bairro,
      status: 'pendente',
    })
    if (error) {
      setStatus('erro')
    } else {
      setStatus('sucesso')
      setTotalHoje(n => n + 1)
    }
    setTimeout(() => { setStatus('aguardando'); processando.current = false }, 1800)
  }

  function abrirFallback(codigo: string) {
    setPendente({ codigo })
    setCepManual('')
    setQd('')
    setLote('')
    setNumero('')
    setPreview(null)
  }

  function fecharFallback() {
    setPendente(null)
    setPreview(null)
    processando.current = false
  }

  async function onCepChange(valor: string) {
    const n = valor.replace(/\D/g, '').slice(0, 8)
    const formatado = n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n
    setCepManual(formatado)
    setPreview(null)
    if (n.length === 8) {
      setBuscandoCep(true)
      const det = await buscarEnderecoDetalhado(n)
      setPreview(det)
      setBuscandoCep(false)
    }
  }

  async function confirmar() {
    if (!pendente) return
    const numeros = cepManual.replace(/\D/g, '')
    if (numeros.length !== 8) return
    setSalvando(true)
    const cep = formatarCep(numeros)
    const det = preview ?? await buscarEnderecoDetalhado(numeros)
    const endereco = det ? montarEndereco(det, { numero, qd, lote }) : cep
    const bairro = det?.bairro ?? ''
    await salvarEntrega(pendente.codigo, cep, endereco, bairro)
    fecharFallback()
    setSalvando(false)
  }

  const cepValido = cepManual.replace(/\D/g, '').length === 8

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <div className="bg-blue-600 text-white px-4 pt-10 pb-6">
        <h1 className="text-xl font-bold">📷 Escanear Etiqueta</h1>
        <p className="text-blue-200 text-sm mt-1">{totalHoje} pacotes adicionados hoje</p>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Status */}
        {status === 'sucesso' && (
          <div className="bg-green-100 text-green-700 rounded-xl p-3 text-center font-medium">
            ✅ Pacote adicionado!
          </div>
        )}
        {status === 'erro' && (
          <div className="bg-red-100 text-red-700 rounded-xl p-3 text-center font-medium">
            ❌ Erro ao salvar. Tente novamente.
          </div>
        )}
        {status === 'processando' && (
          <div className="bg-blue-100 text-blue-700 rounded-xl p-3 text-center font-medium">
            ⏳ Buscando endereço...
          </div>
        )}

        {/* Scanner */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div id="scanner-container" ref={scannerRef} />
        </div>

        <p className="text-center text-xs text-gray-400">
          Aponte para o código de barras ou QR code da etiqueta
        </p>

        {/* Fallback manual */}
        {pendente && (
          <div className="bg-white rounded-2xl shadow-md p-4 border border-yellow-300">
            <p className="text-sm font-semibold text-gray-700 mb-1">
              CEP não identificado automaticamente
            </p>
            <p className="text-xs text-gray-400 font-mono break-all mb-4">
              {pendente.codigo.slice(0, 80)}
            </p>

            {/* CEP */}
            <label className="text-xs font-medium text-gray-600 mb-1 block">CEP *</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="00000-000"
              value={cepManual}
              onChange={e => onCepChange(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-mono tracking-widest text-center focus:outline-none focus:border-blue-500 mb-2"
              autoFocus
            />
            {buscandoCep && <p className="text-xs text-gray-400 mb-2">Buscando...</p>}
            {preview && (
              <p className="text-xs text-green-600 font-medium mb-4">
                📍 {preview.logradouro ? `${preview.logradouro}, ` : ''}{preview.bairro} — {preview.localidade}/{preview.uf}
              </p>
            )}

            {/* QD / Lote / Número — aparecem quando CEP válido */}
            {cepValido && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">QD</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ex: 5"
                    value={qd}
                    onChange={e => setQd(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base text-center focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Lote</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ex: 12"
                    value={lote}
                    onChange={e => setLote(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base text-center focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Número</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ex: 218"
                    value={numero}
                    onChange={e => setNumero(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base text-center focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={fecharFallback}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={!cepValido || salvando}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-40"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>

      <NavBar />
    </div>
  )
}
