import { useState, useEffect, useCallback } from 'react'
import './App.css'

const sentences = [
  "The quick brown fox jumps over the lazy dog.",
  "Practice makes perfect typing skills develop."
]

const ErrorHandlingMode = {
  STRICT: 'strict',
  PERMISSIVE: 'permissive'
} as const

type ErrorHandlingMode = typeof ErrorHandlingMode[keyof typeof ErrorHandlingMode]

interface TypingMode {
  id: string
  name: string
  description: string
  errorHandling: ErrorHandlingMode
}

const TYPING_MODES: TypingMode[] = [
  {
    id: 'strict',
    name: 'Strict Mode',
    description: 'Character turns red until correct key is pressed',
    errorHandling: ErrorHandlingMode.STRICT
  },
  {
    id: 'permissive',
    name: 'Permissive Mode',
    description: 'Wrong characters appear in red, use backspace to delete',
    errorHandling: ErrorHandlingMode.PERMISSIVE
  }
]

interface TypingStats {
  sessionStart: Date | null
  sessionEnd: Date | null
  currentTime: number
  correctCharacters: number
  incorrectCharacters: number
  totalKeystrokes: number
}

interface TypingSession {
  id: number
  session_start: string
  session_end: string
  duration_seconds: number
  total_characters: number
  correct_characters: number
  incorrect_characters: number
  accuracy_percentage: number
  wpm: number
  sentences_completed: number
  word_count?: number
  created_at: string
}

interface DailyStats {
  date: string
  sessions: number
  totalWPM: number
  averageWPM: number
  totalDuration: number
  averageAccuracy: number
}

function App() {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0)
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [currentMode, setCurrentMode] = useState<TypingMode>(TYPING_MODES[0])
  const [typedCharacters, setTypedCharacters] = useState<string>('')
  const [sideMenuOpen, setSideMenuOpen] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [historicalSessions, setHistoricalSessions] = useState<TypingSession[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [typingStats, setTypingStats] = useState<TypingStats>({
    sessionStart: null,
    sessionEnd: null,
    currentTime: 0,
    correctCharacters: 0,
    incorrectCharacters: 0,
    totalKeystrokes: 0
  })
  const [sessionActive, setSessionActive] = useState(false)

  const currentSentence = sentences[currentSentenceIndex]

  // Load historical data on component mount
  useEffect(() => {
    loadHistoricalData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistoricalData = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3001/api/typing-sessions')
      if (response.ok) {
        const result = await response.json()
        if (result.success && Array.isArray(result.data)) {
          setHistoricalSessions(result.data)
          calculateDailyStats(result.data)
        } else {
          setHistoricalSessions([])
          setDailyStats([])
        }
      }
    } catch (error) {
      console.error('Failed to load historical data:', error)
      // Set empty array on error to prevent crashes
      setHistoricalSessions([])
      setDailyStats([])
    }
  }, [])

  const calculateDailyStats = (sessions: TypingSession[]) => {
    if (!Array.isArray(sessions) || sessions.length === 0) {
      setDailyStats([])
      return
    }

    const dailyMap = new Map<string, {
      sessions: number
      totalWPM: number
      totalDuration: number
      totalAccuracy: number
    }>()

    sessions.forEach(session => {
      const date = new Date(session.session_start).toDateString()
      const existing = dailyMap.get(date) || {
        sessions: 0,
        totalWPM: 0,
        totalDuration: 0,
        totalAccuracy: 0
      }

      dailyMap.set(date, {
        sessions: existing.sessions + 1,
        totalWPM: existing.totalWPM + session.wpm,
        totalDuration: existing.totalDuration + session.duration_seconds,
        totalAccuracy: existing.totalAccuracy + session.accuracy_percentage
      })
    })

    const dailyStatsArray = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      sessions: stats.sessions,
      totalWPM: stats.totalWPM,
      averageWPM: stats.totalWPM / stats.sessions,
      totalDuration: stats.totalDuration,
      averageAccuracy: stats.totalAccuracy / stats.sessions
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    setDailyStats(dailyStatsArray)
  }

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  // Timer effect
  useEffect(() => {
    let interval: number | undefined
    
    if (sessionActive) {
      interval = window.setInterval(() => {
        setTypingStats(prev => ({
          ...prev,
          currentTime: Date.now()
        }))
      }, 100) // Update every 100ms for smooth display
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [sessionActive])

  const startSession = () => {
    const now = new Date()
    setTypingStats({
      sessionStart: now,
      sessionEnd: null,
      currentTime: now.getTime(),
      correctCharacters: 0,
      incorrectCharacters: 0,
      totalKeystrokes: 0
    })
    setSessionActive(true)
  }

  const endSession = useCallback(async () => {
    const sessionEnd = new Date()
    setSessionActive(false)
    
    const finalStats = {
      ...typingStats,
      sessionEnd,
      currentTime: sessionEnd.getTime()
    }
    
    setTypingStats(finalStats)
    
    // Calculate session metrics
    const durationSeconds = (sessionEnd.getTime() - (finalStats.sessionStart?.getTime() || 0)) / 1000
    const totalCharacters = sentences.reduce((sum, sentence) => sum + sentence.length, 0)
    const totalText = sentences.join(' ')
    const wordCount = countWords(totalText)
    const accuracyPercentage = finalStats.totalKeystrokes > 0 
      ? (finalStats.correctCharacters / finalStats.totalKeystrokes) * 100 
      : 0
    const wpm = durationSeconds > 0 
      ? (wordCount / (durationSeconds / 60)) 
      : 0

    // Save to database
    try {
      const response = await fetch('http://localhost:3001/api/typing-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionStart: finalStats.sessionStart?.toISOString(),
          sessionEnd: sessionEnd.toISOString(),
          durationSeconds,
          totalCharacters,
          correctCharacters: finalStats.correctCharacters,
          incorrectCharacters: finalStats.incorrectCharacters,
          accuracyPercentage,
          wpm,
          sentencesCompleted: sentences.length,
          wordCount
        })
      })

      const result = await response.json()
      if (result.success) {
        console.log('Session saved successfully:', result.data)
        // Reload historical data to update stats
        loadHistoricalData()
      }
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  }, [typingStats, loadHistoricalData])

  const formatTime = (timeMs: number, startMs: number) => {
    const seconds = Math.floor((timeMs - startMs) / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Start session on first keystroke
    if (!sessionActive && !typingStats.sessionStart) {
      startSession()
    }

    const typedChar = event.key

    // Handle backspace in permissive mode
    if (typedChar === 'Backspace' && currentMode.errorHandling === ErrorHandlingMode.PERMISSIVE) {
      if (typedCharacters.length > 0) {
        // Remove last typed character
        const newTypedChars = typedCharacters.slice(0, -1)
        setTypedCharacters(newTypedChars)
        setCurrentCharIndex(newTypedChars.length)
        setHasError(false)
      }
      return
    }

    // Ignore non-printable characters (except space)
    if (typedChar.length > 1 && typedChar !== ' ') {
      return
    }

    // Update keystroke count
    setTypingStats(prev => ({
      ...prev,
      totalKeystrokes: prev.totalKeystrokes + 1
    }))

    if (currentMode.errorHandling === ErrorHandlingMode.STRICT) {
      // Strict mode: existing behavior
      const expectedChar = currentSentence[currentCharIndex]
      
      if (typedChar === expectedChar) {
        setHasError(false)
        
        // Update correct characters count
        setTypingStats(prev => ({
          ...prev,
          correctCharacters: prev.correctCharacters + 1
        }))
        
        if (currentCharIndex === currentSentence.length - 1) {
          // Sentence completed
          if (currentSentenceIndex === sentences.length - 1) {
            // All sentences completed
            endSession()
            alert('Congratulations! You completed all sentences!')
            setCurrentSentenceIndex(0)
            setCurrentCharIndex(0)
            setTypedCharacters('')
          } else {
            // Move to next sentence
            setCurrentSentenceIndex(currentSentenceIndex + 1)
            setCurrentCharIndex(0)
            setTypedCharacters('')
          }
        } else {
          // Move to next character
          setCurrentCharIndex(currentCharIndex + 1)
        }
      } else {
        // Wrong key pressed
        setHasError(true)
        setTypingStats(prev => ({
          ...prev,
          incorrectCharacters: prev.incorrectCharacters + 1
        }))
      }
    } else {
      // Permissive mode: allow wrong characters to be typed
      const newTypedChars = typedCharacters + typedChar
      setTypedCharacters(newTypedChars)
      setCurrentCharIndex(newTypedChars.length)
      
      const expectedChar = currentSentence[typedCharacters.length]
      
      if (typedChar === expectedChar) {
        // Correct character
        setTypingStats(prev => ({
          ...prev,
          correctCharacters: prev.correctCharacters + 1
        }))
        
        // Check if sentence is completed correctly
        if (newTypedChars === currentSentence) {
          // Sentence completed
          if (currentSentenceIndex === sentences.length - 1) {
            // All sentences completed
            endSession()
            alert('Congratulations! You completed all sentences!')
            setCurrentSentenceIndex(0)
            setCurrentCharIndex(0)
            setTypedCharacters('')
          } else {
            // Move to next sentence
            setCurrentSentenceIndex(currentSentenceIndex + 1)
            setCurrentCharIndex(0)
            setTypedCharacters('')
          }
        }
      } else {
        // Wrong character
        setTypingStats(prev => ({
          ...prev,
          incorrectCharacters: prev.incorrectCharacters + 1
        }))
      }
      
      // Set error state if current position doesn't match
      const hasCurrentError = newTypedChars.split('').some((char, index) => 
        char !== currentSentence[index]
      )
      setHasError(hasCurrentError)
    }
  }, [currentSentence, currentCharIndex, currentSentenceIndex, sessionActive, typingStats.sessionStart, endSession, currentMode, typedCharacters])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  const renderSentence = (sentence: string, isActive: boolean) => {
    if (!isActive) {
      return <div className="sentence inactive">{sentence}</div>
    }

    if (currentMode.errorHandling === ErrorHandlingMode.STRICT) {
      // Strict mode: original rendering logic
      return (
        <div className="sentence active">
          {sentence.split('').map((char, index) => {
            let className = 'char'
            
            if (index < currentCharIndex) {
              className += ' typed'
            } else if (index === currentCharIndex) {
              className += hasError ? ' current error' : ' current'
            } else {
              className += ' untyped'
            }

            return (
              <span key={index} className={className}>
                {char}
              </span>
            )
          })}
        </div>
      )
    } else {
      // Permissive mode: show typed characters and remaining sentence
      return (
        <div className="sentence active">
          {/* Render typed characters */}
          {typedCharacters.split('').map((typedChar, index) => {
            const expectedChar = sentence[index]
            const isCorrect = typedChar === expectedChar
            let className = 'char typed'
            
            if (!isCorrect) {
              className += ' error'
            }
            
            return (
              <span key={`typed-${index}`} className={className}>
                {typedChar}
              </span>
            )
          })}
          
          {/* Render current cursor position */}
          {typedCharacters.length < sentence.length && (
            <span className="char current">
              {sentence[typedCharacters.length]}
            </span>
          )}
          
          {/* Render remaining untyped characters */}
          {sentence.slice(typedCharacters.length + 1).split('').map((char, index) => (
            <span key={`untyped-${index}`} className="char untyped">
              {char}
            </span>
          ))}
        </div>
      )
    }
  }

  const currentSessionTime = typingStats.sessionStart 
    ? formatTime(typingStats.currentTime, typingStats.sessionStart.getTime())
    : "0:00"

  const currentAccuracy = typingStats.totalKeystrokes > 0 
    ? ((typingStats.correctCharacters / typingStats.totalKeystrokes) * 100).toFixed(1)
    : "0.0"

  const renderSideMenu = () => (
    <div className={`side-menu ${sideMenuOpen ? 'open' : ''}`}>
      <div className="side-menu-header">
        <h3>Menu</h3>
        <button 
          className="close-menu-btn"
          onClick={() => setSideMenuOpen(false)}
        >
          ×
        </button>
      </div>
      <div className="side-menu-content">
        <div className="menu-section">
          <h4>Typing Mode</h4>
          <div className="mode-selection">
            {TYPING_MODES.map((mode) => (
              <button
                key={mode.id}
                className={`mode-item ${currentMode.id === mode.id ? 'active' : ''}`}
                onClick={() => {
                  setCurrentMode(mode)
                  setCurrentSentenceIndex(0)
                  setCurrentCharIndex(0)
                  setTypedCharacters('')
                  setHasError(false)
                  setSideMenuOpen(false)
                }}
              >
                <div className="mode-name">{mode.name}</div>
                <div className="mode-description">{mode.description}</div>
              </button>
            ))}
          </div>
        </div>
        
        <button 
          className="menu-item"
          onClick={() => {
            setShowStats(!showStats)
            setSideMenuOpen(false)
          }}
        >
          📊 Statistics
        </button>
      </div>
    </div>
  )

  const renderStatistics = () => {
    if (!showStats) return null

    return (
      <div className="statistics-panel">
        <div className="statistics-header">
          <h2>Typing Statistics</h2>
          <button 
            className="close-stats-btn"
            onClick={() => setShowStats(false)}
          >
            ×
          </button>
        </div>
        
        <div className="statistics-content">
          <div className="stats-section">
            <h3>Overall Performance</h3>
            {Array.isArray(historicalSessions) && historicalSessions.length > 0 ? (
              <div className="overall-stats">
                <div className="stat-card">
                  <span className="stat-label">Total Sessions:</span>
                  <span className="stat-value">{historicalSessions.length}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Average WPM:</span>
                  <span className="stat-value">
                    {(historicalSessions.reduce((sum, s) => sum + (s.wpm || 0), 0) / historicalSessions.length).toFixed(2)}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Best WPM:</span>
                  <span className="stat-value">
                    {Math.max(...historicalSessions.map(s => s.wpm || 0)).toFixed(2)}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Average Accuracy:</span>
                  <span className="stat-value">
                    {(historicalSessions.reduce((sum, s) => sum + (s.accuracy_percentage || 0), 0) / historicalSessions.length).toFixed(1)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="no-data">
                <p>No typing sessions found. Complete a typing session to see statistics.</p>
              </div>
            )}
          </div>

          <div className="stats-section">
            <h3>Daily Averages</h3>
            <div className="daily-stats">
              {Array.isArray(dailyStats) && dailyStats.length > 0 ? 
                dailyStats.slice(0, 7).map((day, index) => (
                  <div key={index} className="daily-stat-row">
                    <span className="date">{day.date}</span>
                    <span className="sessions">{day.sessions} sessions</span>
                    <span className="avg-wpm">{day.averageWPM.toFixed(2)} WPM</span>
                    <span className="avg-accuracy">{day.averageAccuracy.toFixed(1)}%</span>
                  </div>
                )) : (
                  <div className="no-data">
                    <p>No daily statistics available yet.</p>
                  </div>
                )
              }
            </div>
          </div>

          <div className="stats-section">
            <h3>Recent Sessions</h3>
            <div className="session-history">
              {Array.isArray(historicalSessions) && historicalSessions.length > 0 ?
                historicalSessions.slice(0, 10).map((session, index) => (
                  <div key={index} className="session-row">
                    <span className="session-date">
                      {session.session_start ? new Date(session.session_start).toLocaleDateString() : 'N/A'}
                    </span>
                    <span className="session-time">
                      {session.session_start ? new Date(session.session_start).toLocaleTimeString() : 'N/A'}
                    </span>
                    <span className="session-duration">
                      {(session.duration_seconds || 0).toFixed(2)}s
                    </span>
                    <span className="session-wpm">{(session.wpm || 0).toFixed(2)} WPM</span>
                    <span className="session-accuracy">{(session.accuracy_percentage || 0).toFixed(1)}%</span>
                    <span className="session-words">{session.word_count || 0} words</span>
                  </div>
                )) : (
                  <div className="no-data">
                    <p>No session history available yet.</p>
                  </div>
                )
              }
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Menu Toggle Button */}
      <button 
        className="menu-toggle-btn"
        onClick={() => setSideMenuOpen(true)}
      >
        ☰
      </button>

      {/* Side Menu */}
      {renderSideMenu()}

      {/* Statistics Panel */}
      {renderStatistics()}

      <h1>Key Star Typing Trainer</h1>
      
      {/* Current Mode Indicator */}
      <div className="mode-indicator">
        <span className="mode-label">Mode:</span>
        <span className="mode-name">{currentMode.name}</span>
      </div>
      
      {/* Live Statistics */}
      <div className="live-stats">
        <div className="stat-item">
          <span className="stat-label">Time:</span>
          <span className="stat-value">{currentSessionTime}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Accuracy:</span>
          <span className="stat-value">{currentAccuracy}%</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Keystrokes:</span>
          <span className="stat-value">{typingStats.totalKeystrokes}</span>
        </div>
      </div>

      <div className="typing-area">
        {sentences.map((sentence, index) => (
          <div key={index}>
            {renderSentence(sentence, index === currentSentenceIndex)}
          </div>
        ))}
      </div>
      
      <div className="status">
        <p>Sentence {currentSentenceIndex + 1} of {sentences.length}</p>
        <p>Character {currentCharIndex + 1} of {currentSentence.length}</p>
        {hasError && <p className="error">Wrong key! Press the correct key to continue.</p>}
        {!sessionActive && typingStats.sessionStart && (
          <p className="session-complete">Session completed! Stats saved to database.</p>
        )}
      </div>
    </div>
  )
}

export default App