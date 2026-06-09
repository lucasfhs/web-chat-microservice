import axios from "axios"
import { io } from "socket.io-client"

const baseUrl = process.env.E2E_API_URL || "http://localhost:8080/api"
const realtimeUrl = process.env.E2E_WS_URL || "http://localhost:8080/realtime"
const stamp = Date.now()
const password = "GroupTest123!"

async function createUser(label) {
  const email = `group-${label}-${stamp}@example.com`
  await axios.post(`${baseUrl}/auth/register`, {
    name: `Group ${label}`,
    email,
    password,
  })
  const { data: login } = await axios.post(`${baseUrl}/auth/login`, {
    email,
    password,
  })
  const { data: profile } = await axios.get(`${baseUrl}/auth/validate`, {
    headers: { Authorization: `Bearer ${login.accessToken}` },
  })
  return {
    ...profile,
    token: login.accessToken,
    config: {
      headers: { Authorization: `Bearer ${login.accessToken}` },
    },
  }
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(realtimeUrl, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    })
    const timer = setTimeout(
      () => reject(new Error("Socket connection timeout")),
      5000,
    )
    socket.once("connect", () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.once("connect_error", reject)
  })
}

function waitEvent(socket, eventName, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const handler = (payload) => {
      if (!predicate(payload)) return
      clearTimeout(timer)
      socket.off(eventName, handler)
      resolve(payload)
    }
    const timer = setTimeout(() => {
      socket.off(eventName, handler)
      reject(new Error(`Timeout waiting for ${eventName}`))
    }, 8000)
    socket.on(eventName, handler)
  })
}

const sockets = []

try {
  const [admin, member, invited] = await Promise.all([
    createUser("Admin"),
    createUser("Member"),
    createUser("Invited"),
  ])
  sockets.push(
    ...(await Promise.all([
      connect(admin.token),
      connect(member.token),
      connect(invited.token),
    ])),
  )
  const [adminSocket, memberSocket, invitedSocket] = sockets

  const memberCreated = waitEvent(memberSocket, "chat.created")
  const { data: group } = await axios.post(
    `${baseUrl}/chats`,
    {
      type: "group",
      name: "Realtime E2E",
      participantIds: [member.id],
    },
    admin.config,
  )
  const receivedGroup = await memberCreated
  if (group.adminId !== admin.id || receivedGroup.id !== group.id) {
    throw new Error("Invalid group creation event")
  }

  const invitedAdded = waitEvent(
    invitedSocket,
    "participant.added",
    (chat) => chat.id === group.id,
  )
  await axios.post(
    `${baseUrl}/chats/${group.id}/participants`,
    { userId: invited.id },
    admin.config,
  )
  await invitedAdded

  let nonAdminForbidden = false
  try {
    await axios.delete(
      `${baseUrl}/chats/${group.id}/participants/${invited.id}`,
      member.config,
    )
  } catch (error) {
    nonAdminForbidden = error.response?.status === 403
  }
  if (!nonAdminForbidden) {
    throw new Error("Non-admin was allowed to remove a member")
  }

  const messageForMember = waitEvent(
    memberSocket,
    "message.created",
    (message) => message.chatId === group.id,
  )
  const messageForInvited = waitEvent(
    invitedSocket,
    "message.created",
    (message) => message.chatId === group.id,
  )
  const { data: message } = await axios.post(
    `${baseUrl}/chats/${group.id}/messages`,
    { content: "Read receipt E2E" },
    admin.config,
  )
  await Promise.all([messageForMember, messageForInvited])

  const memberRead = waitEvent(
    adminSocket,
    "message.read",
    (event) =>
      event.readBy === member.id && event.messageIds.includes(message.id),
  )
  await axios.post(`${baseUrl}/chats/${group.id}/read`, {}, member.config)
  await memberRead

  const invitedRead = waitEvent(
    adminSocket,
    "message.read",
    (event) =>
      event.readBy === invited.id && event.messageIds.includes(message.id),
  )
  await axios.post(`${baseUrl}/chats/${group.id}/read`, {}, invited.config)
  await invitedRead

  const { data: history } = await axios.get(
    `${baseUrl}/chats/${group.id}/messages`,
    admin.config,
  )
  const persisted = history.find((item) => item.id === message.id)
  if (
    !persisted?.readBy.includes(member.id) ||
    !persisted.readBy.includes(invited.id)
  ) {
    throw new Error("Read receipts were not persisted")
  }

  const removed = waitEvent(
    invitedSocket,
    "participant.removed",
    (event) =>
      event.chatId === group.id && event.removedUserId === invited.id,
  )
  await axios.delete(
    `${baseUrl}/chats/${group.id}/participants/${invited.id}`,
    admin.config,
  )
  await removed

  const { data: invitedChats } = await axios.get(
    `${baseUrl}/chats`,
    invited.config,
  )
  if (invitedChats.some((chat) => chat.id === group.id)) {
    throw new Error("Removed user still has access to the group")
  }

  console.log("Realtime group E2E passed")
} finally {
  sockets.forEach((socket) => socket.close())
}
