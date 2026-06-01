import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import axios from 'axios'
import crypto from 'crypto'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect(process.env.MONGODB_URI || '')
  .then(() => console.log('Collection Service: MongoDB connected!'))
  .catch(err => console.error('Collection Service: MongoDB failed:', err))

// Auth middleware — calls auth service to verify token
const authMiddleware = async (req: Request, res: Response, next: any) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'No token' })
    const authRes = await axios.post(`${process.env.AUTH_SERVICE_URL}/verify`, { token })
    if (!authRes.data.valid) return res.status(401).json({ error: 'Invalid token' })
    ;(req as any).userId = authRes.data.userId
    next()
  } catch {
    res.status(401).json({ error: 'Auth failed' })
  }
}

// Models
const headerSchema = new mongoose.Schema({ key: String, value: String, enabled: Boolean }, { _id: false })

const requestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, default: 'Untitled Request' },
  method: { type: String, default: 'GET' },
  url: { type: String, required: true },
  headers: [headerSchema],
  params: [headerSchema],
  body: { type: String, default: '' },
  collectionId: { type: mongoose.Schema.Types.ObjectId, default: null },
  createdAt: { type: Date, default: Date.now }
})

const collectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  isShared: { type: Boolean, default: false },
  shareId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
})

const Collection = mongoose.model('Collection', collectionSchema)
const RequestModel = mongoose.model('Request', requestSchema)

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'collection-service' }))

// GET all collections
app.get('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId
  const collections = await Collection.find({ userId }).sort({ createdAt: -1 })
  const requests = await RequestModel.find({ userId }).sort({ createdAt: -1 })
  const result = collections.map(col => ({
    ...col.toObject(),
    requests: requests.filter(r => r.collectionId?.toString() === col._id.toString())
  }))
  const uncategorized = requests.filter(r => !r.collectionId)
  res.json({ collections: result, uncategorized })
})

// POST create collection
app.post('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId
  const { name } = req.body
  const collection = await Collection.create({ userId, name })
  res.status(201).json({ collection })
})

// DELETE collection
app.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  await Collection.findByIdAndDelete(req.params.id)
  res.json({ message: 'Deleted!' })
})

// POST share collection
app.post('/:id/share', authMiddleware, async (req: Request, res: Response) => {
  const shareId = crypto.randomBytes(8).toString('hex')
  const collection = await Collection.findByIdAndUpdate(
    req.params.id,
    { isShared: true, shareId },
    { returnDocument: 'after' }
  )
  res.json({ shareId: collection?.shareId })
})

// POST unshare
app.post('/:id/unshare', authMiddleware, async (req: Request, res: Response) => {
  await Collection.findByIdAndUpdate(req.params.id, { isShared: false, shareId: null })
  res.json({ message: 'Unshared!' })
})

// GET shared collection (public)
app.get('/shared/:shareId', async (req: Request, res: Response) => {
  const collection = await Collection.findOne({ shareId: req.params.shareId, isShared: true })
  if (!collection) return res.status(404).json({ error: 'Not found' })
  const requests = await RequestModel.find({ collectionId: collection._id })
  res.json({ collection, requests })
})

// POST import shared collection
app.post('/import/:shareId', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId
  const original = await Collection.findOne({ shareId: req.params.shareId, isShared: true })
  if (!original) return res.status(404).json({ error: 'Not found' })
  const requests = await RequestModel.find({ collectionId: original._id })
  const newCollection = await Collection.create({ userId, name: `${original.name} (imported)` })
  await Promise.all(requests.map(r => RequestModel.create({
    userId, name: r.name, method: r.method, url: r.url,
    headers: r.headers, params: r.params, body: r.body,
    collectionId: newCollection._id
  })))
  res.json({ message: 'Imported!', collection: newCollection })
})

// POST save request
app.post('/requests', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId
  const { name, method, url, headers, params, body, collectionId } = req.body
  const request = await RequestModel.create({ userId, name, method, url, headers, params, body, collectionId: collectionId || null })
  res.status(201).json({ request })
})

// PUT update request
app.put('/requests/:id', authMiddleware, async (req: Request, res: Response) => {
  const request = await RequestModel.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' })
  res.json({ request })
})

// DELETE request
app.delete('/requests/:id', authMiddleware, async (req: Request, res: Response) => {
  await RequestModel.findByIdAndDelete(req.params.id)
  res.json({ message: 'Deleted!' })
})

// ─── Doc-generation helpers ───────────────────────────────────────────────────

function slugify(name: string) {
  return name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() || 'docs'
}

function buildDoc(name: string, requests: any[]) {
  let baseUrl = ''
  if (requests.length > 0) {
    try { baseUrl = new URL(requests[0].url).origin } catch { /* ignore */ }
  }
  const endpoints = requests.map(r => {
    let path = r.url
    try { path = new URL(r.url).pathname } catch { /* ignore */ }
    let body: object | null = null
    if (r.body) { try { body = JSON.parse(r.body) } catch { /* ignore */ } }
    return {
      name: r.name || 'Untitled',
      method: r.method,
      path,
      fullUrl: r.url,
      headers: (r.headers || []).filter((h: any) => h.key && h.enabled !== false),
      params:  (r.params  || []).filter((p: any) => p.key && p.enabled !== false),
      body,
      bodyRaw: r.body || ''
    }
  })
  return { name, generatedAt: new Date().toISOString(), baseUrl, endpoints }
}

function generateMarkdown(doc: any): string {
  let md = `# ${doc.name}\n\n`
  md += `> Generated at ${new Date(doc.generatedAt).toLocaleString()}\n\n`
  md += `**Base URL:** \`${doc.baseUrl || 'N/A'}\`  \n`
  md += `**Endpoints:** ${doc.endpoints.length}\n\n---\n\n`
  for (const ep of doc.endpoints) {
    md += `## \`${ep.method}\` ${ep.path}\n\n`
    md += `**${ep.name}**\n\n`
    md += `**Full URL:** \`${ep.fullUrl}\`\n\n`
    if (ep.headers.length > 0) {
      md += `### Headers\n\n| Key | Value |\n|-----|-------|\n`
      ep.headers.forEach((h: any) => { md += `| \`${h.key}\` | \`${h.value}\` |\n` })
      md += '\n'
    }
    if (ep.params.length > 0) {
      md += `### Query Parameters\n\n| Key | Example Value |\n|-----|---------------|\n`
      ep.params.forEach((p: any) => { md += `| \`${p.key}\` | \`${p.value}\` |\n` })
      md += '\n'
    }
    if (ep.body) {
      md += `### Request Body\n\n\`\`\`json\n${JSON.stringify(ep.body, null, 2)}\n\`\`\`\n\n`
    }
    md += `---\n\n`
  }
  md += `_Generated by API Playground_\n`
  return md
}

function generateHtml(doc: any): string {
  const esc = (s: string) =>
    String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  const methodColors: Record<string, string> = {
    GET:    'background:#064e3b;color:#6ee7b7',
    POST:   'background:#1e3a5f;color:#93c5fd',
    PUT:    'background:#713f12;color:#fde68a',
    DELETE: 'background:#7f1d1d;color:#fca5a5',
    PATCH:  'background:#7c2d12;color:#fdba74',
  }

  let html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(doc.name)} – API Docs</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:2rem;background:#0f1117;color:#e2e8f0}
h1{color:#fff;margin-bottom:.25rem}
h2{color:#93c5fd;font-family:monospace;font-size:1rem;margin:.5rem 0}
h3{color:#64748b;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin:1rem 0 .5rem}
.badge{display:inline-block;padding:2px 10px;border-radius:4px;font-weight:700;font-size:.7rem;font-family:monospace}
code{background:#1e293b;padding:2px 6px;border-radius:3px;font-family:monospace;font-size:.85rem}
pre{background:#1e293b;padding:1rem;border-radius:8px;overflow-x:auto;font-size:.85rem}
table{width:100%;border-collapse:collapse;margin:.75rem 0}
th,td{text-align:left;padding:8px;border-bottom:1px solid #334155}
th{color:#94a3b8;font-size:.7rem;text-transform:uppercase}
.ep{border:1px solid #334155;border-radius:12px;padding:1.5rem;margin:1rem 0}
footer{text-align:center;color:#475569;font-size:.75rem;margin-top:3rem}
hr{border-color:#334155;margin:1.5rem 0}
</style></head><body>
<h1>${esc(doc.name)}</h1>
<p style="color:#64748b"><code>${esc(doc.baseUrl || '')}</code> &middot; ${doc.endpoints.length} endpoint${doc.endpoints.length !== 1 ? 's' : ''}</p><hr>`

  for (const ep of doc.endpoints) {
    const style = methodColors[ep.method] || 'background:#334155;color:#e2e8f0'
    html += `<div class="ep">
<h2><span class="badge" style="${style}">${esc(ep.method)}</span>&nbsp; ${esc(ep.path)}</h2>
<p><strong>${esc(ep.name)}</strong></p>
<p>Full URL: <code>${esc(ep.fullUrl)}</code></p>`
    if (ep.headers.length > 0) {
      html += `<h3>Headers</h3><table><tr><th>Key</th><th>Value</th></tr>`
      ep.headers.forEach((h: any) => {
        html += `<tr><td><code>${esc(h.key)}</code></td><td><code>${esc(h.value)}</code></td></tr>`
      })
      html += `</table>`
    }
    if (ep.params.length > 0) {
      html += `<h3>Query Parameters</h3><table><tr><th>Key</th><th>Example Value</th></tr>`
      ep.params.forEach((p: any) => {
        html += `<tr><td><code>${esc(p.key)}</code></td><td><code>${esc(p.value)}</code></td></tr>`
      })
      html += `</table>`
    }
    if (ep.body) {
      html += `<h3>Request Body</h3><pre><code>${esc(JSON.stringify(ep.body, null, 2))}</code></pre>`
    }
    html += `</div>`
  }
  html += `<footer>Generated by API Playground &middot; ${new Date(doc.generatedAt).toLocaleString()}</footer>
</body></html>`
  return html
}

function generateOpenApi(doc: any): object {
  const paths: Record<string, any> = {}
  for (const ep of doc.endpoints) {
    const method = ep.method.toLowerCase()
    if (!paths[ep.path]) paths[ep.path] = {}
    paths[ep.path][method] = {
      summary: ep.name,
      parameters: [
        ...ep.params.map((p: any) => ({
          name: p.key, in: 'query', example: p.value, schema: { type: 'string' }
        })),
        ...ep.headers.map((h: any) => ({
          name: h.key, in: 'header', example: h.value, schema: { type: 'string' }
        }))
      ],
      ...(ep.body ? {
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' }, example: ep.body } }
        }
      } : {}),
      responses: { '200': { description: 'Successful response' } }
    }
  }
  return {
    openapi: '3.0.0',
    info: { title: doc.name, version: '1.0.0', description: 'Generated by API Playground' },
    servers: [{ url: doc.baseUrl || '/' }],
    paths
  }
}

// ─── Doc endpoints ────────────────────────────────────────────────────────────

// POST /:id/docs — generate documentation (auto-enables sharing)
app.post('/:id/docs', authMiddleware, async (req: Request, res: Response) => {
  try {
    let collection = await Collection.findById(req.params.id)
    if (!collection) return res.status(404).json({ error: 'Collection not found' })

    // Auto-enable sharing so the public /docs/:shareId route works
    if (!collection.shareId) {
      const shareId = crypto.randomBytes(8).toString('hex')
      collection = await Collection.findByIdAndUpdate(
        req.params.id,
        { isShared: true, shareId },
        { returnDocument: 'after' }
      )
    } else if (!collection.isShared) {
      collection = await Collection.findByIdAndUpdate(
        req.params.id,
        { isShared: true },
        { returnDocument: 'after' }
      )
    }

    const requests = await RequestModel.find({ collectionId: collection!._id })
    const doc = buildDoc(collection!.name, requests)

    res.json({ doc, shareId: collection!.shareId })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate documentation' })
  }
})

// GET /docs/:shareId — PUBLIC: fetch or export docs
app.get('/docs/:shareId', async (req: Request, res: Response) => {
  try {
    const { format } = req.query
    const collection = await Collection.findOne({ shareId: req.params.shareId, isShared: true })
    if (!collection) return res.status(404).json({ error: 'Documentation not found or no longer available' })

    const requests = await RequestModel.find({ collectionId: collection._id })
    const doc = buildDoc(collection.name, requests)

    if (format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown')
      res.setHeader('Content-Disposition', `attachment; filename="${slugify(doc.name)}-docs.md"`)
      return res.send(generateMarkdown(doc))
    }
    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html')
      res.setHeader('Content-Disposition', `attachment; filename="${slugify(doc.name)}-docs.html"`)
      return res.send(generateHtml(doc))
    }
    if (format === 'openapi') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="${slugify(doc.name)}-openapi.json"`)
      return res.json(generateOpenApi(doc))
    }

    res.json({ doc })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documentation' })
  }
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => console.log(`Collection Service running on port ${PORT}`))