import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import type { ReactNode } from 'react'

export const metadata = {
  title: {
    default: 'OpenAsset Market Docs',
    template: '%s | oA Docs',
  },
  description:
    'Single source of truth for the OpenAsset Market protocol — architecture, adapters, loan lifecycle, security, and guides.',
}

const navbar = (
  <Navbar
    logo={
      <span className="flex items-center gap-2 font-bold tracking-tight">
        <span className="inline-block h-5 w-5 rounded-full bg-red-600" />
        <span>oA</span>
        <span className="font-normal text-zinc-400">Docs</span>
      </span>
    }
    projectLink="https://github.com/roadsidedev/redchips"
  />
)

const footer = (
  <Footer>
    {new Date().getFullYear()} © OpenAsset Market. Permissionless asset lending infrastructure.
  </Footer>
)

export default async function DocsLayout({ children }: { children: ReactNode }) {
  const pageMap = await getPageMap('/docs')

  return (
    <>
      <Head />
      <Layout
        navbar={navbar}
        pageMap={pageMap}
        docsRepositoryBase="https://github.com/roadsidedev/redchips/tree/main/web/content"
        footer={footer}
        editLink="Edit this page"
        feedback={{ content: 'Question? Give us feedback' }}
        sidebar={{ defaultMenuCollapseLevel: 1, toggleButton: true }}
        navigation
        darkMode
        nextThemes={{ defaultTheme: 'dark', storageKey: 'oa-docs-theme' }}
      >
        {children}
      </Layout>
    </>
  )
}
