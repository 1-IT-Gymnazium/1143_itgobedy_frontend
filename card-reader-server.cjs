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
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5000", "http://localhost:5174"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));
app.use(express.json());

// Backend API configuration - adjust this to your actual backend URL
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:5000'; // Flask typically runs on 5000

// Track connected clients
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`✅ Client connected. Total clients: ${connectedClients}`);

  // Send initial reader status
  socket.emit('reader_status', { connected: true, ready: true });

  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`❌ Client disconnected. Total clients: ${connectedClients}`);
  });
});

// Helper function to forward requests to your backend
async function forwardToBackend(endpoint, options = {}) {
  const url = `${BACKEND_API_URL}${endpoint}`;

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Backend API error for ${endpoint}:`, error.message);
    throw error;
  }
}

// Function to handle card scanning with backend integration
async function handleCardScan(cardUid) {
  console.log(`🔍 Processing card scan for UID: ${cardUid}`);

  try {
    // Look up student by card UID in your backend - send as JSON
    const response = await forwardToBackend('/lunch', {
      method: 'POST',
      body: JSON.stringify({ card_uid: cardUid })
    });

    if (response && response.name) {
      // Student found - map backend response to frontend format
      const cardData = {
        student_id: response.id || Date.now(), // Use timestamp as fallback ID if not provided
        student_name: response.name,
        lunch_number: response.Lunch || response.lunch_number || null
      };

      console.log(`👤 Student found:`, cardData);
      io.emit('card_scanned', cardData);
      return { success: true, student: cardData };
    }
  } catch (error) {
    console.log(`❓ Student not found for card: ${cardUid} (${error.message})`);
  }

  // If student not found or backend error, treat as unassigned card
  const cardData = { uid: cardUid };
  console.log(`❓ Unassigned card:`, cardData);
  io.emit('card_scanned', cardData);
  return { success: true, unassigned: true, uid: cardUid };
}

// Temporary in-memory storage for development (fallback when backend endpoints don't exist)
let tempStudents = [
  { id: 1, name: "John Doe", card_uid: "04A1B2C3D4E5F6", lunch_number: 42 },
  { id: 2, name: "Jane Smith", card_uid: "04B2C3D4E5F6A1", lunch_number: 15 },
  { id: 3, name: "Bob Johnson", card_uid: "04C3D4E5F6A1B2", lunch_number: null },
  { id: 4, name: "Alice Brown", card_uid: "04D4E5F6A1B2C3", lunch_number: 28 }
];

// REST API endpoints - Forward to your backend
app.get('/api/students', async (req, res) => {
  try {
    const students = await forwardToBackend('/api/students');
    res.json(students);
  } catch (error) {
    console.log('⚠️  Backend /api/students not available, using fallback data');
    res.json(tempStudents);
  }
});

// Assign card to student endpoint - Forward to your backend
app.post('/api/assign-card', async (req, res) => {
  const { student_name, card_uid } = req.body;

  if (!student_name || !card_uid) {
    return res.status(400).json({
      error: 'Both student_name and card_uid are required'
    });
  }

  try {
    const result = await forwardToBackend('/assign_card', {
      method: 'POST',
      body: JSON.stringify({ student_name, card_uid })
    });

    console.log(`✅ Card assigned via backend: ${student_name} -> ${card_uid}`);
    res.json(result);
  } catch (error) {
    console.log('⚠️  Backend /assign_card not available, using fallback');

    // Check if card is already assigned in temp storage
    const existingStudent = tempStudents.find(s => s.card_uid === card_uid);
    if (existingStudent) {
      return res.status(400).json({
        error: `Card is already assigned to ${existingStudent.name}`
      });
    }

    // Create new student in temp storage
    const newId = Math.max(...tempStudents.map(s => s.id)) + 1;
    const newStudent = {
      id: newId,
      name: student_name,
      card_uid: card_uid,
      lunch_number: null
    };

    tempStudents.push(newStudent);

    console.log(`✅ Card assigned (fallback): ${student_name} -> ${card_uid}`);
    res.json({
      success: true,
      message: 'Card assigned successfully (using fallback storage)',
      student: newStudent
    });
  }
});

// Delete student endpoint - Forward to your backend
app.delete('/api/students/:id', async (req, res) => {
  const studentId = req.params.id;

  if (!studentId || isNaN(parseInt(studentId))) {
    return res.status(400).json({ error: 'Invalid student ID' });
  }

  try {
    const result = await forwardToBackend(`/api/students/${studentId}`, {
      method: 'DELETE'
    });

    console.log(`🗑️ Student deleted via backend (ID: ${studentId})`);
    res.json(result);
  } catch (error) {
    console.log('⚠️  Backend delete endpoint not available, using fallback');

    const studentIndex = tempStudents.findIndex(s => s.id === parseInt(studentId));

    if (studentIndex === -1) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const deletedStudent = tempStudents.splice(studentIndex, 1)[0];

    console.log(`🗑️ Student deleted (fallback): ${deletedStudent.name} (ID: ${studentId})`);
    res.json({
      success: true,
      message: 'Student deleted successfully (using fallback storage)',
      student: deletedStudent
    });
  }
});

// Endpoint for your Flask backend to send card scan data
app.post('/api/card-scan', async (req, res) => {
  const { card_uid } = req.body;

  if (!card_uid) {
    return res.status(400).json({ error: 'card_uid is required' });
  }

  console.log(`📡 Received card scan from Flask backend: ${card_uid}`);
  const result = await handleCardScan(card_uid);
  res.json(result);
});

// Manual test endpoint
app.post('/api/simulate-scan', async (req, res) => {
  const { card_uid } = req.body;

  if (!card_uid) {
    return res.status(400).json({ error: 'card_uid is required' });
  }

  console.log(`🧪 Manual test scan: ${card_uid}`);
  const result = await handleCardScan(card_uid);
  res.json(result);
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  res.json({
    status: 'healthy',
    backend: 'proxy-mode',
    clients: connectedClients,
    timestamp: new Date().toISOString(),
    note: 'Health check does not test backend - operating in proxy mode'
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Card Reader Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO server ready for connections`);
  console.log(`🌐 REST API available at http://localhost:${PORT}`);
  console.log(`🔗 Backend API: ${BACKEND_API_URL}`);
  console.log(`📡 Waiting for card scans...`);
  console.log(`\n📋 API Endpoints:`);
  console.log(`   GET  /api/students - List all students (proxied to backend)`);
  console.log(`   POST /api/assign-card - Assign card to student (proxied to backend)`);
  console.log(`   DELETE /api/students/:id - Delete student (proxied to backend)`);
  console.log(`   POST /api/card-scan - For Flask backend integration`);
  console.log(`   POST /api/simulate-scan - For manual testing`);
  console.log(`   GET  /api/health - Health check\n`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down card reader server...');
  server.close(() => {
    console.log('✅ Server closed.');
    process.exit(0);
  });
});

// Test backend connection on startup - make it non-blocking
setTimeout(async () => {
  console.log('✅ Card Reader Server: Ready to proxy requests to backend');
  console.log('   Backend URL:', BACKEND_API_URL);
  console.log('   Note: Backend connection will be tested when requests are made');
}, 2000);
