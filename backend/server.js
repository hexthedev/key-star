import express from 'express';
import cors from 'cors';
import Database from './database.js';

const app = express();
const PORT = 3001;
const db = new Database();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes

// Save a typing session
app.post('/api/typing-sessions', async (req, res) => {
  try {
    const sessionData = req.body;
    const result = await db.saveTypingSession(sessionData);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error saving session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent typing sessions
app.get('/api/typing-sessions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const sessions = await db.getRecentSessions(limit);
    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get overall statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  db.close();
  process.exit(0);
});