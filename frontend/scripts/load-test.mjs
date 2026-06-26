import axios from "axios"
import { io } from "socket.io-client"
import { performance } from "node:perf_hooks"

const baseUrl = process.env.LOAD_API_URL || "http://localhost/api"
const realtimeUrl = process.env.LOAD_WS_URL || "http://localhost/realtime"
const userCount = Number(process.env.LOAD_USERS || 10)
const messagesPerUser = Number(process.env.LOAD_MESSAGES || 5)
const password = "LoadTest123!"
const stamp = Date.now()

const percentile = (values, percentage) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentage) - 1)]
}

async function register(index) {
  const email = `load-${stamp}-${index}@example.com`
  await axios.post(`${baseUrl}/auth/register`, {
    name: `Load User ${index}`,
    email,
    password,
  })
  return { email, password }
}

async function login(credentials) {
  const startedAt = performance.now()
  const { data: auth } = await axios.post(`${baseUrl}/auth/login`, credentials)
  const { data: profile } = await axios.get(`${baseUrl}/auth/validate`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  })
  return {
    ...profile,
    token: auth.accessToken,
    latency: performance.now() - startedAt,
    config: { headers: { Authorization: `Bearer ${auth.accessToken}` } },
  }
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(realtimeUrl, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    })
    const timer = setTimeout(() => {
      socket.close()
      reject(new Error("WebSocket connection timeout"))
    }, 10000)
    socket.once("connect", () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.once("connect_error", reject)
  })
}

function waitForDeliveries(sockets, chatId, expectedPerSocket) {
  return new Promise((resolve, reject) => {
    const counts = new Map(sockets.map((socket) => [socket.id, 0]))
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Realtime timeout: ${[...counts.values()].reduce((a, b) => a + b, 0)}/` +
            `${expectedPerSocket * sockets.length} deliveries`,
        ),
      )
    }, 30000)

    const onMessage = (socket) => (message) => {
      if (message.chatId !== chatId) return
      counts.set(socket.id, counts.get(socket.id) + 1)
      if ([...counts.values()].every((count) => count >= expectedPerSocket)) {
        clearTimeout(timeout)
        resolve([...counts.values()].reduce((a, b) => a + b, 0))
      }
    }

    sockets.forEach((socket) => socket.on("message.created", onMessage(socket)))
  })
}

const sockets = []

try {
  console.log("Distributed chat load test")
  console.log(`Target: ${baseUrl}`)
  console.log(`Users: ${userCount}; messages/user: ${messagesPerUser}`)

  const credentials = await Promise.all(
    Array.from({ length: userCount }, (_, index) => register(index + 1)),
  )

  const loginStartedAt = performance.now()
  const users = await Promise.all(credentials.map(login))
  const loginElapsed = performance.now() - loginStartedAt
  console.log(
    `Concurrent logins: ${users.length}/${userCount} passed in ${loginElapsed.toFixed(0)} ms ` +
      `(p95 ${percentile(users.map((user) => user.latency), 0.95).toFixed(0)} ms)`,
  )

  sockets.push(...(await Promise.all(users.map((user) => connect(user.token)))))
  console.log(`WebSocket connections: ${sockets.length}/${userCount} established`)

  const admin = users[0]
  const { data: group } = await axios.post(
    `${baseUrl}/chats`,
    {
      type: "group",
      name: `Load Test ${stamp}`,
      participantIds: users.slice(1).map((user) => user.id),
    },
    admin.config,
  )

  const totalMessages = userCount * messagesPerUser
  const deliveryPromise = waitForDeliveries(sockets, group.id, totalMessages)
  const messageLatencies = []
  const messageStartedAt = performance.now()
  const requests = users.flatMap((user, userIndex) =>
    Array.from({ length: messagesPerUser }, async (_, messageIndex) => {
      const startedAt = performance.now()
      await axios.post(
        `${baseUrl}/chats/${group.id}/messages`,
        { content: `load-${userIndex + 1}-${messageIndex + 1}` },
        user.config,
      )
      messageLatencies.push(performance.now() - startedAt)
    }),
  )
  await Promise.all(requests)
  const messageElapsed = performance.now() - messageStartedAt
  const deliveries = await deliveryPromise

  const { data: history } = await axios.get(
    `${baseUrl}/chats/${group.id}/messages?limit=100`,
    admin.config,
  )

  console.log(
    `Concurrent messages: ${totalMessages}/${totalMessages} passed in ` +
      `${messageElapsed.toFixed(0)} ms (${(totalMessages / (messageElapsed / 1000)).toFixed(1)} req/s)`,
  )
  console.log(
    `HTTP latency: p50 ${percentile(messageLatencies, 0.5).toFixed(0)} ms; ` +
      `p95 ${percentile(messageLatencies, 0.95).toFixed(0)} ms`,
  )
  console.log(
    `Realtime deliveries: ${deliveries}/${totalMessages * userCount} received`,
  )
  console.log(`Persistence: ${history.length}/${totalMessages} messages found`)

  if (history.length !== totalMessages) {
    throw new Error("Persisted message count differs from sent message count")
  }
  console.log("RESULT: PASS")
} finally {
  sockets.forEach((socket) => socket.close())
}
