export function formatarCep(cep: string): string {
  const numeros = cep.replace(/\D/g, '')
  return numeros.replace(/(\d{5})(\d{3})/, '$1-$2')
}

export async function buscarEndereco(cep: string): Promise<string> {
  const numeros = cep.replace(/\D/g, '')
  if (numeros.length !== 8) return ''
  try {
    const res = await fetch(`https://viacep.com.br/ws/${numeros}/json/`)
    const data = await res.json()
    if (data.erro) return ''
    return `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`
  } catch {
    return ''
  }
}

// Testa todas as sequências de 8 dígitos do código em paralelo contra o ViaCEP.
// Funciona para QR codes (que contêm o CEP no texto) e barcodes onde o CEP está embutido.
export async function extrairCepAutomatico(codigo: string): Promise<{ cep: string; endereco: string }> {
  const numeros = codigo.replace(/\D/g, '')

  const candidatos = new Set<string>()
  for (let i = 0; i <= numeros.length - 8; i++) {
    const sub = numeros.slice(i, i + 8)
    if (parseInt(sub) >= 1000000) candidatos.add(sub)
  }

  if (candidatos.size === 0) return { cep: '', endereco: '' }

  const resultados = await Promise.all(
    [...candidatos].map(async (c) => {
      const endereco = await buscarEndereco(c)
      return { cep: formatarCep(c), endereco }
    })
  )

  return resultados.find(r => r.endereco !== '') ?? { cep: '', endereco: '' }
}
