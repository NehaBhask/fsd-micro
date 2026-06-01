/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { useRequestStore } from '../../store/requestStore'
import ShareModal from './ShareModal'

interface SavedRequest {
  _id: string
  name: string
  method: string
  url: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  headers: any[]
  params: any[]
  body: string
}

interface Collection {
  _id: string
  name: string
  requests: SavedRequest[]
}

interface HistoryEntry {
  _id: string
  method: string
  url: string
  status: number
  responseTime: number
  createdAt: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  headers: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any[]
  body: string
}

const methodColors: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-blue-400',
  PUT: 'text-yellow-400',
  DELETE: 'text-red-400',
  PATCH: 'text-orange-400',
}

function Sidebar() {
  const [shareCollection, setShareCollection] = useState<{ collection: any; tab: 'share' | 'docs' } | null>(null)
  const [expanded, setExpanded] = useState<string[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [uncategorized, setUncategorized] = useState<SavedRequest[]>([])
  const [activeSection, setActiveSection] = useState<'collections' | 'history'>('collections')
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isLoggedIn = !!localStorage.getItem('token')

  const {
    setMethod, setUrl, setHeaders, setParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setBody, setResponse, setLoading, setError
  } = useRequestStore()

  const fetchCollections = async () => {
    try {
      const res = await client.get('/api/collections')
      setCollections(res.data.collections)
      setUncategorized(res.data.uncategorized)
      setExpanded(res.data.collections.map((c: Collection) => c._id))
    } catch (err) {
      console.error('Failed to fetch collections:', err)
    }
  }

  const fetchHistory = async () => {
    try {
      const res = await client.get('/api/history')
      setHistory(res.data.history)
    } catch (err) {
      console.error('Failed to fetch history:', err)
    }
  }

  useEffect(() => {
    if (!isLoggedIn) return

    const timer = setTimeout(() => {
      fetchCollections()
      fetchHistory()
    }, 0)

    const handleRequestSaved = () => fetchCollections()
    const handleHistorySaved = () => fetchHistory()

    window.addEventListener('requestSaved', handleRequestSaved)
    window.addEventListener('historySaved', handleHistorySaved)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('requestSaved', handleRequestSaved)
      window.removeEventListener('historySaved', handleHistorySaved)
    }
  }, [isLoggedIn])

  const toggleCollection = (id: string) => {
    setExpanded(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const loadRequest = (req: SavedRequest | HistoryEntry) => {
    setMethod(req.method)
    setUrl(req.url)
    setHeaders(req.headers?.length ? req.headers : [{ key: '', value: '', enabled: true }])
    setParams(req.params?.length ? req.params : [{ key: '', value: '', enabled: true }])
    setBody(req.body || '')
    setResponse(null)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const handleNewRequest = () => {
    setMethod('GET')
    setUrl('')
    setHeaders([{ key: '', value: '', enabled: true }])
    setParams([{ key: '', value: '', enabled: true }])
    setBody('{\n  \n}')
    setResponse(null)
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="h-full flex flex-col">

      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">API Playground</h1>
      </div>

      {/* New Request Button */}
      <div className="p-3">
        <button
          onClick={handleNewRequest}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
        >
          <span>+</span> New Request
        </button>
      </div>

      {/* Section Tabs */}
      <div className="flex border-b border-gray-800 px-2">
        <button
          onClick={() => setActiveSection('collections')}
          className={`flex-1 py-2 text-xs font-semibold transition-all ${
            activeSection === 'collections'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Collections
        </button>
        <button
          onClick={() => setActiveSection('history')}
          className={`flex-1 py-2 text-xs font-semibold transition-all ${
            activeSection === 'history'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          History
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-2 py-2">

        {/* Collections Section */}
        {activeSection === 'collections' && (
          <div>
            {/* Uncategorized requests */}
            {uncategorized.length > 0 && (
              <div className="mb-2">
                {uncategorized.map(req => (
                  <button
                    key={req._id}
                    onClick={() => loadRequest(req)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800 text-left"
                  >
                    <span className={`text-xs font-bold w-12 ${methodColors[req.method]}`}>
                      {req.method}
                    </span>
                    <span className="text-sm text-gray-400 truncate">{req.name}</span>
                  </button>
                ))}
              </div>
            )}
            {uncategorized.map(req => (
              <div key={req._id} className="flex items-center rounded-lg hover:bg-gray-800 group/req">
                <button
                  onClick={() => loadRequest(req)}
                  className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left"
                >
                  <span className={`text-xs font-bold w-12 ${methodColors[req.method]}`}>
                    {req.method}
                  </span>
                  <span className="text-sm text-gray-400 truncate">{req.name}</span>
                </button>

                <button
                  onClick={async () => {
                    await client.delete(`/api/requests/${req._id}`)
                    fetchCollections()
                  }}
                  className="opacity-0 group-hover/req:opacity-100 text-red-400 hover:text-red-300 px-2 py-1.5 text-xs transition-opacity"
                >
                  🗑️
                </button>
              </div>
            ))}

            {/* Empty state */}
            {collections.length === 0 && uncategorized.length === 0 && (
              <p className="text-xs text-gray-600 px-2 mt-2">
                No saved requests yet. Send a request and click Save!
              </p>
            )}

            {/* Collections */}
            {collections.map(collection => (
              <div key={collection._id} className="mb-1 group/col">
                <div className="flex items-center rounded-lg hover:bg-gray-800">
                  <button
                    onClick={() => toggleCollection(collection._id)}
                    className="flex-1 flex items-center gap-2 px-2 py-2 text-left"
                  >
                    <span className="text-gray-400 text-xs">
                      {expanded.includes(collection._id) ? '▼' : '▶'}
                    </span>
                    <span className="text-sm text-gray-300 font-medium truncate">
                      {collection.name}
                    </span>
                    <span className="text-xs text-gray-600 ml-auto">
                      {collection.requests.length}
                    </span>
                  </button>
                  {/* Docs button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShareCollection({ collection, tab: 'docs' }) }}
                    className="opacity-0 group-hover/col:opacity-100 text-indigo-400 hover:text-indigo-300 px-1 py-2 text-xs transition-opacity"
                    title="Generate docs"
                  >
                    📄
                  </button>
                  {/* Share button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShareCollection({ collection, tab: 'share' }) }}
                    className="opacity-0 group-hover/col:opacity-100 text-blue-400 hover:text-blue-300 px-1 py-2 text-xs transition-opacity"
                    title="Share collection"
                  >
                    🔗
                  </button>

                  {/* Delete collection button - shows on hover */}
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete "${collection.name}"?`)) return
                      await client.delete(`/api/collections/${collection._id}`)
                      fetchCollections()
                    }}
                    className="opacity-0 group-hover/col:opacity-100 text-red-400 hover:text-red-300 px-2 py-2 text-xs transition-opacity"
                  >
                    🗑️
                  </button>
                </div>

    {expanded.includes(collection._id) && (
      <div className="ml-4">
        {collection.requests.length === 0 && (
          <p className="text-xs text-gray-700 px-2 py-1">Empty collection</p>
        )}
        {collection.requests.map(req => (
          <div key={req._id} className="flex items-center rounded-lg hover:bg-gray-800 group/req">
            <button
              onClick={() => loadRequest(req)}
              className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left"
            >
              <span className={`text-xs font-bold w-12 ${methodColors[req.method]}`}>
                {req.method}
              </span>
              <span className="text-sm text-gray-400 truncate">{req.name}</span>
            </button>

            {/* Delete request button - shows on hover */}
            <button
              onClick={async () => {
                await client.delete(`/api/requests/${req._id}`)
                fetchCollections()
              }}
              className="opacity-0 group-hover/req:opacity-100 text-red-400 hover:text-red-300 px-2 py-1.5 text-xs transition-opacity"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
))}
          </div>
        )}

        {/* History Section */}
        {activeSection === 'history' && (
          <div>
            {/* Clear All Button */}
            {history.length > 0 && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={async () => {
                    await client.delete('/api/history')
                    setHistory([])
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear All
                </button>
              </div>
            )}

            {/* Empty state */}
            {history.length === 0 && (
              <p className="text-xs text-gray-600 px-2 mt-2">
                No history yet. Send a request!
              </p>
            )}

            {/* History Items */}
            {history.map((entry) => {
              const statusColor = entry.status >= 200 && entry.status < 300
                ? 'text-green-400'
                : 'text-red-400'

              return (
                <div key={entry._id} className="flex items-center rounded-lg hover:bg-gray-800 group/hist mb-1">
                  <button
                    onClick={() => loadRequest(entry)}
                    className="flex-1 flex flex-col px-2 py-2 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold w-12 ${methodColors[entry.method]}`}>
                        {entry.method}
                      </span>
                      <span className={`text-xs font-bold ${statusColor}`}>
                        {entry.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {entry.responseTime}ms
                      </span>
                      <span className="text-xs text-gray-600 ml-auto">
                        {formatTime(entry.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5 pl-14">
                      {entry.url}
                    </p>
                  </button>

                  {/* Delete single history item */}
                  <button
                    onClick={async () => {
                      await client.delete(`/api/history/${entry._id}`)
                      fetchHistory()
                    }}
                    className="opacity-0 group-hover/hist:opacity-100 text-red-400 hover:text-red-300 px-2 text-xs transition-opacity"
                  >
                    🗑️
                  </button>
                </div>
              )
            })}
          </div>
        )}

      </div>

      {/* Bottom - User */}
      <div className="p-3 border-t border-gray-800">
        {isLoggedIn ? (
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm truncate">
              👤 {user.name || 'User'}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-gray-800"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="w-full text-gray-400 hover:text-white text-sm py-2 px-3 rounded-lg hover:bg-gray-800"
          >
            Login / Sign Up
          </button>
        )}
      </div>
     {shareCollection && (
  <ShareModal
    collection={shareCollection.collection}
    initialTab={shareCollection.tab}
    onClose={() => setShareCollection(null)}
    onUpdate={fetchCollections}
    />
    )}
    </div>
    
  )
}


export default Sidebar