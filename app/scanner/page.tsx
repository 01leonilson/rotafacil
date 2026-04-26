'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { extrairCepAutomatico, buscarEnderecoDetalhado, montarEndereco, formatarCep, type EnderecoDetalhado } from '@/lib/utils'
import NavBar from '@/components/NavBar'

type Modo = 'foto' | 'barcode'
type Status = 'aguardando' | 'lendo' | 'sucesso' | 'erro'

export default function Scanner() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [totalHoje, setTotalHoje] = useState(0)
  const [modo, setModo] = useState<Modo>('foto')
  const [status, setStatus] = useState<Status>('aguardando')
  const [mensagem, setMensagem] = useState('')

  // Barcode scanner
  const scannerRef = useRef<HTMLDivElement>(null)
  const scannerInstance = useRef<unknown>(null)
  const processando = useRef(false)

  // Foto / OCR
  const inputFotoRef = useRef<HTMLInputElement>(null)

  // Fallback manual
  const [pendente, setPendente] = useState<{ codigo: string } | null>(null)
  const [cepManual, setCepManual] = useState('')
  const [numeroManual, setNumeroManual] = useState('')
  const [enderecoPreview, setEnderecoPreview] = useState<EnderecoDetalhado | null>(null)
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

  // Inicializa barcode scanner quando modo = barcode
  useEffect(() => {
    if (modo !== 'barcode' || !userId || !scannerRef.current) return

    type SI = { render: (ok: (t: string) => void, err: () => void) => void; clear: () => Promise<void> }
    let scanner: SI | null = null

    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      scanner = new Html5QrcodeScanner(
        'scanner-container',
        { fps: 10, qrbox: { width: 250, height: 150 }, rememberLastUsedCamera: true },
        false
      ) as SI

      scanner.render(async (texto) => {
        if (processando.current) return
        processando.current = true
        setStatus('lendo')
        setMensagem('Buscando endereço...')

        const { cep, endereco, bairro } = await extrairCepAutomatico(texto)

        if (cep) {
          await salvarEntrega(texto, cep, endereco, bairro)
        } else {
          setStatus('aguardando')
          setMensagem('')
          setPendente({ codigo: texto })
          setCepManual('')
        }
      }, () => {})

      scannerInstance.current = scanner
    })

    return () => { scanner?.clear().catch(() => {}) }
  }, [modo, userId])

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
      setMensagem('Erro ao salvar. Tente novamente.')
    } else {
      setStatus('sucesso')
      setMensagem('Pacote adicionado!')
      setTotalHoje(n => n + 1)
    }

    setTimeout(() => {
      setStatus('aguardando')
      setMensagem('')
      processando.current = false
    }, 1800)
  }

  async function processarFoto(arquivo: File) {
    setStatus('lendo')
    setMensagem('Lendo etiqueta...')

    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      const { data: { text } } = await worker.recognize(arquivo)
      await worker.terminate()

      const { cep, endereco, bairro } = await extrairCepAutomatico(text)

      if (cep) {
        await salvarEntrega(text, cep, endereco, bairro)
      } else {
        setStatus('aguardando')
        setMensagem('')
        setPendente({ codigo: text.slice(0, 60) })
        setCepManual('')
      }
    } catch {
      setStatus('erro')
      setMensagem('Erro ao ler imagem. Tente novamente.')
      setTimeout(() => { setStatus('aguardando'); setMensagem('') }, 2000)
    }
  }

  async function onCepChange(valor: string) {
    const formatado = formatarInput(valor)
    setCepManual(formatado)
    setEnderecoPreview(null)
    const numeros = formatado.replace(/\D/g, '')
    if (numeros.length === 8) {
      const det = await buscarEnderecoDetalhado(numeros)
      setEnderecoPreview(det)
    }
  }

  async function confirmarCepManual() {
    if (!pendente) return
    const numeros = cepManual.replace(/\D/g, '')
    if (numeros.length !== 8) return
    setSalvando(true)
    const cep = formatarCep(numeros)
    const det = enderecoPreview ?? await buscarEnderecoDetalhado(numeros)
    const endereco = det ? montarEndereco(det, numeroManual) : ''
    const bairro = det?.bairro ?? ''
    await salvarEntrega(pendente.codigo, cep, endereco, bairro)
    setPendente(null)
    setEnderecoPreview(null)
    setNumeroManual('')
    setSalvando(false)
  }

  function formatarInput(valor: string) {
    const n = valor.replace(/\D/g, '').slice(0, 8)
    return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n
  }

  const lendo = status === 'lendo'

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <div className="bg-blue-600 text-white px-4 pt-10 pb-6">
        <h1 className="text-xl font-bold">📷 Escanear Etiqueta</h1>
        <p className="text-blue-200 text-sm mt-1">{totalHoje} pacotes adicionados hoje</p>
      </div>

      <div className="px-4 mt-4">
        {/* Toggle de modo */}
        <div className="flex bg-white rounded-xl p-1 shadow-sm mb-4">
          <button
            onClick={() => setModo('foto')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${modo === 'foto' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
          >
            📸 Fotografar Etiqueta
          </button>
          <button
            onClick={() => setModo('barcode')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${modo === 'barcode' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
          >
            🔲 Código de Barras
          </button>
        </div>

        {/* Feedback de status */}
        {status === 'sucesso' && (
          <div className="bg-green-100 text-green-700 rounded-xl p-3 mb-4 text-center font-medium">
            ✅ {mensagem}
          </div>
        )}
        {status === 'erro' && (
          <div className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-center font-medium">
            ❌ {mensagem}
          </div>
        )}

        {/* Modo foto (OCR) */}
        {modo === 'foto' && (
          <>
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                const arquivo = e.target.files?.[0]
                if (arquivo) processarFoto(arquivo)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => inputFotoRef.current?.click()}
              disabled={lendo}
              className="w-full bg-blue-600 text-white rounded-2xl py-16 flex flex-col items-center justify-center gap-3 shadow-sm active:bg-blue-700 disabled:opacity-60"
            >
              {lendo ? (
                <>
                  <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-base font-medium">{mensagem}</span>
                </>
              ) : (
                <>
                  <span className="text-5xl">📸</span>
                  <span className="text-base font-semibold">Fotografar Etiqueta</span>
                  <span className="text-blue-200 text-sm">Aponte para o endereço impresso</span>
                </>
              )}
            </button>
          </>
        )}

        {/* Modo barcode */}
        {modo === 'barcode' && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <div id="scanner-container" ref={scannerRef} />
          </div>
        )}

        {/* Fallback CEP manual */}
        {pendente && (
          <div className="bg-white rounded-2xl shadow-md p-4 mt-4 border border-yellow-300">
            <p className="text-sm font-semibold text-gray-700 mb-1">CEP não identificado</p>
            <p className="text-xs text-gray-400 break-all mb-3">{pendente.codigo}</p>

            <label className="text-xs text-gray-500 mb-1 block">CEP da etiqueta</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="00000-000"
              value={cepManual}
              onChange={e => onCepChange(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-mono tracking-widest text-center focus:outline-none focus:border-blue-500 mb-2"
              autoFocus
            />

            {enderecoPreview && (
              <>
                <p className="text-xs text-green-600 font-medium mb-3">
                  {enderecoPreview.logradouro}, {enderecoPreview.bairro} — {enderecoPreview.localidade}/{enderecoPreview.uf}
                </p>
                <label className="text-xs text-gray-500 mb-1 block">Número</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 218"
                  value={numeroManual}
                  onChange={e => setNumeroManual(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-center focus:outline-none focus:border-blue-500 mb-3"
                />
              </>
            )}

            {!enderecoPreview && cepManual.replace(/\D/g, '').length === 8 && (
              <p className="text-xs text-gray-400 mb-3">Buscando endereço...</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setPendente(null); setEnderecoPreview(null); setNumeroManual(''); processando.current = false }}
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
      </div>

      <NavBar />
    </div>
  )
}
