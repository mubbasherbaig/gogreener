require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Create HTTP server for WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store WebSocket connections
const deviceConnections = new Map();
const userConnections = new Map();

// PostgreSQL connection
const db = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'gogreener',
  password: process.env.DB_PASSWORD || '9900',
  port: process.env.DB_PORT || 5432,
});

// Test database connection
db.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database connected successfully');
  }
});

// Helper function to convert day names to numbers (Sunday = 0, Monday = 1, etc.)
function convertDaysToNumbers(dayNames) {
  const dayMap = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  
  return dayNames.map(day => dayMap[day.toLowerCase()]).filter(num => num !== undefined);
}

// WebSocket helper functions
function broadcastDeviceStatus(deviceId, isOnline) {
  const message = JSON.stringify({
    type: 'device_status',
    deviceId,
    isOnline
  });
  
  userConnections.forEach(connections => {
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  });
}

function broadcastDeviceUpdate(deviceId, data) {
  const message = JSON.stringify({
    type: 'device_update',
    deviceId,
    data
  });
  
  userConnections.forEach(connections => {
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  });
}

function sendCommandToDevice(deviceId, command) {
  const deviceWs = deviceConnections.get(deviceId);
  if (deviceWs && deviceWs.readyState === WebSocket.OPEN) {
    deviceWs.send(JSON.stringify(command));
    return true;
  }
  return false;
}

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3001',
    'https://gogreener.vercel.app',
    'http://localhost:3001',
    'https://gogreener.onrender.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.set('trust proxy', 1);

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// REPLACE your existing WebSocket handler with this enhanced version

wss.on('connection', (ws, req) => {
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'device_connect') {
        const { deviceId } = message;
        deviceConnections.set(deviceId, ws);
        
        await db.query('UPDATE devices SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [deviceId]);
        console.log(`Device ${deviceId} connected via WebSocket`);
        broadcastDeviceStatus(deviceId, true);
        
      } else if (message.type === 'user_connect') {
        const { token } = message;
        try {
          const user = jwt.verify(token, JWT_SECRET);
          if (!userConnections.has(user.id)) {
            userConnections.set(user.id, []);
          }
          userConnections.get(user.id).push(ws);
          console.log(`User ${user.username} connected via WebSocket`);
        } catch (error) {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
        }
        
      } else if (message.type === 'heartbeat') {
        const { deviceId, switch_state, current_reading, voltage } = message;
        
        const deviceCheck = await db.query('SELECT id FROM devices WHERE id = $1', [deviceId]);
        if (deviceCheck.rows.length === 0) {
          console.log(`Heartbeat from unregistered device: ${deviceId}`);
          return;
        }
        
        // Update device status and save telemetry
        await db.query('UPDATE devices SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [deviceId]);
        await db.query('INSERT INTO device_states (device_id, switch_state, current_reading, voltage) VALUES ($1, $2, $3, $4)',
                      [deviceId, switch_state, current_reading || 0, voltage || 0]);
        
        // **NEW: Verify and correct device state based on schedules**
        await verifyAndCorrectDeviceState(deviceId, switch_state);
        
        // Broadcast device update to users
        broadcastDeviceUpdate(deviceId, { switch_state, current_reading, voltage });
        
      } else if (message.type === 'schedule_executed') {
        const { deviceId, schedule_id, action, current_state } = message;
        
        console.log(`Schedule ${schedule_id} executed on device ${deviceId}: ${action}`);
        
        await db.query('UPDATE devices SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [deviceId]);
        await db.query('INSERT INTO device_states (device_id, switch_state, current_reading, voltage) VALUES ($1, $2, $3, $4)',
                      [deviceId, current_state, 0, 230]);
        
        broadcastDeviceUpdate(deviceId, { 
          switch_state: current_state, 
          current_reading: 0, 
          voltage: 230,
          triggered_by_schedule: true,
          schedule_id: schedule_id
        });
      }
      
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    // Clean up device connections
    for (let [deviceId, deviceWs] of deviceConnections.entries()) {
      if (deviceWs === ws) {
        deviceConnections.delete(deviceId);
        console.log(`Device ${deviceId} disconnected`);
        break;
      }
    }
    
    // Clean up user connections
    for (let [userId, connections] of userConnections.entries()) {
      const index = connections.indexOf(ws);
      if (index !== -1) {
        connections.splice(index, 1);
        if (connections.length === 0) {
          userConnections.delete(userId);
        }
        break;
      }
    }
  });
});

// ADD this periodic check after your WebSocket handler

// Periodic schedule verification for all online devices (runs every 5 minutes)
setInterval(async () => {
  try {
    console.log('🔍 Running periodic schedule verification...');
    
    const onlineDevicesResult = await db.query(
      `SELECT DISTINCT ds.device_id, ds.switch_state 
       FROM device_states ds
       INNER JOIN (
         SELECT device_id, MAX(timestamp) as latest_timestamp
         FROM device_states 
         WHERE timestamp >= NOW() - INTERVAL '2 minutes'
         GROUP BY device_id
       ) latest ON ds.device_id = latest.device_id AND ds.timestamp = latest.latest_timestamp
       INNER JOIN devices d ON ds.device_id = d.id AND d.is_online = true`
    );
    
    console.log(`Checking ${onlineDevicesResult.rows.length} online devices...`);
    
    for (const device of onlineDevicesResult.rows) {
      await verifyAndCorrectDeviceState(device.device_id, device.switch_state);
      // Add small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('✅ Periodic schedule verification completed');
  } catch (error) {
    console.error('Error in periodic schedule verification:', error);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// ADD these API endpoints (put them with your other API routes)

// API endpoint to manually trigger schedule verification for a device
app.post('/api/devices/:deviceId/verify-schedule', authenticateToken, async (req, res) => {
  const { deviceId } = req.params;
  
  try {
    // Verify user owns the device
    const deviceCheck = await db.query(
      'SELECT * FROM devices WHERE id = $1 AND (user_id = $2 OR $3 = $4)',
      [deviceId, req.user.id, req.user.role, 'admin']
    );
    
    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found or access denied' });
    }
    
    // Get latest device state
    const stateResult = await db.query(
      'SELECT switch_state FROM device_states WHERE device_id = $1 ORDER BY timestamp DESC LIMIT 1',
      [deviceId]
    );
    
    if (stateResult.rows.length === 0) {
      return res.status(404).json({ error: 'No device state found' });
    }
    
    const currentSwitchState = stateResult.rows[0].switch_state;
    
    // Trigger verification
    await verifyAndCorrectDeviceState(deviceId, currentSwitchState);
    
    res.json({ 
      message: 'Schedule verification triggered',
      deviceId,
      currentState: currentSwitchState 
    });
    
  } catch (error) {
    console.error('Error in manual schedule verification:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// API endpoint to get schedule correction history
app.get('/api/devices/:deviceId/corrections', authenticateToken, async (req, res) => {
  const { deviceId } = req.params;
  const { limit = 50 } = req.query;
  
  try {
    // Verify user owns the device
    const deviceCheck = await db.query(
      'SELECT * FROM devices WHERE id = $1 AND (user_id = $2 OR $3 = $4)',
      [deviceId, req.user.id, req.user.role, 'admin']
    );
    
    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found or access denied' });
    }
    
    const result = await db.query(
      `SELECT * FROM device_corrections 
       WHERE device_id = $1 
       ORDER BY corrected_at DESC 
       LIMIT $2`,
      [deviceId, parseInt(limit)]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching correction history:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =================
// AUTHENTICATION ROUTES
// =================

app.post('/api/auth/signup', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, role',
      [username, email, hashedPassword]
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({ token, user });
    
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role 
      } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// =================
// DEVICE ROUTES
// =================

app.post('/api/devices/register', authenticateToken, async (req, res) => {
  const { deviceId, deviceName, model } = req.body;
  
  if (!deviceId || !deviceName) {
    return res.status(400).json({ error: 'Device ID and name required' });
  }

  try {
    await db.query(
      'INSERT INTO devices (id, name, user_id, model) VALUES ($1, $2, $3, $4)',
      [deviceId, deviceName, req.user.id, model || 'ESP32-Switch']
    );
    res.json({ message: 'Device registered successfully', deviceId });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Device already registered' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/devices', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, ds.switch_state, ds.current_reading, ds.voltage 
       FROM devices d 
       LEFT JOIN LATERAL (
         SELECT switch_state, current_reading, voltage 
         FROM device_states 
         WHERE device_id = d.id 
         ORDER BY timestamp DESC LIMIT 1
       ) ds ON true
       WHERE d.user_id = $1 
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/devices/:deviceId/control', authenticateToken, async (req, res) => {
  const { deviceId } = req.params;
  const { action, value } = req.body;

  try {
    const result = await db.query(
      'SELECT * FROM devices WHERE id = $1 AND (user_id = $2 OR $3 = $4)',
      [deviceId, req.user.id, req.user.role, 'admin']
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found or access denied' });
    }

    const sent = sendCommandToDevice(deviceId, { 
      type: 'command',
      command_type: action,
      command_value: value
    });
    
    if (sent) {
      res.json({ message: 'Command sent instantly', method: 'websocket' });
    } else {
      const commandResult = await db.query(
        'INSERT INTO commands (device_id, command_type, command_value) VALUES ($1, $2, $3) RETURNING id',
        [deviceId, action, value?.toString()]
      );
      res.json({ message: 'Command queued for offline device', commandId: commandResult.rows[0].id, method: 'queue' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/devices/:deviceId/telemetry', authenticateToken, async (req, res) => {
  const { deviceId } = req.params;
  const { hours = 24 } = req.query;

  try {
    const result = await db.query(
      `SELECT * FROM device_states 
       WHERE device_id = $1 AND timestamp >= NOW() - INTERVAL '${hours} hours'
       ORDER BY timestamp DESC LIMIT 100`,
      [deviceId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Check if device is registered
app.get('/api/devices/check/:deviceId', authenticateToken, async (req, res) => {
  const { deviceId } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM devices WHERE id = $1 AND user_id = $2',
      [deviceId, req.user.id]
    );
    res.json({ registered: result.rows.length > 0 });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Auto-detect WiFi setup completion
app.post('/api/devices/setup-complete', async (req, res) => {
  const { deviceId } = req.body;
  // Mark setup as ready for registration
  res.json({ message: 'Setup marked complete' });
});

app.delete('/api/devices/:deviceId', authenticateToken, async (req, res) => {
  const { deviceId } = req.params;

  try {
    const result = await db.query('SELECT * FROM devices WHERE id = $1 AND user_id = $2', [deviceId, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await db.query('DELETE FROM devices WHERE id = $1', [deviceId]);
    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ESP32 specific endpoints
app.post('/api/devices/:deviceId/heartbeat', async (req, res) => {
  const { deviceId } = req.params;
  const { switch_state, current_reading, voltage } = req.body;

  try {
    await db.query('UPDATE devices SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [deviceId]);
    await db.query('INSERT INTO device_states (device_id, switch_state, current_reading, voltage) VALUES ($1, $2, $3, $4)',
                   [deviceId, switch_state, current_reading || 0, voltage || 0]);
    res.json({ message: 'Heartbeat received' });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/devices/:deviceId/commands', async (req, res) => {
  const { deviceId } = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM commands WHERE device_id = $1 AND status = $2 ORDER BY created_at ASC',
      [deviceId, 'pending']
    );
    
    if (result.rows.length > 0) {
      const commandIds = result.rows.map(cmd => cmd.id);
      await db.query(
        `UPDATE commands SET status = 'sent' WHERE id = ANY($1)`,
        [commandIds]
      );
    }
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// =================
// SCHEDULE ROUTES
// =================

// GET schedules for a device
app.get('/api/devices/:deviceId/schedules', authenticateToken, async (req, res) => {
  const { deviceId } = req.params;

  try {
    // Verify user owns the device
    const deviceCheck = await db.query(
      'SELECT * FROM devices WHERE id = $1 AND (user_id = $2 OR $3 = $4)',
      [deviceId, req.user.id, req.user.role, 'admin']
    );
    
    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found or access denied' });
    }

    const result = await db.query(
      'SELECT * FROM schedules WHERE device_id = $1 ORDER BY hour, minute',
      [deviceId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// CREATE a new schedule
app.post('/api/devices/:deviceId/schedules', authenticateToken, async (req, res) => {
  const { deviceId } = req.params;
  const { name, time, action, days, enabled = true, repeat_type = 'weekly' } = req.body;

  console.log('=== Schedule Creation Debug ===');
  console.log('Raw request body:', req.body);
  console.log('Days received:', days);
  console.log('Days type:', typeof days);
  console.log('Days is array:', Array.isArray(days));

  try {
    // Verify user owns the device
    const deviceCheck = await db.query(
      'SELECT * FROM devices WHERE id = $1 AND (user_id = $2 OR $3 = $4)',
      [deviceId, req.user.id, req.user.role, 'admin']
    );
    
    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found or access denied' });
    }

    // Parse time (HH:MM format)
    if (!time || !time.includes(':')) {
      return res.status(400).json({ error: 'Invalid time format' });
    }
    
    const [hour, minute] = time.split(':').map(Number);
    
    // Validate input
    if (!name || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return res.status(400).json({ error: 'Invalid schedule data - name or time issue' });
    }

    // Handle days properly - ensure it's an array
    let daysArray;
    if (Array.isArray(days)) {
      daysArray = days;
    } else if (typeof days === 'string') {
      try {
        daysArray = JSON.parse(days);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid days format - must be array' });
      }
    } else {
      return res.status(400).json({ error: 'Days must be provided as an array' });
    }

    if (!Array.isArray(daysArray) || daysArray.length === 0) {
      return res.status(400).json({ error: 'At least one day must be selected' });
    }

    console.log('Processed days array:', daysArray);

    // Validate action
    if (action !== 'turn_on' && action !== 'turn_off') {
      return res.status(400).json({ error: 'Action must be turn_on or turn_off' });
    }

    // Convert days array to JSON string for database
    const daysJson = JSON.stringify(daysArray);
    console.log('Days JSON for database:', daysJson);

    // Insert schedule into database
    const result = await db.query(
      `INSERT INTO schedules 
       (device_id, name, hour, minute, action, days, enabled, repeat_type) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [deviceId, name, hour, minute, action, daysJson, enabled, repeat_type]
    );

    const newSchedule = result.rows[0];
    console.log('Created schedule:', newSchedule);

    // Parse days back from database for response and device command
    let parsedDays;
    try {
      parsedDays = JSON.parse(newSchedule.days);
    } catch (e) {
      console.error('Error parsing days from database:', e);
      parsedDays = daysArray; // fallback to original
    }

    // Send schedule to device if it's online
    try {
      const scheduleCommand = {
        type: 'command',
        command_type: 'schedule',
        schedule_action: 'add',
        slot: -1,
        enabled: newSchedule.enabled,
        action: newSchedule.action,
        hour: newSchedule.hour,
        minute: newSchedule.minute,
        days: convertDaysToNumbers(parsedDays),
        schedule_id: newSchedule.id
      };

      const sent = sendCommandToDevice(deviceId, scheduleCommand);
      console.log('Device command sent:', sent);
      
      res.json({ 
        ...newSchedule, 
        days: parsedDays,
        synced_to_device: sent 
      });

    } catch (deviceError) {
      console.error('Error sending to device:', deviceError);
      // Still return success since database save worked
      res.json({ 
        ...newSchedule, 
        days: parsedDays,
        synced_to_device: false,
        sync_error: deviceError.message
      });
    }

  } catch (error) {
    console.error('=== Database Error ===');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Database error: ' + error.message,
      code: error.code 
    });
  }
});

// UPDATE a schedule
app.put('/api/devices/:deviceId/schedules/:scheduleId', authenticateToken, async (req, res) => {
  const { deviceId, scheduleId } = req.params;
  const { name, time, action, days, enabled, repeat_type } = req.body;

  try {
    // Verify user owns the device and schedule exists
    const scheduleCheck = await db.query(
      `SELECT s.* FROM schedules s 
       JOIN devices d ON s.device_id = d.id 
       WHERE s.id = $1 AND s.device_id = $2 AND (d.user_id = $3 OR $4 = $5)`,
      [scheduleId, deviceId, req.user.id, req.user.role, 'admin']
    );
    
    if (scheduleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found or access denied' });
    }

    const [hour, minute] = time.split(':').map(Number);

    // Handle days properly - ensure it's an array
    let daysArray;
    if (Array.isArray(days)) {
      daysArray = days;
    } else if (typeof days === 'string') {
      try {
        daysArray = JSON.parse(days);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid days format' });
      }
    } else {
      return res.status(400).json({ error: 'Days must be provided' });
    }

    // Update schedule in database
    const result = await db.query(
      `UPDATE schedules 
       SET name = $1, hour = $2, minute = $3, action = $4, days = $5, 
           enabled = $6, repeat_type = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND device_id = $9 
       RETURNING *`,
      [name, hour, minute, action, JSON.stringify(daysArray), enabled, repeat_type, scheduleId, deviceId]
    );

    const updatedSchedule = result.rows[0];

    // Parse days for response
    const parsedDays = JSON.parse(updatedSchedule.days);

    // Send update to device if it's online
    const scheduleCommand = {
      type: 'command',
      command_type: 'schedule',
      schedule_action: 'add',
      slot: scheduleCheck.rows[0].device_slot || -1,
      enabled: updatedSchedule.enabled,
      action: updatedSchedule.action,
      hour: updatedSchedule.hour,
      minute: updatedSchedule.minute,
      days: convertDaysToNumbers(parsedDays),
      schedule_id: updatedSchedule.id
    };

    const sent = sendCommandToDevice(deviceId, scheduleCommand);

    res.json({ 
      ...updatedSchedule, 
      days: parsedDays,
      synced_to_device: sent 
    });

  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Database error: ' + error.message });
  }
});

// DELETE a schedule
app.delete('/api/devices/:deviceId/schedules/:scheduleId', authenticateToken, async (req, res) => {
  const { deviceId, scheduleId } = req.params;

  try {
    // Verify user owns the device and schedule exists
    const scheduleCheck = await db.query(
      `SELECT s.* FROM schedules s 
       JOIN devices d ON s.device_id = d.id 
       WHERE s.id = $1 AND s.device_id = $2 AND (d.user_id = $3 OR $4 = $5)`,
      [scheduleId, deviceId, req.user.id, req.user.role, 'admin']
    );
    
    if (scheduleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found or access denied' });
    }

    // Delete from database
    await db.query('DELETE FROM schedules WHERE id = $1 AND device_id = $2', [scheduleId, deviceId]);

    // Send delete command to device if it's online
    const deleteCommand = {
      type: 'command',
      command_type: 'schedule',
      schedule_action: 'delete',
      slot: scheduleCheck.rows[0].device_slot || -1,
      schedule_id: parseInt(scheduleId)
    };

    const sent = sendCommandToDevice(deviceId, deleteCommand);

    res.json({ message: 'Schedule deleted successfully', synced_to_device: sent });

  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// SYNC all schedules to device
app.post('/api/devices/:deviceId/schedules/sync', authenticateToken, async (req, res) => {
  const { deviceId } = req.params;

  try {
    // Verify user owns the device
    const deviceCheck = await db.query(
      'SELECT * FROM devices WHERE id = $1 AND (user_id = $2 OR $3 = $4)',
      [deviceId, req.user.id, req.user.role, 'admin']
    );
    
    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found or access denied' });
    }

    // Get all schedules for this device
    const schedules = await db.query(
      'SELECT * FROM schedules WHERE device_id = $1 ORDER BY id',
      [deviceId]
    );

    if (!deviceConnections.has(deviceId)) {
      return res.json({ message: 'Device is offline - schedules will sync when device comes online', count: schedules.rows.length });
    }

    // Clear all schedules on device first
    sendCommandToDevice(deviceId, {
      type: 'command',
      command_type: 'schedule',
      schedule_action: 'clear_all'
    });

    // Send each schedule to device
    let syncCount = 0;
    schedules.rows.forEach((schedule, index) => {
      const scheduleCommand = {
        type: 'command',
        command_type: 'schedule',
        schedule_action: 'add',
        slot: index,
        enabled: schedule.enabled,
        action: schedule.action,
        hour: schedule.hour,
        minute: schedule.minute,
        days: convertDaysToNumbers(JSON.parse(schedule.days)),
        schedule_id: schedule.id
      };

      if (sendCommandToDevice(deviceId, scheduleCommand)) {
        syncCount++;
      }
    });

    res.json({ message: 'Schedules synced to device', synced_count: syncCount, total_count: schedules.rows.length });

  } catch (error) {
    console.error('Error syncing schedules:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =================
// ADMIN ROUTES
// =================

app.get('/api/admin/devices', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, u.username, ds.switch_state, ds.current_reading, ds.voltage 
       FROM devices d 
       JOIN users u ON d.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT switch_state, current_reading, voltage 
         FROM device_states 
         WHERE device_id = d.id 
         ORDER BY timestamp DESC LIMIT 1
       ) ds ON true
       ORDER BY d.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/admin/devices/:deviceId/control', authenticateToken, requireAdmin, async (req, res) => {
  const { deviceId } = req.params;
  const { action, value } = req.body;

  try {
    const sent = sendCommandToDevice(deviceId, { 
      type: 'command',
      command_type: action,
      command_value: value
    });
    
    if (sent) {
      res.json({ message: 'Admin command sent instantly', method: 'websocket' });
    } else {
      const commandResult = await db.query(
        'INSERT INTO commands (device_id, command_type, command_value) VALUES ($1, $2, $3) RETURNING id',
        [deviceId, action, value?.toString()]
      );
      res.json({ message: 'Admin command queued', commandId: commandResult.rows[0].id, method: 'queue' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// =================
// UTILITY ROUTES
// =================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test database connection
app.get('/api/test/database', async (req, res) => {
  try {
    const testResult = await db.query('SELECT NOW() as current_time');
    
    // Check if schedules table exists
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'schedules'
    `);
    
    const schedulesTableExists = tableCheck.rows.length > 0;
    
    res.json({
      status: 'success',
      database_connected: true,
      current_time: testResult.rows[0].current_time,
      schedules_table_exists: schedulesTableExists
    });
    
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// ADD THESE FUNCTIONS TO YOUR EXISTING server.js

// Function to determine what the device state should be based on current time and schedules
async function getExpectedDeviceState(deviceId) {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDayOfWeek = now.getDay(); // Sunday = 0, Monday = 1, etc.
    
    // Get all enabled schedules for this device, ordered by time (latest first)
    const schedulesResult = await db.query(
      `SELECT * FROM schedules 
       WHERE device_id = $1 AND enabled = true 
       ORDER BY hour DESC, minute DESC`,
      [deviceId]
    );

    if (schedulesResult.rows.length === 0) {
      return null; // No schedules, can't determine expected state
    }

    let expectedAction = null;
    let triggeringSchedule = null;

    // Find the most recent schedule that should have triggered today
    for (const schedule of schedulesResult.rows) {
      try {
        let scheduleDays;
        try {
          // Check if it's already an array (JSONB column returns parsed data)
          if (Array.isArray(schedule.days)) {
            scheduleDays = schedule.days;
          } else if (typeof schedule.days === 'string') {
            // Handle comma-separated strings (like "monday,tuesday,wednesday")
            if (schedule.days.includes(',') && !schedule.days.startsWith('[')) {
              scheduleDays = schedule.days.split(',').map(day => day.trim());
              console.log(`Fixed comma-separated format for schedule ${schedule.id}`);
            } else {
              // Handle JSON strings
              scheduleDays = JSON.parse(schedule.days);
              // Handle double-escaped JSON
              if (typeof scheduleDays === 'string') {
                scheduleDays = JSON.parse(scheduleDays);
              }
            }
          } else {
            throw new Error(`Unexpected data type: ${typeof schedule.days}`);
          }
        } catch (error) {
          console.error(`Invalid days format in schedule ${schedule.id}: ${schedule.days}`);
          continue;
        }
        const scheduleDayNumbers = convertDaysToNumbers(scheduleDays);
        
        // Check if schedule applies to current day
        if (scheduleDayNumbers.includes(currentDayOfWeek)) {
          const scheduleHour = schedule.hour;
          const scheduleMinute = schedule.minute;
          
          // Check if this schedule should have triggered already today
          if (currentHour > scheduleHour || 
              (currentHour === scheduleHour && currentMinute >= scheduleMinute)) {
            expectedAction = schedule.action;
            triggeringSchedule = schedule;
            break; // Found the most recent applicable schedule
          }
        }
      } catch (error) {
        console.error(`Error parsing schedule days for schedule ${schedule.id}:`, error);
        continue;
      }
    }

    // If no schedule has triggered today, check yesterday's last schedule
    if (expectedAction === null) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDayOfWeek = yesterday.getDay();
      
      for (const schedule of schedulesResult.rows) {
        try {
          const scheduleDays = JSON.parse(schedule.days);
          const scheduleDayNumbers = convertDaysToNumbers(scheduleDays);
          
          if (scheduleDayNumbers.includes(yesterdayDayOfWeek)) {
            expectedAction = schedule.action;
            triggeringSchedule = schedule;
            break;
          }
        } catch (error) {
          console.error(`Error parsing schedule days for schedule ${schedule.id}:`, error);
          continue;
        }
      }
    }

    return {
      expectedState: expectedAction === 'turn_on',
      triggeringSchedule: triggeringSchedule,
      currentTime: { hour: currentHour, minute: currentMinute, day: currentDayOfWeek }
    };

  } catch (error) {
    console.error(`Error determining expected state for device ${deviceId}:`, error);
    return null;
  }
}

// Function to verify and correct device state
async function verifyAndCorrectDeviceState(deviceId, actualSwitchState) {
  try {
    const expectedStateInfo = await getExpectedDeviceState(deviceId);
    
    if (!expectedStateInfo) {
      // No schedules or unable to determine expected state
      console.log(`No schedule verification possible for device ${deviceId}`);
      return;
    }

    const { expectedState, triggeringSchedule, currentTime } = expectedStateInfo;
    
    console.log(`Schedule Verification for ${deviceId}:`, {
      expected: expectedState,
      actual: actualSwitchState,
      currentTime,
      triggeringSchedule: triggeringSchedule ? {
        id: triggeringSchedule.id,
        name: triggeringSchedule.name,
        action: triggeringSchedule.action,
        time: `${triggeringSchedule.hour}:${triggeringSchedule.minute.toString().padStart(2, '0')}`
      } : null
    });

    // Check if there's a mismatch
    if (expectedState !== actualSwitchState) {
      console.log(`🔧 SCHEDULE MISMATCH DETECTED for ${deviceId}!`);
      console.log(`Expected: ${expectedState ? 'ON' : 'OFF'}, Actual: ${actualSwitchState ? 'ON' : 'OFF'}`);
      console.log(`Triggering Schedule: ${triggeringSchedule.name} (${triggeringSchedule.action})`);
      
      // Send correction command to device
      const correctionCommand = {
        type: 'command',
        command_type: 'switch',
        command_value: expectedState.toString(),
        reason: 'schedule_correction',
        schedule_id: triggeringSchedule.id,
        schedule_name: triggeringSchedule.name
      };

      const sent = sendCommandToDevice(deviceId, correctionCommand);
      
      if (sent) {
        console.log(`✅ Correction command sent to ${deviceId}: ${expectedState ? 'ON' : 'OFF'}`);
        
        // Log the correction in database for tracking
        await db.query(
          `INSERT INTO device_corrections (device_id, expected_state, actual_state, 
           corrected_at, schedule_id, schedule_name) 
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)`,
          [deviceId, expectedState, actualSwitchState, triggeringSchedule.id, triggeringSchedule.name]
        );
        
        // Broadcast correction to users
        broadcastDeviceUpdate(deviceId, {
          switch_state: expectedState,
          corrected_by_schedule: true,
          schedule_id: triggeringSchedule.id,
          schedule_name: triggeringSchedule.name,
          previous_state: actualSwitchState
        });
        
      } else {
        console.log(`❌ Failed to send correction command to ${deviceId} (device offline)`);
        
        // Queue the command for when device comes back online
        await db.query(
          'INSERT INTO commands (device_id, command_type, command_value, reason) VALUES ($1, $2, $3, $4)',
          [deviceId, 'switch', expectedState.toString(), 'schedule_correction']
        );
        console.log(`📋 Correction command queued for ${deviceId}`);
      }
    } else {
      console.log(`✅ Device ${deviceId} state matches expected schedule`);
    }

  } catch (error) {
    console.error(`Error verifying device state for ${deviceId}:`, error);
  }
}

// Start HTTP server with WebSocket support
server.listen(PORT, () => {
  console.log(`HTTP Server with WebSocket running on port ${PORT}`);
});

// Cleanup offline devices every 30 seconds
setInterval(async () => {
  try {
    const result = await db.query(
      "UPDATE devices SET is_online = false WHERE last_seen < NOW() - INTERVAL '1 minute' AND is_online = true RETURNING id"
    );
    if (result.rows.length > 0) {
      console.log(`Marked ${result.rows.length} devices as offline`);
      
      // Broadcast offline status to users
      result.rows.forEach(device => {
        broadcastDeviceStatus(device.id, false);
      });
    }
  } catch (error) {
    console.error('Error updating offline devices:', error);
  }
}, 30 * 1000);