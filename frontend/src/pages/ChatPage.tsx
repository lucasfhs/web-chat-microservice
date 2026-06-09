import { useEffect, useMemo, useRef, useState } from "react"
import {
  Camera,
  Check,
  CheckCheck,
  CircleAlert,
  Clock,
  LogOut,
  MessageSquare,
  Plus,
  Send,
  Shield,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import type { Socket } from "socket.io-client"

import { Button } from "@/components/ui/button"
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/ui/themeToggle"
import {
  authService,
  chatService,
  connectRealtime,
  session,
  type Chat,
  type Message,
  type User,
} from "@/services/api"

interface ReadEvent {
  chatId: string
  messageIds: string[]
  readBy: string
  readAt: string
}

interface RemovedEvent {
  chatId: string
  removedUserId: string
}

interface PresenceEvent {
  userId: string
}

interface PresenceListEvent {
  userIds: string[]
}

export function ChatPage() {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(() => session.getUser())
  const [users, setUsers] = useState<User[]>([])
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [chats, setChats] = useState<Chat[]>([])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [pageVisible, setPageVisible] = useState(
    () => document.visibilityState === "visible",
  )
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [groupMode, setGroupMode] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  )
  const currentUserId = currentUser?.id
  const selectedChat = chats.find((chat) => chat.id === selectedChatId)
  const selectedMessages = selectedChatId ? messages[selectedChatId] || [] : []

  const upsertChat = (chat: Chat) => {
    setChats((previous) => {
      const withoutChat = previous.filter((item) => item.id !== chat.id)
      return [chat, ...withoutChat]
    })
  }

  useEffect(() => {
    if (!currentUserId || !session.getToken()) {
      navigate("/login")
      return
    }
    Promise.all([authService.users(), chatService.list()])
      .then(([availableUsers, availableChats]) => {
        setUsers(availableUsers)
        setChats(availableChats)
      })
      .catch(() => {
        session.clear()
        navigate("/login")
      })
  }, [currentUserId, navigate])

  useEffect(() => {
    if (!currentUserId) return
    const socket: Socket = connectRealtime()

    socket.on("connect", () => {
      setRealtimeConnected(true)
      socket.emit("presence.get")
    })
    socket.on("disconnect", () => {
      setRealtimeConnected(false)
      setOnlineUserIds(new Set())
    })
    socket.on("connect_error", () => setRealtimeConnected(false))
    socket.io.on("reconnect", () => {
      setMessages({})
      void chatService.list().then(setChats).catch(() => undefined)
      void authService.users().then(setUsers).catch(() => undefined)
    })
    socket.on("presence.list", (event: PresenceListEvent) => {
      setOnlineUserIds(new Set(event.userIds))
    })
    socket.on("user.online", (event: PresenceEvent) => {
      setOnlineUserIds((previous) => new Set(previous).add(event.userId))
      void authService.users().then(setUsers).catch(() => undefined)
    })
    socket.on("user.offline", (event: PresenceEvent) => {
      setOnlineUserIds((previous) => {
        const updated = new Set(previous)
        updated.delete(event.userId)
        return updated
      })
      void authService.users().then(setUsers).catch(() => undefined)
    })
    socket.on("message.created", (message: Message) => {
      setMessages((previous) => {
        const existing = previous[message.chatId] || []
        if (existing.some((item) => item.id === message.id)) return previous
        return {
          ...previous,
          [message.chatId]: [
            ...existing,
            { ...message, deliveryStatus: "sent" },
          ],
        }
      })
      setChats((previous) => {
        if (!previous.some((chat) => chat.id === message.chatId)) {
          void chatService.list().then(setChats).catch(() => undefined)
        }
        return [...previous].sort((a, b) =>
          a.id === message.chatId ? -1 : b.id === message.chatId ? 1 : 0,
        )
      })
    })
    socket.on("message.read", (event: ReadEvent) => {
      const ids = new Set(event.messageIds)
      setMessages((previous) => ({
        ...previous,
        [event.chatId]: (previous[event.chatId] || []).map((message) =>
          ids.has(message.id) && !message.readBy.includes(event.readBy)
            ? { ...message, readBy: [...message.readBy, event.readBy] }
            : message,
        ),
      }))
    })
    socket.on("chat.created", (chat: Chat) => {
      upsertChat(chat)
      if (chat.adminId !== currentUserId) {
        toast.info(`Você foi adicionado ao grupo ${chat.name || ""}.`)
      }
    })
    socket.on("participant.added", (chat: Chat) => {
      upsertChat(chat)
    })
    socket.on("participant.removed", (event: RemovedEvent) => {
      if (event.removedUserId === currentUserId) {
        setChats((previous) =>
          previous.filter((chat) => chat.id !== event.chatId),
        )
        setMessages((previous) => {
          const updated = { ...previous }
          delete updated[event.chatId]
          return updated
        })
        setSelectedChatId((selected) =>
          selected === event.chatId ? null : selected,
        )
        setShowMembers(false)
        toast.warning("Você foi removido de um grupo.")
        return
      }
      void chatService.list().then(setChats).catch(() => undefined)
    })

    return () => {
      socket.io.removeAllListeners()
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [currentUserId])

  useEffect(() => {
    const handleVisibility = () =>
      setPageVisible(document.visibilityState === "visible")
    document.addEventListener("visibilitychange", handleVisibility)
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility)
  }, [])

  useEffect(() => {
    if (!selectedChatId || messages[selectedChatId]) return
    chatService
      .messages(selectedChatId)
      .then((history) => {
        setMessages((previous) => {
          const realtimeMessages = previous[selectedChatId] || []
          const merged = new Map(
            [...history, ...realtimeMessages].map((message) => [
              message.id,
              { ...message, deliveryStatus: "sent" as const },
            ]),
          )
          return {
            ...previous,
            [selectedChatId]: [...merged.values()].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            ),
          }
        })
      })
      .catch(() => toast.error("Não foi possível carregar as mensagens."))
  }, [messages, selectedChatId])

  useEffect(() => {
    if (!selectedChatId || !selectedMessages.length || !pageVisible) return
    void chatService.markRead(selectedChatId).then((receipt) => {
      if (!receipt.messageIds.length) return
      const ids = new Set(receipt.messageIds)
      setMessages((previous) => ({
        ...previous,
        [selectedChatId]: (previous[selectedChatId] || []).map((message) =>
          ids.has(message.id) && !message.readBy.includes(receipt.readBy)
            ? { ...message, readBy: [...message.readBy, receipt.readBy] }
            : message,
        ),
      }))
    })
  }, [pageVisible, selectedChatId, selectedMessages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selectedMessages.length])

  const userName = (userId: string) => {
    if (userId === currentUser?.id) return currentUser.name
    return usersById.get(userId)?.name || "Usuário"
  }

  const chatName = (chat: Chat) => {
    if (chat.type === "group") return chat.name || "Grupo"
    const otherId = chat.participants.find(
      (participant) => participant.userId !== currentUser?.id,
    )?.userId
    return otherId ? userName(otherId) : "Conversa privada"
  }

  const sendMessage = async () => {
    if (!selectedChatId || !input.trim() || !currentUser) return
    const content = input.trim()
    const temporaryId = `pending-${crypto.randomUUID()}`
    const pendingMessage: Message = {
      id: temporaryId,
      chatId: selectedChatId,
      senderId: currentUser.id,
      content,
      createdAt: new Date().toISOString(),
      readBy: [],
      deliveryStatus: "pending",
    }
    setInput("")
    setMessages((previous) => ({
      ...previous,
      [selectedChatId]: [
        ...(previous[selectedChatId] || []),
        pendingMessage,
      ],
    }))
    try {
      const message = await chatService.sendMessage(selectedChatId, content)
      setMessages((previous) => {
        const withoutPending = (previous[selectedChatId] || []).filter(
          (item) => item.id !== temporaryId,
        )
        const alreadyReceived = withoutPending.some(
          (item) => item.id === message.id,
        )
        return {
          ...previous,
          [selectedChatId]: alreadyReceived
            ? withoutPending
            : [
                ...withoutPending,
                { ...message, deliveryStatus: "sent" },
              ],
        }
      })
    } catch {
      setMessages((previous) => ({
        ...previous,
        [selectedChatId]: (previous[selectedChatId] || []).map((message) =>
          message.id === temporaryId
            ? { ...message, deliveryStatus: "failed" }
            : message,
        ),
      }))
      toast.error("Não foi possível enviar a mensagem.")
    }
  }

  const createChat = async () => {
    if (!selectedUsers.length) {
      toast.error("Selecione pelo menos um participante.")
      return
    }
    if (groupMode && !groupName.trim()) {
      toast.error("Informe o nome do grupo.")
      return
    }
    try {
      const chat = await chatService.create({
        type: groupMode ? "group" : "private",
        name: groupMode ? groupName.trim() : undefined,
        participantIds: groupMode ? selectedUsers : [selectedUsers[0]],
      })
      upsertChat(chat)
      setSelectedChatId(chat.id)
      closeCreate()
    } catch {
      toast.error("Não foi possível criar a conversa.")
    }
  }

  const addMember = async (userId: string) => {
    if (!selectedChat) return
    try {
      await chatService.addParticipant(selectedChat.id, userId)
      toast.success("Participante adicionado.")
    } catch {
      toast.error("Não foi possível adicionar o participante.")
    }
  }

  const removeMember = async (userId: string) => {
    if (!selectedChat) return
    try {
      await chatService.removeParticipant(selectedChat.id, userId)
      toast.success("Participante removido.")
    } catch {
      toast.error("Não foi possível remover o participante.")
    }
  }

  const closeCreate = () => {
    setShowCreate(false)
    setGroupMode(false)
    setGroupName("")
    setSelectedUsers([])
  }

  const logout = async () => {
    await authService.logout()
    navigate("/login")
  }

  const uploadAvatar = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.")
      return
    }
    setUploadingAvatar(true)
    try {
      const avatarUrl = await resizeAvatar(file)
      const user = await authService.updateAvatar(avatarUrl)
      setCurrentUser(user)
      toast.success("Avatar atualizado.")
    } catch {
      toast.error("Não foi possível atualizar o avatar.")
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ""
    }
  }

  const isMessageRead = (message: Message, chat: Chat) => {
    const expectedReaders = chat.participants
      .map((participant) => participant.userId)
      .filter((userId) => userId !== message.senderId)
    return (
      expectedReaders.length > 0 &&
      expectedReaders.every((userId) => message.readBy.includes(userId))
    )
  }

  if (!currentUser) return null

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950">
      <aside
        className={`w-full max-w-sm flex-col border-r bg-white dark:border-gray-800 dark:bg-gray-900 ${
          selectedChatId ? "hidden md:flex" : "flex"
        }`}
      >
        <header className="flex h-16 items-center justify-between border-b px-4 dark:border-gray-800">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="group relative rounded-full"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Alterar avatar"
            >
              <UserAvatar user={currentUser} className="size-10" />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Camera size={16} />
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void uploadAvatar(event.target.files?.[0])}
            />
            <div className="min-w-0">
              <strong className="block truncate">{currentUser.name}</strong>
              <p
                className={`text-xs ${
                  realtimeConnected ? "text-green-500" : "text-amber-500"
                }`}
              >
                {uploadingAvatar
                  ? "Atualizando avatar..."
                  : realtimeConnected
                    ? "Online"
                    : "Reconectando..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setShowCreate(true)}>
              <Plus size={18} />
            </Button>
            <ThemeToggle />
            <Button size="icon" variant="ghost" onClick={logout}>
              <LogOut size={18} />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-400">
              Nenhuma conversa. Crie uma para começar.
            </div>
          )}
          {chats.map((chat) => {
            const lastMessage = (messages[chat.id] || chat.messages || []).at(-1)
            const otherUser =
              chat.type === "private"
                ? usersById.get(
                    chat.participants.find(
                      (participant) => participant.userId !== currentUser.id,
                    )?.userId || "",
                  )
                : undefined
            return (
              <button
                key={chat.id}
                onClick={() => setSelectedChatId(chat.id)}
                className={`flex w-full items-center gap-3 border-b p-4 text-left dark:border-gray-800 ${
                  selectedChatId === chat.id
                    ? "bg-gray-100 dark:bg-gray-800"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                {chat.type === "group" ? (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    <Users size={18} />
                  </span>
                ) : (
                  <UserAvatar
                    user={otherUser}
                    online={Boolean(otherUser && onlineUserIds.has(otherUser.id))}
                    className="size-11"
                  />
                )}
                <span className="min-w-0">
                  <strong className="block truncate text-sm">{chatName(chat)}</strong>
                  <span className="block truncate text-xs text-gray-400">
                    {lastMessage?.content || "Sem mensagens"}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      <main className={`flex-1 flex-col ${selectedChatId ? "flex" : "hidden md:flex"}`}>
        {selectedChat ? (
          <>
            <header className="flex h-16 items-center justify-between border-b bg-white px-5 dark:border-gray-800 dark:bg-gray-900">
              <div>
                <strong>{chatName(selectedChat)}</strong>
                {selectedChat.type === "group" && (
                  <p className="text-xs text-gray-400">
                    {selectedChat.participants.length} participantes
                  </p>
                )}
              </div>
              {selectedChat.type === "group" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMembers(true)}
                >
                  <Users size={16} />
                  Membros
                </Button>
              )}
            </header>
            <section className="flex-1 space-y-3 overflow-y-auto p-5">
              {selectedMessages.map((message) => {
                const mine = message.senderId === currentUser.id
                const read = isMessageRead(message, selectedChat)
                return (
                  <div
                    key={message.id}
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      mine
                        ? "ml-auto bg-emerald-100 dark:bg-emerald-900"
                        : "bg-white dark:bg-gray-800"
                    }`}
                  >
                    {!mine && selectedChat.type === "group" && (
                      <strong className="mb-1 block text-xs text-primary">
                        {userName(message.senderId)}
                      </strong>
                    )}
                    <p>{message.content}</p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-400">
                      <time>
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                      {mine && message.deliveryStatus === "pending" && (
                        <Clock size={12} aria-label="Enviando" />
                      )}
                      {mine && message.deliveryStatus === "failed" && (
                        <CircleAlert size={12} className="text-red-500" />
                      )}
                      {mine && message.deliveryStatus !== "pending" && !read && (
                        <Check size={13} aria-label="Enviada" />
                      )}
                      {mine && read && (
                        <CheckCheck
                          size={14}
                          className="text-blue-500"
                          aria-label="Lida"
                        />
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </section>
            <footer className="flex h-16 items-center gap-3 border-t bg-white px-4 dark:border-gray-800 dark:bg-gray-900">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void sendMessage()}
                placeholder="Digite uma mensagem"
              />
              <Button size="icon" onClick={sendMessage} disabled={!input.trim()}>
                <Send size={18} />
              </Button>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-gray-400">
            <MessageSquare size={48} />
            <p className="mt-3">Selecione uma conversa</p>
          </div>
        )}
      </main>

      {showCreate && (
        <Modal title="Nova conversa" onClose={closeCreate}>
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={groupMode}
              onChange={(event) => {
                setGroupMode(event.target.checked)
                setSelectedUsers([])
              }}
            />
            Criar grupo
          </label>
          {groupMode && (
            <Input
              className="mb-4"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Nome do grupo"
            />
          )}
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {users.map((user) => {
              const selected = selectedUsers.includes(user.id)
              const online = onlineUserIds.has(user.id)
              return (
                <button
                  key={user.id}
                  className={`flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm ${
                    selected ? "bg-primary/10" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                  onClick={() =>
                    setSelectedUsers((previous) =>
                      groupMode
                        ? selected
                          ? previous.filter((id) => id !== user.id)
                          : [...previous, user.id]
                        : [user.id],
                    )
                  }
                >
                  <UserAvatar user={user} online={online} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate">{user.name}</strong>
                    <span className="block truncate text-xs text-gray-400">
                      {user.email}
                    </span>
                  </span>
                  <span
                    className={`text-xs ${online ? "text-green-500" : "text-gray-400"}`}
                  >
                    {online ? "Online" : "Offline"}
                  </span>
                </button>
              )
            })}
          </div>
          <Button className="mt-5 w-full" onClick={createChat}>
            Criar conversa
          </Button>
        </Modal>
      )}

      {showMembers && selectedChat?.type === "group" && (
        <Modal title={`Membros de ${chatName(selectedChat)}`} onClose={() => setShowMembers(false)}>
          <div className="space-y-2">
            {selectedChat.participants.map((participant) => (
              <div
                key={participant.userId}
                className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-800"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar
                    user={
                      participant.userId === currentUser.id
                        ? currentUser
                        : usersById.get(participant.userId)
                    }
                    online={
                      participant.userId === currentUser.id ||
                      onlineUserIds.has(participant.userId)
                    }
                  />
                  <div>
                    <strong className="text-sm">{userName(participant.userId)}</strong>
                    <p className="flex items-center gap-1 text-xs text-gray-400">
                      {participant.role === "admin" && <Shield size={12} />}
                      {participant.role === "admin" ? "Administrador" : "Membro"}
                    </p>
                  </div>
                </div>
                {selectedChat.adminId === currentUser.id &&
                  participant.userId !== selectedChat.adminId && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeMember(participant.userId)}
                    >
                      <UserMinus size={14} />
                      Remover
                    </Button>
                  )}
              </div>
            ))}
          </div>
          {selectedChat.adminId === currentUser.id && (
            <>
              <h3 className="mb-2 mt-5 flex items-center gap-2 text-sm font-semibold">
                <UserPlus size={15} />
                Adicionar pessoas
              </h3>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {users
                  .filter(
                    (user) =>
                      !selectedChat.participants.some(
                        (participant) => participant.userId === user.id,
                      ),
                  )
                  .map((user) => (
                    <button
                      key={user.id}
                      onClick={() => addMember(user.id)}
                      className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <UserAvatar
                        user={user}
                        online={onlineUserIds.has(user.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate">{user.name}</strong>
                        <span className="block truncate text-xs text-gray-400">
                          {user.email}
                        </span>
                      </span>
                      <span
                        className={`text-xs ${
                          onlineUserIds.has(user.id)
                            ? "text-green-500"
                            : "text-gray-400"
                        }`}
                      >
                        {onlineUserIds.has(user.id) ? "Online" : "Offline"}
                      </span>
                    </button>
                  ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}

function UserAvatar({
  user,
  online,
  className,
}: {
  user?: User | null
  online?: boolean
  className?: string
}) {
  const initials =
    user?.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"

  return (
    <Avatar className={className}>
      {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
      <AvatarFallback>{initials}</AvatarFallback>
      {online !== undefined && (
        <AvatarBadge className={online ? "bg-green-500" : "bg-gray-400"} />
      )}
    </Avatar>
  )
}

function resizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Could not read avatar"))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error("Invalid avatar image"))
      image.onload = () => {
        const scale = Math.min(1, 256 / Math.max(image.width, image.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext("2d")
        if (!context) {
          reject(new Error("Canvas is unavailable"))
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)

        let quality = 0.82
        let avatarUrl = canvas.toDataURL("image/webp", quality)
        while (avatarUrl.length > 95_000 && quality > 0.35) {
          quality -= 0.1
          avatarUrl = canvas.toDataURL("image/webp", quality)
        }
        if (avatarUrl.length > 100_000) {
          reject(new Error("Avatar is too large"))
          return
        }
        resolve(avatarUrl)
      }
      image.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
