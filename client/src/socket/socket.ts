import { io, Socket } from 'socket.io-client'

// Единственный экземпляр сокета для всего приложения
let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const url = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000'
    socket = io(url, {
      autoConnect: false,
    })
  }
  return socket
}

export function connectSocket(): void {
  const s = getSocket()
  if (!s.connected) s.connect()
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
