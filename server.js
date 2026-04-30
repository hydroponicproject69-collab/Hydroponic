const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const ALLOW_ALL_CORS = true;

app.use(express.json());
app.use(express.static('public'));

if (ALLOW_ALL_CORS) {
  app.use(cors());
}

let latestSensorData = null;
let lastUpdateTimestamp = null;
let controlCommands = {}; // Store control states: { pump: 0/1, light: 0/1, mist: 0/1, shed: 0/1 }

app.post('/data', (req, res) => {
  const payload = req.body;
  console.log('Received /data payload:', JSON.stringify(payload, null, 2));

  const timestamp = payload.timestamp || new Date().toISOString();

  latestSensorData = {
    ...payload,
    timestamp: timestamp,
    receivedAt: timestamp
  };
  lastUpdateTimestamp = timestamp;

  io.emit('telemetry', latestSensorData);

  res.status(200).json({ success: true, receivedAt: lastUpdateTimestamp });
});

app.post('/api/control', (req, res) => {
  const { device, state } = req.body;
  
  if (!device || state === undefined) {
    return res.status(400).json({ success: false, error: 'Missing device or state' });
  }

  const validDevices = ['pump', 'light', 'mist', 'shed'];
  if (!validDevices.includes(device)) {
    return res.status(400).json({ success: false, error: `Invalid device: ${device}` });
  }

  if (![0, 1].includes(state)) {
    return res.status(400).json({ success: false, error: 'State must be 0 or 1' });
  }

  controlCommands[device] = state;
  console.log(`Control command - ${device}: ${state ? 'ON' : 'OFF'}`);

  // Broadcast to all connected clients (including ESP32 if connected via Socket.IO)
  io.emit('controlCommand', { device, state, timestamp: new Date().toISOString() });

  res.status(200).json({ success: true, device, state, message: `${device} turned ${state ? 'ON' : 'OFF'}` });
});

app.get('/api/control/status', (req, res) => {
  res.json({ success: true, commands: controlCommands, timestamp: new Date().toISOString() });
});

app.get('/status', (req, res) => {
  res.json({
    online: true,
    lastUpdate: lastUpdateTimestamp || null
  });
});

// Placeholder for the ESP32-CAM stream
app.get('/api/camera-stream', (req, res) => {
  // In a real setup, this would proxy the stream from the ESP32-CAM
  // or serve base64 frames received via websocket from the ESP32.
  res.status(404).send('Camera stream not configured');
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  if (latestSensorData) {
    socket.emit('telemetry', latestSensorData);
  }

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Smart Hydroponic backend listening on port ${PORT}`);
});
