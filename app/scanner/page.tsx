'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { extrairCep, buscarEndereco } from '@/lib/utils'
import NavBar from '@/components/NavBar'

export default function Scanner() {
  const router = useRouter()
  const scannerRef = useRef<HTMLDivElement>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<'aguardando' | 'processando' | 'sucesso' | 'erro'>('aguardando')
  const [ultimoCodigo, setUltimoCodigo] = useState('')
  const [totalHoje, setTotalHoje] = useState(0)
  const scannerInstance = useRef<unknown>(null)
  const processando = useRef(false)

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
          setUltimoCodigo(decodedText)

          const cep = extrairCep(decodedText)
          const endereco = cep ? await buscarEndereco(cep) : ''

          const { error } = await supabase.from('entregas').insert({
            user_id: userId,
            codigo: decodedText,
            cep: cep || 'Desconhecido',
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
        },
        () => {}
      )

      scannerInstance.current = html5QrcodeScanner
    })

    return () => {
      html5QrcodeScanner?.clear().catch(() => {})
    }
  }, [userId])

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

        {/* Scanner */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div id="scanner-container" ref={scannerRef} />
        </div>

        {ultimoCodigo && (
          <div className="mt-4 bg-white rounded-xl p-3 shadow-sm">
            <p className="text-xs text-gray-500">Último código:</p>
            <p className="text-sm font-mono text-gray-800 break-all mt-1">{ultimoCodigo}</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-4">
          Aponte a câmera para o código de barras ou QR code da etiqueta
        </p>
      </div>

      <NavBar />
    </div>
  )
}
