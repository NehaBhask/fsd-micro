import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-900 text-green-300',
  POST: 'bg-blue-900 text-blue-300',
  PUT: 'bg-yellow-900 text-yellow-300',
  PATCH: 'bg-orange-900 text-orange-300',
  DELETE: 'bg-red-900 text-red-300',
}

interface Endpoint {
  name: string
  method: string
  path: string
  fullUrl: string
  headers: { key: string; value: string }[]
  params: { key: string; value: string }[]
  body: object | null
  bodyRaw: string
}

interface Doc {
  name: string
  generatedAt: string
  baseUrl: string
  endpoints: Endpoint[]
}

function DocsPage() {
  const { shareId } = useParams()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeEp, setActiveEp] = useState<string | null>(null)

  useEffect(() => {
    client.get(`/api/collections/docs/${shareId}`)
      .then(res => setDoc(res.data.doc))
      .catch(() => setError('Documentation not found or no longer available.'))
      .finally(() => setLoading(false))
  }, [shareId])

  const download = (format: string) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const url = `${base}/api/collections/docs/${shareId}?format=${format}`
    const a = document.createElement('a')
    a.href = url
    a.click()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Loading documentation...</p>
    </div>
  )

  if (error || !doc) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-red-400">{error}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{doc.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {doc.baseUrl} · {doc.endpoints.length} endpoints
            </p>
          </div>
          <div className="flex gap-2">
            {(['markdown', 'html', 'openapi'] as const).map(fmt => (
              <button
                key={fmt}
                onClick={() => download(fmt)}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg font-medium"
              >
                {fmt === 'openapi' ? 'OpenAPI' : fmt.charAt(0).toUpperCase() + fmt.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Endpoint list */}
        <div className="space-y-3">
          {doc.endpoints.map((ep, i) => {
            const key = `${ep.method}-${i}`
            const isOpen = activeEp === key
            return (
              <div key={key} className="border border-gray-800 rounded-xl overflow-hidden">
                {/* Summary row */}
                <button
                  onClick={() => setActiveEp(isOpen ? null : key)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-900 text-left"
                >
                  <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${METHOD_COLORS[ep.method] || 'bg-gray-800 text-gray-400'}`}>
                    {ep.method}
                  </span>
                  <code className="text-sm text-gray-200 font-mono">{ep.path}</code>
                  <span className="text-sm text-gray-500 ml-2">{ep.name}</span>
                  <span className="ml-auto text-gray-600 text-xs">{isOpen ? '▲' : '▼'}</span>
                </button>

                {/* Detail panel */}
                {isOpen && (
                  <div className="border-t border-gray-800 bg-gray-950">
                    {/* Full URL */}
                    <div className="px-5 py-4 border-b border-gray-800">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Full URL</p>
                      <code className="text-sm text-gray-300 bg-gray-800 px-3 py-1.5 rounded block">
                        {ep.fullUrl}
                      </code>
                    </div>

                    {/* Headers */}
                    {ep.headers.length > 0 && (
                      <div className="px-5 py-4 border-b border-gray-800">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Headers</p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-600 text-xs">
                              <th className="text-left pb-2 font-medium">Key</th>
                              <th className="text-left pb-2 font-medium">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ep.headers.map((h, j) => (
                              <tr key={j} className="border-t border-gray-800">
                                <td className="py-2 pr-4">
                                  <code className="text-blue-400">{h.key}</code>
                                </td>
                                <td className="py-2">
                                  <code className="text-gray-400">{h.value}</code>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Query params */}
                    {ep.params.length > 0 && (
                      <div className="px-5 py-4 border-b border-gray-800">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Query parameters</p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-600 text-xs">
                              <th className="text-left pb-2 font-medium">Key</th>
                              <th className="text-left pb-2 font-medium">Example value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ep.params.map((p, j) => (
                              <tr key={j} className="border-t border-gray-800">
                                <td className="py-2 pr-4"><code className="text-green-400">{p.key}</code></td>
                                <td className="py-2"><code className="text-gray-400">{p.value}</code></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Request body */}
                    {ep.body && (
                      <div className="px-5 py-4">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Request body</p>
                        <pre className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto font-mono">
                          {JSON.stringify(ep.body, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-center text-gray-700 text-xs mt-8">
          Generated by API Playground · {new Date(doc.generatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

export default DocsPage