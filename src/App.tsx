import { useState, useEffect, useCallback } from 'react'
import './App.css'

const sentences = [
  "The quick brown fox jumps over the lazy dog.",
  "Practice makes perfect typing skills develop."
]

const ErrorHandlingMode = {
  FORGIVING: 'forgiving',
  PERFECTIONIST: 'perfectionist'
} as const

type ErrorHandlingMode = typeof ErrorHandlingMode[keyof typeof ErrorHandlingMode]

interface ModeSettings {
  errorHandling: ErrorHandlingMode
}

interface TypingMode {
  id: string
  name: string
  settings: ModeSettings
  isDefault: boolean
  createdAt?: string
}

const DEFAULT_MODES: TypingMode[] = [
  {
    id: 'forgiving-default',
    name: 'Forgiving Mode',
    settings: {
      errorHandling: ErrorHandlingMode.FORGIVING
    },
    isDefault: true
  },
  {
    id: 'perfectionist-default',
    name: 'Perfectionist Mode',
    settings: {
      errorHandling: ErrorHandlingMode.PERFECTIONIST
    },
    isDefault: true
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
  const [customModes, setCustomModes] = useState<TypingMode[]>([])
  const [currentMode, setCurrentMode] = useState<TypingMode>(DEFAULT_MODES[0])
  const [typedCharacters, setTypedCharacters] = useState<string>('')
  const [firstErrorPosition, setFirstErrorPosition] = useState<number | null>(null)
  const [sideMenuOpen, setSideMenuOpen] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showModeManager, setShowModeManager] = useState(false)
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

  // Combine default and custom modes
  const allModes = [...DEFAULT_MODES, ...customModes]

  const currentSentence = sentences[currentSentenceIndex]

  // Load custom modes from localStorage
  useEffect(() => {
    const savedModes = localStorage.getItem('customTypingModes')
    if (savedModes) {
      try {
        const parsedModes = JSON.parse(savedModes)
        setCustomModes(parsedModes)
      } catch (error) {
        console.error('Failed to load custom modes:', error)
      }
    }
  }, [])

  // Load historical data on component mount
  useEffect(() => {
    loadHistoricalData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save custom modes to localStorage
  const saveCustomModes = useCallback((modes: TypingMode[]) => {
    localStorage.setItem('customTypingModes', JSON.stringify(modes))
    setCustomModes(modes)
  }, [])

  // Mode management functions
  const createMode = useCallback((name: string, settings: ModeSettings) => {
    const newMode: TypingMode = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      settings,
      isDefault: false,
      createdAt: new Date().toISOString()
    }
    const updatedModes = [...customModes, newMode]
    saveCustomModes(updatedModes)
    return newMode
  }, [customModes, saveCustomModes])

  const updateMode = useCallback((modeId: string, updates: Partial<Pick<TypingMode, 'name' | 'settings'>>) => {
    const updatedModes = customModes.map(mode => 
      mode.id === modeId ? { ...mode, ...updates } : mode
    )
    saveCustomModes(updatedModes)
  }, [customModes, saveCustomModes])

  const deleteMode = useCallback((modeId: string) => {
    const updatedModes = customModes.filter(mode => mode.id !== modeId)
    saveCustomModes(updatedModes)
    
    // If the deleted mode was the current mode, switch to default
    if (currentMode.id === modeId) {
      setCurrentMode(DEFAULT_MODES[0])
      setCurrentSentenceIndex(0)
      setCurrentCharIndex(0)
      setTypedCharacters('')
      setFirstErrorPosition(null)
      setHasError(false)
    }
  }, [customModes, saveCustomModes, currentMode.id])

  const duplicateMode = useCallback((mode: TypingMode) => {
    const duplicatedMode = createMode(`${mode.name} (Copy)`, mode.settings)
    return duplicatedMode
  }, [createMode])

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

    // Handle backspace in perfectionist mode
    if (typedChar === 'Backspace' && currentMode.settings.errorHandling === ErrorHandlingMode.PERFECTIONIST) {
      if (typedCharacters.length > 0) {
        // Remove last typed character
        const newTypedChars = typedCharacters.slice(0, -1)
        setTypedCharacters(newTypedChars)
        setCurrentCharIndex(newTypedChars.length)
        
        // If we backspaced to before the first error position, clear the error
        if (firstErrorPosition !== null && newTypedChars.length <= firstErrorPosition) {
          setFirstErrorPosition(null)
          setHasError(false)
        }
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

    if (currentMode.settings.errorHandling === ErrorHandlingMode.FORGIVING) {
      // Forgiving mode: existing behavior
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
      // Perfectionist mode: allow wrong characters to be typed
      const newTypedChars = typedCharacters + typedChar
      setTypedCharacters(newTypedChars)
      setCurrentCharIndex(newTypedChars.length)
      
      // Determine the expected character at the current correct position
      const correctPosition = firstErrorPosition !== null ? firstErrorPosition : typedCharacters.length
      const expectedChar = currentSentence[correctPosition]
      
      if (firstErrorPosition === null && typedChar === expectedChar) {
        // No error yet and typed correct character
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
            setFirstErrorPosition(null)
          } else {
            // Move to next sentence
            setCurrentSentenceIndex(currentSentenceIndex + 1)
            setCurrentCharIndex(0)
            setTypedCharacters('')
            setFirstErrorPosition(null)
          }
        }
      } else {
        // Either we already had an error, or this is the first wrong character
        if (firstErrorPosition === null) {
          // This is the first error
          setFirstErrorPosition(typedCharacters.length)
          setHasError(true)
        }
        
        setTypingStats(prev => ({
          ...prev,
          incorrectCharacters: prev.incorrectCharacters + 1
        }))
      }
    }
  }, [currentSentence, currentCharIndex, currentSentenceIndex, sessionActive, typingStats.sessionStart, endSession, currentMode, typedCharacters, firstErrorPosition])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  const renderSentence = (sentence: string, isActive: boolean) => {
    if (!isActive) {
      return <div className="sentence inactive">{sentence}</div>
    }

    if (currentMode.settings.errorHandling === ErrorHandlingMode.FORGIVING) {
      // Forgiving mode: original rendering logic
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
      // Perfectionist mode: show typed characters and remaining sentence
      const errorPos = firstErrorPosition
      
      return (
        <div className="sentence active">
          {/* Render correct characters before error */}
          {errorPos !== null 
            ? sentence.slice(0, errorPos).split('').map((char, index) => (
                <span key={`correct-${index}`} className="char typed">
                  {char}
                </span>
              ))
            : typedCharacters.split('').map((typedChar, index) => {
                // No errors yet, show typed characters as correct
                return (
                  <span key={`correct-${index}`} className="char typed">
                    {typedChar}
                  </span>
                )
              })
          }
          
          {/* Render incorrect characters at error position */}
          {errorPos !== null && (
            <>
              {typedCharacters.slice(errorPos).split('').map((typedChar, index) => (
                <span key={`error-${index}`} className="char typed error">
                  {typedChar}
                </span>
              ))}
            </>
          )}
          
          {/* Render current cursor position */}
          {((errorPos === null && typedCharacters.length < sentence.length) || 
            (errorPos !== null)) && (
            <span className="char current">
              {errorPos !== null 
                ? sentence[errorPos] 
                : sentence[typedCharacters.length]
              }
            </span>
          )}
          
          {/* Render remaining untyped characters */}
          {errorPos !== null 
            ? sentence.slice(errorPos + 1).split('').map((char, index) => (
                <span key={`untyped-${index}`} className="char untyped">
                  {char}
                </span>
              ))
            : sentence.slice(typedCharacters.length + 1).split('').map((char, index) => (
                <span key={`untyped-${index}`} className="char untyped">
                  {char}
                </span>
              ))
          }
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

  // Mode manager state
  const [editingMode, setEditingMode] = useState<TypingMode | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    errorHandling: ErrorHandlingMode
  }>({
    name: '',
    errorHandling: ErrorHandlingMode.FORGIVING
  })

  const renderModeManager = () => {
    if (!showModeManager) return null

    const resetForm = () => {
      setFormData({
        name: '',
        errorHandling: ErrorHandlingMode.FORGIVING
      })
      setEditingMode(null)
      setIsCreating(false)
    }

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      const trimmedName = formData.name.trim()
      
      if (!trimmedName) {
        alert('Please enter a mode name')
        return
      }

      // Check for duplicate names
      const isDuplicate = allModes.some(mode => 
        mode.name.toLowerCase() === trimmedName.toLowerCase() && 
        mode.id !== editingMode?.id
      )

      if (isDuplicate) {
        alert('A mode with this name already exists. Please choose a different name.')
        return
      }

      if (isCreating) {
        createMode(trimmedName, { errorHandling: formData.errorHandling })
      } else if (editingMode) {
        updateMode(editingMode.id, {
          name: trimmedName,
          settings: { errorHandling: formData.errorHandling }
        })
      }
      resetForm()
    }

    const startEdit = (mode: TypingMode) => {
      setEditingMode(mode)
      setFormData({
        name: mode.name,
        errorHandling: mode.settings.errorHandling
      })
      setIsCreating(false)
    }

    const startCreate = () => {
      resetForm()
      setIsCreating(true)
    }

    return (
      <div className="mode-manager-panel">
        <div className="mode-manager-header">
          <h2>Manage Typing Modes</h2>
          <button 
            className="close-manager-btn"
            onClick={() => {
              setShowModeManager(false)
              resetForm()
            }}
          >
            Close
          </button>
        </div>
        
        <div className="mode-manager-content">
          {/* Create/Edit Form */}
          {(isCreating || editingMode) && (
            <div className="mode-form-section">
              <h3>{isCreating ? 'Create New Mode' : 'Edit Mode'}</h3>
              <form onSubmit={handleSubmit} className="mode-form">
                <div className="form-group">
                  <label htmlFor="mode-name">Mode Name:</label>
                  <input
                    id="mode-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter mode name"
                    maxLength={50}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Error Handling:</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="errorHandling"
                        value={ErrorHandlingMode.FORGIVING}
                        checked={formData.errorHandling === ErrorHandlingMode.FORGIVING}
                        onChange={(e) => setFormData(prev => ({ ...prev, errorHandling: e.target.value as ErrorHandlingMode }))}
                      />
                      <span>Forgiving Mode</span>
                      <small>Character turns red until correct key is pressed</small>
                    </label>
                    
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="errorHandling"
                        value={ErrorHandlingMode.PERFECTIONIST}
                        checked={formData.errorHandling === ErrorHandlingMode.PERFECTIONIST}
                        onChange={(e) => setFormData(prev => ({ ...prev, errorHandling: e.target.value as ErrorHandlingMode }))}
                      />
                      <span>Perfectionist Mode</span>
                      <small>Wrong characters appear in red, use backspace to delete</small>
                    </label>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button type="submit" className="save-btn">
                    {isCreating ? 'Create Mode' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={resetForm} className="cancel-btn">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Mode List */}
          <div className="mode-list-section">
            <div className="section-header">
              <div className="section-title-area">
                <h3>Your Modes</h3>
                <span className="mode-count">({allModes.length} total)</span>
              </div>
              {!isCreating && !editingMode && (
                <button onClick={startCreate} className="create-mode-btn">
                  + Create New Mode
                </button>
              )}
            </div>
            
            {allModes.length > 6 && (
              <div className="scroll-hint">
                <p>Scroll down to see all your modes</p>
              </div>
            )}
            
            <div className="modes-grid">
              {allModes.map((mode) => (
                <div key={mode.id} className={`mode-card ${currentMode.id === mode.id ? 'active' : ''}`}>
                  <div className="mode-card-header">
                    <h4 className="mode-card-name">{mode.name}</h4>
                    {mode.isDefault && (
                      <span className="default-badge">Default</span>
                    )}
                  </div>
                  
                  <div className="mode-card-details">
                    <p><strong>Error Handling:</strong> {mode.settings.errorHandling === ErrorHandlingMode.FORGIVING ? 'Forgiving' : 'Perfectionist'}</p>
                    {mode.createdAt && (
                      <p><strong>Created:</strong> {new Date(mode.createdAt).toLocaleDateString()}</p>
                    )}
                  </div>
                  
                  <div className="mode-card-actions">
                    <button
                      onClick={() => {
                        setCurrentMode(mode)
                        setCurrentSentenceIndex(0)
                        setCurrentCharIndex(0)
                        setTypedCharacters('')
                        setFirstErrorPosition(null)
                        setHasError(false)
                      }}
                      className="use-mode-btn"
                      disabled={currentMode.id === mode.id}
                    >
                      {currentMode.id === mode.id ? 'Active' : 'Use Mode'}
                    </button>
                    
                    <button
                      onClick={() => duplicateMode(mode)}
                      className="duplicate-mode-btn"
                    >
                      Duplicate
                    </button>
                    
                    {!mode.isDefault && (
                      <>
                        <button
                          onClick={() => startEdit(mode)}
                          className="edit-mode-btn"
                          disabled={isCreating || editingMode !== null}
                        >
                          Edit
                        </button>
                        
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete "${mode.name}"?`)) {
                              deleteMode(mode.id)
                            }
                          }}
                          className="delete-mode-btn"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

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
        <button 
          className="menu-item"
          onClick={() => {
            setShowModeManager(true)
            setSideMenuOpen(false)
          }}
        >
          ⚙️ Manage Modes
        </button>

        <div className="menu-section">
          <h4>Quick Mode Switch</h4>
          <div className="mode-selection">
            {allModes.slice(0, 5).map((mode) => (
              <button
                key={mode.id}
                className={`mode-item ${currentMode.id === mode.id ? 'active' : ''}`}
                onClick={() => {
                  setCurrentMode(mode)
                  setCurrentSentenceIndex(0)
                  setCurrentCharIndex(0)
                  setTypedCharacters('')
                  setFirstErrorPosition(null)
                  setHasError(false)
                  setSideMenuOpen(false)
                }}
              >
                <div className="mode-name">{mode.name}</div>
                <div className="mode-description">
                  {mode.settings.errorHandling === ErrorHandlingMode.FORGIVING ? 'Forgiving Mode' : 'Perfectionist Mode'}
                </div>
              </button>
            ))}
            {allModes.length > 5 && (
              <p className="more-modes-text">
                + {allModes.length - 5} more modes available in Mode Manager
              </p>
            )}
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

      {/* Mode Manager Panel */}
      {renderModeManager()}

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