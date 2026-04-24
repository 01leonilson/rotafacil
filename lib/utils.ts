export function extrairCep(codigo: string): string {
  const numeros = codigo.replace(/\D/g, '')
  // CEP tem 8 dígitos — tenta encontrar sequência de 8 dígitos no código
  const match = numeros.match(/(\d{8})/)
  if (match) return match[1].replace(/(\d{5})(\d{3})/, '$1-$2')
  return ''
}

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
