import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { registerHandlers } from './socket/handlers.js'

const PORT = process.env.PORT || 3000

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
})

io.on('connection', (socket) => {
  console.log(`[+] Player connected: ${socket.id}`)
  registerHandlers(io, socket)

  socket.on('disconnect', () => {
    console.log(`[-] Player disconnected: ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
