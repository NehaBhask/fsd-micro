import { useState } from 'react'
import client from '../../api/client'

interface Props {
  collection: { _id: string; name: string; isShared?: boolean; shareId?: string }
  initialTab?: 'share' | 'docs'
  onClose: () => void
  onUpdate: () => void
}

type Tab = 'share' | 'docs'

function ShareModal({ collection, initialTab = 'share', onClose, onUpdate }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)

  // Share state
  const [shareId, setShareId] = useState(collection.shareId || null)
  const [isShared, setIsShared] = useState(collection.isShared || false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  // Docs state
  const [docShareId, setDocShareId] = useState<string | null>(collection.shareId || null)
  const [docsGenerated, setDocsGenerated] = useState(!!collection.shareId)
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsCopied, setDocsCopied] = useState(false)

  const shareUrl = `${window.location.origin}/import/${shareId}`
  const docsUrl  = `${window.location.origin}/docs/${docShareId}`

  // ── Share handlers ──────────────────────────────────────────────────────────
  const handleShare = async () => {
    setShareLoading(true)
    try {
      const res = await client.post(`/api/collections/${collection._id}/share`)
      setShareId(res.data.shareId)
      setIsShared(true)
      onUpdate()
    } catch (err) {
      console.error('Failed to share:', err)
    } finally {
      setShareLoading(false)
    }
  }

  const handleUnshare = async () => {
    setShareLoading(true)
    try {
      await client.post(`/api/collections/${collection._id}/unshare`)
      setShareId(null)
      setIsShared(false)
      setDocShareId(null)
      setDocsGenerated(false)
      onUpdate()
    } catch (err) {
      console.error('Failed to unshare:', err)
    } finally {
      setShareLoading(false)
    }
  }

  const handleShareCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  // ── Docs handlers ───────────────────────────────────────────────────────────
  const handleGenerateDocs = async () => {
    setDocsLoading(true)
    try {
      const res = await client.post(`/api/collections/${collection._id}/docs`)
      setDocShareId(res.data.shareId)
      // sync share state too (docs generation auto-enables sharing)
      if (!isShared) {
        setShareId(res.data.shareId)
        setIsShared(true)
      }
      setDocsGenerated(true)
      onUpdate()
    } catch (err) {
      console.error('Failed to generate docs:', err)
    } finally {
      setDocsLoading(false)
    }
  }

  const handleDocsCopy = () => {
    navigator.clipboard.writeText(docsUrl)
    setDocsCopied(true)
    setTimeout(() => setDocsCopied(false), 2000)
  }

  const handleExport = (format: 'markdown' | 'html' | 'openapi') => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const url = `${base}/api/collections/docs/${docShareId}?format=${format}`
    const a = document.createElement('a')
    a.href = url
    a.click()
  }

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">{collection.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 mb-5">
          {(['share', 'docs'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-semibold capitalize transition-all ${
                tab === t
                  ? 'text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'share' ? '🔗 Share' : '📄 Docs'}
            </button>
          ))}
        </div>

        {/* ── Share Tab ─────────────────────────────────────────────────── */}
        {tab === 'share' && (
          <>
            {!isShared ? (
              <>
                <p className="text-gray-400 text-sm mb-4">
                  Generate a public link so anyone can view and import this collection into their account.
                </p>
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm"
                >
                  {shareLoading ? 'Generating…' : 'Generate Share Link'}
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-sm mb-3">
                  Anyone with this link can view and import this collection:
                </p>
                <div className="flex gap-2 mb-4">
                  <input
                    value={shareUrl}
                    readOnly
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none"
                  />
                  <button
                    onClick={handleShareCopy}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      shareCopied ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                  >
                    {shareCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={handleUnshare}
                  disabled={shareLoading}
                  className="w-full bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-400 py-2 rounded-xl text-sm font-medium"
                >
                  {shareLoading ? 'Disabling…' : 'Disable Share Link'}
                </button>
              </>
            )}
          </>
        )}

        {/* ── Docs Tab ──────────────────────────────────────────────────── */}
        {tab === 'docs' && (
          <>
            {!docsGenerated ? (
              <>
                <p className="text-gray-400 text-sm mb-1">
                  Generate a public, shareable API documentation page from this collection's requests.
                </p>
                <p className="text-gray-600 text-xs mb-4">
                  Includes all endpoints, headers, query params, and request bodies. Exports to HTML, Markdown, and OpenAPI.
                </p>
                <button
                  onClick={handleGenerateDocs}
                  disabled={docsLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm"
                >
                  {docsLoading ? 'Generating docs…' : '✨ Generate Documentation'}
                </button>
              </>
            ) : (
              <>
                {/* Docs URL */}
                <p className="text-gray-400 text-sm mb-3">Your documentation is live at:</p>
                <div className="flex gap-2 mb-4">
                  <input
                    value={docsUrl}
                    readOnly
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none"
                  />
                  <button
                    onClick={handleDocsCopy}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      docsCopied ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                  >
                    {docsCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* View button */}
                <a
                  href={`/docs/${docShareId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold text-sm mb-4"
                >
                  🔍 View Docs Page
                </a>

                {/* Export options */}
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Export as</p>
                <div className="flex gap-2">
                  {(['markdown', 'html', 'openapi'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => handleExport(fmt)}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-xs font-semibold"
                    >
                      {fmt === 'openapi' ? 'OpenAPI' : fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Regenerate */}
                <button
                  onClick={handleGenerateDocs}
                  disabled={docsLoading}
                  className="w-full mt-3 text-gray-500 hover:text-gray-300 text-xs py-1"
                >
                  {docsLoading ? 'Refreshing…' : '↻ Regenerate docs'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ShareModal