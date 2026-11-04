import express from 'express'

const app = express()
app.use(express.json())

// Health check: the keep-alive ping will hit this later
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

const port = Number(process.env.PORT) || 3001
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})