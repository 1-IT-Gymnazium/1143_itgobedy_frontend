# Card Reader System - Architecture Documentation

## Overview

The card reader system has been simplified to a **pure UID broadcaster**. The card reader server now only reads and broadcasts card UIDs - it does NOT make any backend API calls. All business logic is handled by the frontend components.

## Architecture

```
┌─────────────────┐
│  Physical Card  │
│     Reader      │
└────────┬────────┘
         │ USB
         ▼
┌─────────────────────┐
│  Python Script      │
│  pyscard_reader.py  │
│                     │
│  - Reads card UID   │
│  - Sends to server  │
└──────────┬──────────┘
           │ HTTP POST /api/card-scan
           ▼
┌──────────────────────────┐
│  Card Reader Server      │
│  (card-reader-server.cjs)│
│                          │
│  - Receives UID          │
│  - Broadcasts via        │
│    Socket.IO             │
│  - NO backend calls      │
└──────────┬───────────────┘
           │ Socket.IO 'card_scanned' event
           ▼
┌────────────────────────────────┐
│  Frontend Components           │
│  (CardScanner.vue,             │
│   CardAssignment.vue)          │
│                                │
│  - Receives UID                │
│  - Makes API calls to backend  │
│  - Handles all business logic  │
└────────────────────────────────┘
```

## Components

### 1. Card Reader Server (`card-reader-server.cjs`)

**Purpose**: Simple UID broadcaster - no business logic

**Endpoints**:
- `POST /api/card-scan` - Receives UID from Python script
- `POST /api/simulate-scan` - Test endpoint for manual card simulation
- `GET /api/status` - Server status and diagnostics

**Socket.IO Events**:
- Emits: `card_scanned` with `{ uid: "ABC123..." }`
- Emits: `reader_status` with connection status

**What it does**:
✅ Receives card UIDs from Python script
✅ Broadcasts UIDs to all connected clients via Socket.IO
✅ Stores last scanned card for new connections (5 second window)

**What it does NOT do**:
❌ NO backend API calls
❌ NO database lookups
❌ NO student/lunch logic
❌ NO card assignment logic

### 2. Python Card Reader Client (`pyscard_reader.py`)

**Purpose**: Reads physical NFC cards and sends UIDs to server

**Features**:
- Works with any PC/SC compatible reader (ACR122U, ACR38U, Omnikey, etc.)
- Multiple UID extraction methods for different card types
- Auto-reconnection on errors
- Colored console output

**What it sends**:
```json
{
  "card_uid": "ABC123DEF456"
}
```

### 3. Frontend Components

#### CardScanner.vue

**Purpose**: Display lunch information when cards are scanned

**Flow**:
1. Listens to Socket.IO `card_scanned` event
2. Receives UID: `{ uid: "ABC123..." }`
3. Makes POST request to backend `/lunch` endpoint:
   ```json
   {
     "card_uid": "ABC123DEF456"
   }
   ```
4. Backend returns student and lunch info
5. Displays on screen

**Backend API Used**:
- `POST /lunch` - Get student lunch by card UID

#### CardAssignment.vue

**Purpose**: Assign cards to students

**Flow**:
1. User selects a student from the list
2. Listens to Socket.IO `card_scanned` event
3. Receives UID: `{ uid: "ABC123..." }`
4. Makes POST request to backend `/api/assign-card`:
   ```json
   {
     "student_name": "John Doe",
     "card_uid": "ABC123DEF456"
   }
   ```
5. Backend assigns card to student
6. Shows success/error message

**Backend API Used**:
- `POST /api/assign-card` - Assign card UID to student
- `GET /api/students` - Load students list (via Socket.IO)

## Running the System

### 1. Start Card Reader Server

```bash
node card-reader-server.cjs
```

Server runs on `http://localhost:3001`

### 2. Start Python Card Reader (Optional - only if you have physical reader)

```bash
cd card-reader-client
pip install -r requirements.txt
python pyscard_reader.py
```

### 3. Test Without Physical Reader

```bash
# Terminal 1: Start card reader server
node card-reader-server.cjs

# Terminal 2: Simulate card scans
node test-card-reader.cjs
```

Or use curl:
```bash
curl -X POST http://localhost:3001/api/simulate-scan \
  -H "Content-Type: application/json" \
  -d '{"card_uid": "ABC123DEF456"}'
```

### 4. Start Frontend

```bash
npm run dev
```

Open browser to `http://localhost:5173`

## Testing

### Manual Testing

1. **Test Card Reader Server**:
   ```bash
   node test-card-reader.cjs
   ```

2. **Simulate Card Scan**:
   ```bash
   curl -X POST http://localhost:3001/api/simulate-scan \
     -H "Content-Type: application/json" \
     -d '{"card_uid": "TEST123ABC"}'
   ```

3. **Check Server Status**:
   ```bash
   curl http://localhost:3001/api/status
   ```

### Expected Responses

**Successful card scan**:
```json
{
  "success": true,
  "uid": "ABC123DEF456",
  "clients": 2
}
```

**Server status**:
```json
{
  "status": "running",
  "connectedClients": 2,
  "lastScannedCard": "ABC123DEF456",
  "lastScannedTime": "2025-10-29T12:34:56.789Z"
}
```

## Key Changes from Previous Architecture

### Before ❌
- Card reader server made backend API calls
- Server handled business logic (student lookup, lunch retrieval)
- Tight coupling between reader server and backend
- Frontend just displayed results

### After ✅
- Card reader server only broadcasts UIDs
- Frontend handles ALL business logic
- Clean separation of concerns
- Easy to test and debug
- Frontend can use different backends
- Multiple frontends can listen to same reader

## Benefits

1. **Simpler Server**: Card reader server is now ~100 lines instead of 300+
2. **Frontend Control**: All business logic in one place
3. **Flexibility**: Different components can handle UIDs differently
4. **Testability**: Easy to simulate card scans
5. **Scalability**: Multiple clients can listen to same reader
6. **Maintainability**: Clear separation of responsibilities

## Troubleshooting

### Card Reader Server Won't Start
- Check if port 3001 is already in use
- Make sure Node.js is installed

### Frontend Not Receiving UIDs
- Check browser console for Socket.IO connection
- Verify card reader server is running
- Check CORS settings

### Python Script Can't Read Cards
- Install pyscard: `pip install pyscard`
- Check if reader is connected: `python -m smartcard.scard`
- Try different reader if ACR122U doesn't work

### Backend API Errors
- Make sure backend server is running on port 5000
- Check backend logs for errors
- Verify card UID exists in database

## Environment Variables

### Card Reader Server
- `PORT` - Server port (default: 3001)

### Python Card Reader
- `SERVER_URL` - Card reader server URL (default: http://localhost:3001)
- `READER_NAME` - Specific reader name (optional, auto-detect by default)

## Future Enhancements

- [ ] Add card removal detection
- [ ] Support multiple simultaneous readers
- [ ] Add card scan rate limiting
- [ ] Implement card UID encryption
- [ ] Add reader health monitoring
- [ ] Support WebSocket authentication

