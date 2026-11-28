import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './styles.css'

export const metadata: Metadata = { title: 'Görevli paneli | Zemin Senin', description: 'Kampüs tesisi takvimi ve rezervasyon yönetimi' }

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="tr"><body>{children}</body></html>
}
