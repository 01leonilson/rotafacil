'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const itens = [
  { href: '/dashboard', label: 'Entregas', icon: '📦' },
  { href: '/scanner', label: 'Escanear', icon: '📷' },
  { href: '/historico', label: 'Histórico', icon: '📋' },
]

export default function NavBar() {
  const path = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
      {itens.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${
            path === item.href ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <span className="text-xl">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
