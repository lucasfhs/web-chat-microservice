import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  Search,
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Users,
  User,
  MessageSquare,
  LogOut,
  Plus,
  CheckCheck,
  X,
  ArrowLeft,
  CircleDot,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/ui/themeToggle"
import { cn } from "@/lib/utils"

// Tipagens do Chat
interface Message {
  id: string
  senderName: string
  text?: string
  imageUrl?: string
  timestamp: string
  isMe: boolean
}

interface Chat {
  id: string
  name: string
  type: "private" | "group"
  avatar: string
  lastMessage?: string
  lastMessageTime?: string
  unreadCount: number
  messages: Message[]
  participants: string[]
}

// Contatos mockados para novas conversas
const MOCK_CONTACTS = [
  { name: "Lucas FHS", email: "lucas@example.com", avatar: "L" },
  { name: "Maria Silva", email: "maria@example.com", avatar: "M" },
  { name: "Aline Santos", email: "aline@example.com", avatar: "A" },
  { name: "Carlinhos", email: "carlinhos@example.com", avatar: "F" },
  { name: "Juliana Lima", email: "juliana@example.com", avatar: "J" },
]

// Lista inicial de chats
const INITIAL_CHATS: Chat[] = [
  {
    id: "group-1",
    name: "Trabalho de Sistemas Distribuídos",
    type: "group",
    avatar: "TSD",
    lastMessage: "Felipe: Vocês terminaram a parte do frontend?",
    lastMessageTime: "18:42",
    unreadCount: 2,
    participants: ["Lucas FHS", "Carlinhos", "Aline Santos"],
    messages: [
      {
        id: "m1",
        senderName: "Aline Santos",
        text: "Oi gente, criei a estrutura do projeto backend.",
        timestamp: "18:30",
        isMe: false,
      },
      {
        id: "m2",
        senderName: "Felipe Souza",
        text: "Vocês terminaram a parte do frontend?",
        timestamp: "18:42",
        isMe: false,
      },
    ],
  },
  {
    id: "private-1",
    name: "Maria Silva",
    type: "private",
    avatar: "M",
    lastMessage: "Perfeito, nos vemos na aula amanhã!",
    lastMessageTime: "17:15",
    unreadCount: 0,
    participants: ["Maria Silva"],
    messages: [
      {
        id: "m3",
        senderName: "Maria Silva",
        text: "Você pode me ajudar com o deploy mais tarde?",
        timestamp: "17:10",
        isMe: false,
      },
      {
        id: "m4",
        senderName: "Você",
        text: "Claro! Pelas 19h te dou um toque.",
        timestamp: "17:12",
        isMe: true,
      },
      {
        id: "m5",
        senderName: "Maria Silva",
        text: "Perfeito, nos vemos na aula amanhã!",
        timestamp: "17:15",
        isMe: false,
      },
    ],
  },
]

export function ChatPage() {
  const navigate = useNavigate()
  
  // Estados principais
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS)
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [inputText, setInputText] = useState("")
  const [typingChatId, setTypingChatId] = useState<string | null>(null)

  // Estados dos Modais
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false)
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false)

  // Estados de criação de Grupo
  const [newGroupName, setNewGroupName] = useState("")
  const [selectedGroupParticipants, setSelectedGroupParticipants] = useState<string[]>([])

  // Referência para scroll automático
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Encontra o chat selecionado
  const activeChat = chats.find((c) => c.id === selectedChatId)

  // Rolagem automática para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeChat?.messages, typingChatId])

  // Limpa notificações pendentes do chat selecionado
  useEffect(() => {
    if (selectedChatId) {
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === selectedChatId ? { ...chat, unreadCount: 0 } : chat
        )
      )
    }
  }, [selectedChatId])

  // Formata hora atual
  const getFormattedTime = () => {
    const now = new Date()
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Filtragem de conversas
  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Envia mensagem de texto
  const handleSendMessage = () => {
    if (!inputText.trim() || !selectedChatId) return

    const newMsg: Message = {
      id: `user-m-${Date.now()}`,
      senderName: "Você",
      text: inputText,
      timestamp: getFormattedTime(),
      isMe: true,
    }

    // Adiciona a mensagem ao chat ativo
    updateChatMessages(selectedChatId, newMsg, inputText)
    setInputText("")

    // Simula resposta automática depois de 1.5s
    triggerMockReply(selectedChatId, inputText)
  }

  // Envia imagem
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedChatId) return

    const imageUrl = URL.createObjectURL(file)
    const newMsg: Message = {
      id: `user-img-${Date.now()}`,
      senderName: "Você",
      imageUrl,
      timestamp: getFormattedTime(),
      isMe: true,
    }

    updateChatMessages(selectedChatId, newMsg, "📸 Imagem enviada")

    // Resposta simulada para imagem
    triggerMockReply(selectedChatId, "imagem")
  }

  // Auxiliar para atualizar mensagens de um chat
  const updateChatMessages = (chatId: string, message: Message, lastMsgText: string) => {
    setChats((prevChats) =>
      prevChats.map((chat) => {
        if (chat.id === chatId) {
          const updatedMsgs = [...chat.messages, message]
          return {
            ...chat,
            messages: updatedMsgs,
            lastMessage: message.isMe ? lastMsgText : `${message.senderName}: ${lastMsgText}`,
            lastMessageTime: message.timestamp,
          }
        }
        return chat
      })
    )
  }

  // Simula digitação e resposta do contato/membro do grupo
  const triggerMockReply = (chatId: string, userMsg: string) => {
    setTypingChatId(chatId)

    setTimeout(() => {
      setTypingChatId(null)
      const currentChat = chats.find((c) => c.id === chatId)
      if (!currentChat) return

      let replyText = "Legal! O que você acha de marcarmos uma chamada?"
      let responder = currentChat.type === "private" ? currentChat.name : "Aline Santos"

      if (userMsg.toLowerCase().includes("ajuda") || userMsg.toLowerCase().includes("deploy")) {
        replyText = "Claro, posso ajudar sim. Qual erro está acontecendo?"
      } else if (userMsg.toLowerCase().includes("aula") || userMsg.toLowerCase().includes("amanhã")) {
        replyText = "A aula amanhã começa às 19h no bloco B!"
      } else if (userMsg === "imagem") {
        replyText = "Ficou excelente essa imagem!"
      }

      const replyMsg: Message = {
        id: `reply-${Date.now()}`,
        senderName: responder,
        text: replyText,
        timestamp: getFormattedTime(),
        isMe: false,
      }

      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id === chatId) {
            const updatedMsgs = [...chat.messages, replyMsg]
            return {
              ...chat,
              messages: updatedMsgs,
              lastMessage: chat.type === "private" ? replyText : `${responder}: ${replyText}`,
              lastMessageTime: replyMsg.timestamp,
              unreadCount: selectedChatId === chatId ? 0 : chat.unreadCount + 1,
            }
          }
          return chat
        })
      )
    }, 1500)
  }

  // Cria nova conversa 1:1
  const handleStartPrivateChat = (contactName: string) => {
    // Verifica se conversa já existe
    const existingChat = chats.find(
      (c) => c.type === "private" && c.name === contactName
    )

    if (existingChat) {
      setSelectedChatId(existingChat.id)
      setIsNewChatModalOpen(false)
      return
    }

    const newChat: Chat = {
      id: `private-${Date.now()}`,
      name: contactName,
      type: "private",
      avatar: contactName.charAt(0),
      unreadCount: 0,
      participants: [contactName],
      messages: [],
    }

    setChats((prev) => [newChat, ...prev])
    setSelectedChatId(newChat.id)
    setIsNewChatModalOpen(false)
    toast.success(`Conversa com ${contactName} iniciada!`)
  }

  // Cria novo grupo 1:N
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      toast.error("Por favor, digite o nome do grupo.")
      return
    }
    if (selectedGroupParticipants.length === 0) {
      toast.error("Selecione pelo menos um participante.")
      return
    }

    const newGroup: Chat = {
      id: `group-${Date.now()}`,
      name: newGroupName,
      type: "group",
      avatar: newGroupName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 3),
      unreadCount: 0,
      participants: ["Você", ...selectedGroupParticipants],
      messages: [
        {
          id: `sys-${Date.now()}`,
          senderName: "Sistema",
          text: `Grupo criado com os participantes: ${selectedGroupParticipants.join(", ")}`,
          timestamp: getFormattedTime(),
          isMe: false,
        },
      ],
      lastMessage: "Grupo criado",
      lastMessageTime: getFormattedTime(),
    }

    setChats((prev) => [newGroup, ...prev])
    setSelectedChatId(newGroup.id)
    
    // Reseta form do grupo
    setNewGroupName("")
    setSelectedGroupParticipants([])
    setIsNewGroupModalOpen(false)
    toast.success("Grupo criado com sucesso!")
  }

  const toggleParticipantSelection = (name: string) => {
    setSelectedGroupParticipants((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    )
  }

  return (
    <div className="flex h-screen w-full bg-gray-100 dark:bg-gray-950 overflow-hidden relative">
      
      {/* SIDEBAR */}
      <aside className={cn(
        "w-full md:w-[380px] lg:w-[420px] flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0",
        selectedChatId && "hidden md:flex"
      )}>
        
        {/* Sidebar Header */}
        <div className="h-16 px-4 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg">
              U
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-none text-foreground">Você (Usuário)</h3>
              <span className="text-[11px] text-green-500 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Online
              </span>
            </div>
          </div>
          
          {/* Botões de Ação */}
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              title="Nova conversa privada (1:1)"
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <MessageSquare size={20} />
            </button>
            <button
              onClick={() => setIsNewGroupModalOpen(true)}
              title="Novo grupo (1:N)"
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <Users size={20} />
            </button>
            <ThemeToggle />
            <button
              onClick={() => {
                toast.success("Desconectado com sucesso!")
                navigate("/")
              }}
              title="Sair"
              className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-500 rounded-full transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <div className="relative flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5">
            <Search size={18} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Pesquisar ou começar uma nova conversa"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm w-full outline-none text-foreground placeholder:text-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-foreground">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/50">
          {filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 dark:text-gray-500">
              <CircleDot size={40} className="mb-2 opacity-50" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isSelected = chat.id === selectedChatId
              return (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors relative",
                    isSelected
                      ? "bg-gray-100 dark:bg-gray-800"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  )}
                >
                  {/* Avatar com indicador de tipo */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-primary/5 dark:bg-primary/20 border border-gray-100 dark:border-gray-700 flex items-center justify-center font-bold text-primary">
                      {chat.avatar}
                    </div>
                    <span className="absolute -bottom-1 -right-1 p-0.5 bg-white dark:bg-gray-900 rounded-full shadow-xs">
                      {chat.type === "group" ? (
                        <Users size={12} className="text-blue-500" />
                      ) : (
                        <User size={12} className="text-green-500" />
                      )}
                    </span>
                  </div>

                  {/* Detalhes do Chat */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm text-foreground truncate">{chat.name}</h4>
                      {chat.lastMessageTime && (
                        <span className="text-[11px] text-gray-400">{chat.lastMessageTime}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {chat.lastMessage || "Nenhuma mensagem enviada"}
                    </p>
                  </div>

                  {/* Badge Não Lida */}
                  {chat.unreadCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-green-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </aside>

      {/* CHAT CONTENT */}
      <main className={cn(
        "flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 h-full relative",
        !selectedChatId && "hidden md:flex"
      )}>
        
        {activeChat ? (
          <>
            {/* Header do Chat Ativo */}
            <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSelectedChatId(null)}
                  className="p-1 md:hidden text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                >
                  <ArrowLeft size={20} />
                </button>
                
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                  {activeChat.avatar}
                </div>

                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-foreground truncate">{activeChat.name}</h3>
                  <p className="text-[11px] text-gray-400 truncate">
                    {activeChat.type === "group"
                      ? `${activeChat.participants.length} participantes: ${activeChat.participants.join(", ")}`
                      : "Online"}
                  </p>
                </div>
              </div>

              <div className="flex items-center text-gray-500 dark:text-gray-400">
                <ThemeToggle />
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <Search size={18} />
                </button>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            {/* Mensagens Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#efeae2] dark:bg-gray-950/80 bg-opacity-40">
              {activeChat.messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                  Sem mensagens nesta conversa. Envie uma para começar!
                </div>
              ) : (
                activeChat.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[70%] rounded-lg px-3 py-1.5 shadow-sm text-sm relative group",
                      msg.isMe
                        ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-50 ml-auto rounded-tr-none"
                        : "bg-white dark:bg-gray-800 text-foreground mr-auto rounded-tl-none"
                    )}
                  >
                    {/* Nome do Remetente em Grupo se não for eu */}
                    {activeChat.type === "group" && !msg.isMe && (
                      <span className="text-[10px] font-semibold text-primary block mb-0.5">
                        {msg.senderName}
                      </span>
                    )}

                    {/* Conteúdo da Imagem */}
                    {msg.imageUrl && (
                      <div className="mb-1 rounded overflow-hidden max-w-full">
                        <img
                          src={msg.imageUrl}
                          alt="Imagem compartilhada"
                          className="max-h-60 object-cover w-full"
                        />
                      </div>
                    )}

                    {/* Texto da Mensagem */}
                    {msg.text && <p className="leading-snug pr-8 whitespace-pre-wrap">{msg.text}</p>}

                    {/* Horário e Ticks */}
                    <div className="absolute bottom-1 right-1.5 flex items-center gap-0.5 text-[9px] text-gray-400">
                      <span>{msg.timestamp}</span>
                      {msg.isMe && (
                        <CheckCheck size={12} className="text-blue-500 shrink-0" />
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Indicador de Digitação */}
              {typingChatId === activeChat.id && (
                <div className="bg-white dark:bg-gray-800 text-foreground mr-auto rounded-lg rounded-tl-none px-3 py-1.5 shadow-sm text-xs flex items-center gap-2 max-w-[200px]">
                  <span className="text-gray-400 italic">Digitando</span>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="h-16 px-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center gap-3 shrink-0 z-10">
              
              {/* Menu de anexo */}
              <div className="flex items-center gap-1 text-gray-500">
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <Smile size={20} />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors relative"
                >
                  <Paperclip size={20} />
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </button>
              </div>

              {/* Caixa de Texto */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Digite uma mensagem"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  className="w-full bg-gray-100 dark:bg-gray-800 text-sm rounded-lg px-4 py-2 border-0 outline-none text-foreground placeholder:text-gray-400"
                />
              </div>

              {/* Botão de Enviar */}
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className={cn(
                  "p-2.5 rounded-full flex items-center justify-center transition-all",
                  inputText.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/95 shadow-xs"
                    : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <Send size={18} />
              </button>
            </div>
          </>
        ) : (
          /* Landing Screen */
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-950 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
              <MessageSquare size={40} className="text-primary opacity-60" />
            </div>
            <h2 className="text-xl font-bold text-foreground">ByteTalk Web</h2>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm mt-2">
              Selecione uma conversa na barra lateral para começar a enviar mensagens. Suporta bate-papos privados (1:1) e grupos (1:N).
            </p>
            <div className="mt-8 flex gap-3">
              <Button onClick={() => setIsNewChatModalOpen(true)} variant="outline" size="sm" className="gap-2">
                <User size={14} /> Nova Conversa
              </Button>
              <Button onClick={() => setIsNewGroupModalOpen(true)} size="sm" className="gap-2">
                <Users size={14} /> Novo Grupo
              </Button>
            </div>
            <div className="absolute bottom-6 text-[10px] text-gray-400 flex items-center gap-1">
              <CheckCheck size={12} className="text-blue-500" /> Criptografia de ponta a ponta
            </div>
          </div>
        )}
      </main>

      {/* MODAL: NOVA CONVERSA (1:1) */}
      {isNewChatModalOpen && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 flex flex-col max-h-[85vh]">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-foreground">Iniciar Conversa Privada (1:1)</h3>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              <p className="text-xs text-gray-400">Selecione um contato para começar a conversar:</p>
              <div className="space-y-1">
                {MOCK_CONTACTS.map((contact) => (
                  <div
                    key={contact.email}
                    onClick={() => handleStartPrivateChat(contact.name)}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {contact.avatar}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">{contact.name}</h4>
                      <p className="text-xs text-gray-400">{contact.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO GRUPO (1:N) */}
      {isNewGroupModalOpen && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 flex flex-col max-h-[85vh]">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-foreground">Criar Novo Grupo (1:N)</h3>
              <button
                onClick={() => setIsNewGroupModalOpen(false)}
                className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Nome do grupo */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500">Nome do Grupo</label>
                <Input
                  type="text"
                  placeholder="Ex: Amigos da Faculdade, Squad Frontend..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>

              {/* Seleção de participantes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 block">Adicionar Participantes</label>
                <div className="space-y-1 divide-y divide-gray-50 dark:divide-gray-800">
                  {MOCK_CONTACTS.map((contact) => {
                    const isSelected = selectedGroupParticipants.includes(contact.name)
                    return (
                      <div
                        key={contact.email}
                        onClick={() => toggleParticipantSelection(contact.name)}
                        className="flex items-center justify-between p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-md cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            {contact.avatar}
                          </div>
                          <div>
                            <h4 className="font-semibold text-xs text-foreground">{contact.name}</h4>
                            <p className="text-[10px] text-gray-400">{contact.email}</p>
                          </div>
                        </div>

                        <div className={cn(
                          "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-gray-300 dark:border-gray-700"
                        )}>
                          {isSelected && <Plus size={14} className="rotate-45" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 flex justify-end gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setIsNewGroupModalOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleCreateGroup}>
                Criar Grupo
              </Button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  )
}
