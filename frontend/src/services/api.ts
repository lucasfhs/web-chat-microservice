import axios from "axios"
import { io, type Socket } from "socket.io-client"

const TOKEN_KEY = "bytetalk.accessToken"
const USER_KEY = "bytetalk.user"

export interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  createdAt?: string
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  content: string
  createdAt: string
  readBy: string[]
  deliveryStatus?: "pending" | "sent" | "failed"
}

export interface ChatParticipant {
  userId: string
  role: "admin" | "member"
  createdAt: string
}

export interface Chat {
  id: string
  name: string | null
  type: "private" | "group"
  adminId: string
  participants: ChatParticipant[]
  messages?: Message[]
  createdAt: string
  updatedAt: string
}

interface LoginResponse {
  accessToken: string
  tokenType: "Bearer"
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
})

api.interceptors.request.use((config) => {
  const token = session.getToken()
  if (token && !config.headers.get("Authorization")) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const session = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUser: (): User | null => {
    const value = localStorage.getItem(USER_KEY)
    return value ? (JSON.parse(value) as User) : null
  },
  set: (token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  setUser: (user: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}

export const authService = {
  async login(data: { email: string; password: string }) {
    const { data: login } = await api.post<LoginResponse>("/auth/login", data)
    const { data: user } = await api.get<User>("/auth/validate", {
      headers: { Authorization: `Bearer ${login.accessToken}` },
    })
    session.set(login.accessToken, user)
    return user
  },
  async register(data: { name: string; email: string; password: string }) {
    await api.post<User>("/auth/register", data)
    return this.login({ email: data.email, password: data.password })
  },
  async logout() {
    try {
      await api.post("/auth/logout")
    } finally {
      session.clear()
    }
  },
  async users(search = "") {
    const { data } = await api.get<User[]>("/auth/users", {
      params: search ? { search } : undefined,
    })
    return data
  },
  async updateAvatar(avatarUrl: string) {
    const { data: user } = await api.put<User>("/auth/avatar", { avatarUrl })
    session.setUser(user)
    return user
  },
}

export const chatService = {
  async list() {
    const { data } = await api.get<Chat[]>("/chats")
    return data
  },
  async create(payload: {
    type: "private" | "group"
    name?: string
    participantIds: string[]
  }) {
    const { data } = await api.post<Chat>("/chats", payload)
    return data
  },
  async messages(chatId: string) {
    const { data } = await api.get<Message[]>(`/chats/${chatId}/messages`)
    return data
  },
  async sendMessage(chatId: string, content: string) {
    const { data } = await api.post<Message>(`/chats/${chatId}/messages`, {
      content,
    })
    return data
  },
  async markRead(chatId: string) {
    const { data } = await api.post<{
      messageIds: string[]
      readBy: string
      readAt: string
    }>(`/chats/${chatId}/read`)
    return data
  },
  async addParticipant(chatId: string, userId: string) {
    await api.post(`/chats/${chatId}/participants`, { userId })
  },
  async removeParticipant(chatId: string, userId: string) {
    await api.delete(`/chats/${chatId}/participants/${userId}`)
  },
}

export function connectRealtime(): Socket {
  return io(import.meta.env.VITE_WS_URL || "/realtime", {
    auth: { token: session.getToken() },
    transports: ["websocket"],
  })
}
