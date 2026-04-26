export function formatarCep(cep: string): string {
  const numeros = cep.replace(/\D/g, '')
  return numeros.replace(/(\d{5})(\d{3})/, '$1-$2')
}

export interface EnderecoDetalhado {
  logradouro: string
  bairro: string
  localidade: string
  uf: string
}

export async function buscarEnderecoDetalhado(cep: string): Promise<EnderecoDetalhado | null> {
  const numeros = cep.replace(/\D/g, '')
  if (numeros.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${numeros}/json/`)
    const data = await res.json()
    if (data.erro) return null
    return {
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      localidade: data.localidade || '',
      uf: data.uf || '',
    }
  } catch {
    return null
  }
}

export function montarEndereco(det: EnderecoDetalhado, numero?: string): string {
  const num = numero?.trim()
  const partes = [det.logradouro, num].filter(Boolean).join(', ')
  return `${partes}, ${det.bairro} - ${det.localidade}/${det.uf}`
}

export async function buscarEndereco(cep: string): Promise<string> {
  const det = await buscarEnderecoDetalhado(cep)
  return det ? montarEndereco(det) : ''
}

// Testa todas as sequências de 8 dígitos do código em paralelo contra o ViaCEP.
// Funciona para QR codes (que contêm o CEP no texto) e barcodes onde o CEP está embutido.
export async function extrairCepAutomatico(codigo: string): Promise<{ cep: string; endereco: string; bairro: string }> {
  const numeros = codigo.replace(/\D/g, '')

  const candidatos = new Set<string>()
  for (let i = 0; i <= numeros.length - 8; i++) {
    const sub = numeros.slice(i, i + 8)
    if (parseInt(sub) >= 1000000) candidatos.add(sub)
  }

  if (candidatos.size === 0) return { cep: '', endereco: '', bairro: '' }

  const resultados = await Promise.all(
    [...candidatos].map(async (c) => {
      const det = await buscarEnderecoDetalhado(c)
      return det
        ? { cep: formatarCep(c), endereco: montarEndereco(det), bairro: det.bairro }
        : { cep: '', endereco: '', bairro: '' }
    })
  )

  return resultados.find(r => r.endereco !== '') ?? { cep: '', endereco: '', bairro: '' }
}
