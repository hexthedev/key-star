import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Database {
  constructor() {
    this.db = new sqlite3.Database(join(__dirname, 'typing_stats.db'));
    this.init();
  }

  init() {
    this.db.serialize(() => {
      // Create typing_sessions table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS typing_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_start DATETIME NOT NULL,
          session_end DATETIME NOT NULL,
          duration_seconds REAL NOT NULL,
          total_characters INTEGER NOT NULL,
          correct_characters INTEGER NOT NULL,
          incorrect_characters INTEGER NOT NULL,
          accuracy_percentage REAL NOT NULL,
          wpm REAL NOT NULL,
          sentences_completed INTEGER NOT NULL,
          word_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Add word_count column if it doesn't exist (for existing databases)
      this.db.run(`
        ALTER TABLE typing_sessions ADD COLUMN word_count INTEGER DEFAULT 0
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding word_count column:', err);
        }
      });
      
      console.log('Database initialized successfully');
    });
  }

  saveTypingSession(sessionData) {
    return new Promise((resolve, reject) => {
      const {
        sessionStart,
        sessionEnd,
        durationSeconds,
        totalCharacters,
        correctCharacters,
        incorrectCharacters,
        accuracyPercentage,
        wpm,
        sentencesCompleted,
        wordCount = 0
      } = sessionData;

      const stmt = this.db.prepare(`
        INSERT INTO typing_sessions (
          session_start, session_end, duration_seconds, total_characters,
          correct_characters, incorrect_characters, accuracy_percentage,
          wpm, sentences_completed, word_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        sessionStart,
        sessionEnd,
        durationSeconds,
        totalCharacters,
        correctCharacters,
        incorrectCharacters,
        accuracyPercentage,
        wpm,
        sentencesCompleted,
        wordCount
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...sessionData });
        }
      });

      stmt.finalize();
    });
  }

  getRecentSessions(limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM typing_sessions 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getStats() {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT 
          COUNT(*) as total_sessions,
          AVG(wpm) as avg_wpm,
          MAX(wpm) as best_wpm,
          AVG(accuracy_percentage) as avg_accuracy,
          SUM(duration_seconds) as total_practice_time
        FROM typing_sessions
      `, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  close() {
    this.db.close();
  }
}

export default Database;