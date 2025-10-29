const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5000", "http://localhost:5174"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5000", "http://localhost:5174"],
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(express.json());

// Track connected clients
let connectedClients = 0;
let lastScannedCard = null;
let lastScannedTime = null;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`✅ Client connected. Total clients: ${connectedClients}`);

  // Send initial reader status
  socket.emit('reader_status', { connected: true, ready: true });

  // If there was a recent card scan, send it to the newly connected client
  if (lastScannedCard && lastScannedTime && (Date.now() - lastScannedTime < 5000)) {
    console.log(`📤 Sending recent card scan to new client: ${lastScannedCard}`);
    socket.emit('card_scanned', { uid: lastScannedCard });
  }

  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`❌ Client disconnected. Total clients: ${connectedClients}`);
  });
});

// Simple function to broadcast card UID to all connected clients
function broadcastCardUID(cardUid) {
  console.log(`📡 Broadcasting card UID to ${connectedClients} client(s): ${cardUid}`);

  // Store the last scanned card for new connections
  lastScannedCard = cardUid;
  lastScannedTime = Date.now();

  // Broadcast to all connected clients
  io.emit('card_scanned', { uid: cardUid });

  return { success: true, uid: cardUid, clients: connectedClients };
}

// Endpoint for card reader Python script to send card UIDs
app.post('/api/card-scan', (req, res) => {
  const { card_uid } = req.body;

  if (!card_uid) {
    return res.status(400).json({ error: 'card_uid is required' });
  }

  console.log(`📇 Card scanned: ${card_uid}`);
  const result = broadcastCardUID(card_uid);
  res.json(result);
});

// Manual test endpoint for simulating card scans
app.post('/api/simulate-scan', (req, res) => {
  const { card_uid } = req.body;

  if (!card_uid) {
    return res.status(400).json({ error: 'card_uid is required' });
  }

  console.log(`🧪 Simulated card scan: ${card_uid}`);
  const result = broadcastCardUID(card_uid);
  res.json(result);
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    connectedClients,
    lastScannedCard,
    lastScannedTime: lastScannedTime ? new Date(lastScannedTime).toISOString() : null
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎴  CARD READER SERVER - SIMPLE UID BROADCASTER  🎴    ║
║                                                           ║
║   Server running on: http://localhost:${PORT}              ║
║   Socket.IO ready for connections                        ║
║                                                           ║
║   Endpoints:                                              ║
║   POST /api/card-scan      - Receive card UID            ║
║   POST /api/simulate-scan  - Test card scanning          ║
║   GET  /api/status         - Server status               ║
║                                                           ║
║   This server ONLY broadcasts card UIDs.                 ║
║   Frontend handles all API calls to backend.             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
