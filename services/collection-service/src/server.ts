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
app.get('/docs/:shareId', async (req: Request, res: Response) => {
  try {
    const collection = await Collection.findOne({
      shareId: req.params.shareId,
      isShared: true
    })
    if (!collection) return res.status(404).json({ error: 'Not found' })

    const requests = await RequestModel.find({ collectionId: collection._id })
      .sort({ createdAt: 1 })

    const doc = buildDoc(collection, requests)

    const format = req.query.format as string
    if (format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown')
      res.setHeader('Content-Disposition', `attachment; filename="${collection.name}.md"`)
      return res.send(toMarkdown(doc))
    }
    if (format === 'openapi') {
      res.setHeader('Content-Type', 'application/yaml')
      res.setHeader('Content-Disposition', `attachment; filename="${collection.name}.yaml"`)
      return res.send(toOpenAPI(doc))
    }
    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html')
      res.setHeader('Content-Disposition', `attachment; filename="${collection.name}.html"`)
      return res.send(toHTML(doc))
    }

    res.json({ doc })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate docs' })
  }
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

function buildDoc(collection: any, requests: any[]) {
  return {
    name: collection.name,
    generatedAt: new Date().toISOString(),
    baseUrl: deriveBaseUrl(requests),
    endpoints: requests.map(r => ({
      name: r.name,
      method: r.method,
      path: derivePathFromUrl(r.url),
      fullUrl: r.url,
      headers: (r.headers || []).filter((h: any) => h.enabled && h.key),
      params: (r.params || []).filter((p: any) => p.enabled && p.key),
      body: tryParseBody(r.body),
      bodyRaw: r.body,
    }))
  }
}

function deriveBaseUrl(requests: any[]): string {
  if (!requests.length) return ''
  try {
    const first = new URL(requests[0].url)
    return `${first.protocol}//${first.host}`
  } catch { return '' }
}

function derivePathFromUrl(url: string): string {
  try { return new URL(url).pathname } catch { return url }
}

function tryParseBody(body: string) {
  if (!body?.trim()) return null
  try { return JSON.parse(body) } catch { return null }
}

function toMarkdown(doc: any): string {
  const lines: string[] = [
    `# ${doc.name}`,
    ``,
    `> Generated ${new Date(doc.generatedAt).toLocaleDateString()}`,
    ``,
    `**Base URL:** \`${doc.baseUrl}\``,
    ``,
    `---`,
    ``,
  ]

  for (const ep of doc.endpoints) {
    lines.push(`## ${ep.name}`)
    lines.push(``)
    lines.push(`\`\`\``)
    lines.push(`${ep.method} ${ep.path}`)
    lines.push(`\`\`\``)
    lines.push(``)

    if (ep.headers.length) {
      lines.push(`### Headers`)
      lines.push(`| Key | Value |`)
      lines.push(`|-----|-------|`)
      for (const h of ep.headers) {
        lines.push(`| \`${h.key}\` | \`${h.value}\` |`)
      }
      lines.push(``)
    }

    if (ep.params.length) {
      lines.push(`### Query parameters`)
      lines.push(`| Key | Value |`)
      lines.push(`|-----|-------|`)
      for (const p of ep.params) {
        lines.push(`| \`${p.key}\` | \`${p.value}\` |`)
      }
      lines.push(``)
    }

    if (ep.body) {
      lines.push(`### Request body`)
      lines.push(`\`\`\`json`)
      lines.push(JSON.stringify(ep.body, null, 2))
      lines.push(`\`\`\``)
      lines.push(``)
    }

    lines.push(`---`)
    lines.push(``)
  }

  return lines.join('\n')
}

function toOpenAPI(doc: any): string {
  const paths: Record<string, any> = {}

  for (const ep of doc.endpoints) {
    const path = ep.path || '/'
    if (!paths[path]) paths[path] = {}

    const method = ep.method.toLowerCase()
    const op: any = {
      summary: ep.name,
      parameters: [
        ...ep.params.map((p: any) => ({
          name: p.key,
          in: 'query',
          schema: { type: 'string' },
          example: p.value,
        })),
        ...ep.headers.map((h: any) => ({
          name: h.key,
          in: 'header',
          schema: { type: 'string' },
          example: h.value,
        })),
      ],
      responses: { '200': { description: 'Success' } },
    }

    if (ep.body && ['post', 'put', 'patch'].includes(method)) {
      op.requestBody = {
        content: {
          'application/json': {
            schema: { type: 'object' },
            example: ep.body,
          },
        },
      }
    }

    paths[path][method] = op
  }

  return [
    `openapi: 3.0.0`,
    `info:`,
    `  title: "${doc.name}"`,
    `  version: "1.0.0"`,
    `servers:`,
    `  - url: "${doc.baseUrl}"`,
    `paths:`,
    ...Object.entries(paths).flatMap(([path, methods]) => [
      `  "${path}":`,
      ...Object.entries(methods).flatMap(([method, op]: [string, any]) => [
        `    ${method}:`,
        `      summary: "${op.summary}"`,
        `      responses:`,
        `        "200":`,
        `          description: Success`,
      ]),
    ]),
  ].join('\n')
}

function toHTML(doc: any): string {
  const endpointBlocks = doc.endpoints.map((ep: any) => {
    const methodColor = {
      GET: '#1D9E75', POST: '#378ADD', PUT: '#BA7517',
      PATCH: '#D85A30', DELETE: '#E24B4A'
    }[ep.method] || '#888'

    const headersHTML = ep.headers.length ? `
      <table><tr><th>Key</th><th>Value</th></tr>
      ${ep.headers.map((h: any) => `<tr><td><code>${h.key}</code></td><td><code>${h.value}</code></td></tr>`).join('')}
      </table>` : ''

    const bodyHTML = ep.body ? `
      <pre><code>${JSON.stringify(ep.body, null, 2)}</code></pre>` : ''

    return `
      <div class="endpoint">
        <div class="ep-header">
          <span class="method" style="background:${methodColor}">${ep.method}</span>
          <code class="path">${ep.path}</code>
          <span class="ep-name">${ep.name}</span>
        </div>
        ${headersHTML ? `<div class="section"><h4>Headers</h4>${headersHTML}</div>` : ''}
        ${bodyHTML ? `<div class="section"><h4>Request body</h4>${bodyHTML}</div>` : ''}
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${doc.name} — API Docs</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 14px; margin-bottom: 32px; }
  .endpoint { border: 1px solid #e5e5e5; border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
  .ep-header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #fafafa; }
  .method { color: white; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; letter-spacing: .5px; }
  .path { font-size: 14px; font-weight: 500; }
  .ep-name { color: #666; font-size: 13px; margin-left: auto; }
  .section { padding: 16px; border-top: 1px solid #e5e5e5; }
  .section h4 { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: #888; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #f0f0f0; }
  th { color: #888; font-weight: 500; }
  pre { background: #f6f6f6; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 0; }
  code { font-family: monospace; font-size: 13px; }
</style>
</head>
<body>
<h1>${doc.name}</h1>
<div class="meta">Base URL: <code>${doc.baseUrl}</code> &nbsp;·&nbsp; Generated ${new Date(doc.generatedAt).toLocaleDateString()}</div>
${endpointBlocks}
</body>
</html>`
}

const PORT = process.env.PORT || 3002
app.listen(PORT, () => console.log(`Collection Service running on port ${PORT}`))