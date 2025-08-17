import { useState, useEffect, useCallback } from 'react'
import './App.css'

const FLOOR_TEXTS = [
  "The quick brown fox jumps over the lazy dog.",
  "Practice makes perfect typing skills develop.",
  "Typing speed and accuracy improve with consistent practice.",
  "Focus on proper finger placement and smooth keystrokes.",
  "Regular typing exercises help build muscle memory.",
  "Maintain good posture while typing at your desk.",
  "Take breaks to prevent strain and maintain performance.",
  "Challenge yourself with increasingly difficult passages.",
  "Speed comes naturally when accuracy is prioritized first.",
  "Professional typists achieve both speed and precision.",
  "Modern keyboards facilitate faster and more comfortable typing.",
  "Touch typing eliminates the need to look at keys.",
  "Rhythm and flow are essential for efficient typing.",
  "Consistent practice leads to remarkable improvement over time.",
  "Advanced typists can exceed one hundred words per minute."
]

const generateFloor = (): Floor => {
  const randomText = FLOOR_TEXTS[Math.floor(Math.random() * FLOOR_TEXTS.length)]
  return {
    id: `floor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text: randomText,
    typedText: '',
    correctCharacters: 0,
    incorrectCharacters: 0,
    accuracy: 0,
    wpm: 0,
    completed: false
  }
}

const ErrorHandlingMode = {
  FORGIVING: 'forgiving',
  PERFECTIONIST: 'perfectionist'
} as const

type ErrorHandlingMode = typeof ErrorHandlingMode[keyof typeof ErrorHandlingMode]

const RunType = {
  TIME_BASED: 'time',
  FLOOR_COUNT: 'floors',
  ENDLESS: 'endless'
} as const

type RunType = typeof RunType[keyof typeof RunType]

interface ModeSettings {
  errorHandling: ErrorHandlingMode
  runType: RunType
  runTarget?: number // minutes for time-based, count for floor-based
}

interface TypingMode {
  id: string
  name: string
  settings: ModeSettings
  isDefault: boolean
  createdAt?: string
}

interface Floor {
  id: string
  text: string
  startTime?: Date
  endTime?: Date
  typedText: string
  correctCharacters: number
  incorrectCharacters: number
  accuracy: number
  wpm: number
  completed: boolean
}

interface Run {
  id: string
  modeId: string
  startTime: Date
  endTime?: Date
  runType: RunType
  runTarget?: number
  floorsCompleted: number
  totalCharacters: number
  totalCorrectCharacters: number
  totalIncorrectCharacters: number
  averageAccuracy: number
  averageWPM: number
  isActive: boolean
  floors: Floor[]
}

const DEFAULT_MODES: TypingMode[] = [
  {
    id: 'forgiving-default',
    name: 'Forgiving Mode',
    settings: {
      errorHandling: ErrorHandlingMode.FORGIVING,
      runType: RunType.FLOOR_COUNT,
      runTarget: 10
    },
    isDefault: true
  },
  {
    id: 'perfectionist-default',
    name: 'Perfectionist Mode',
    settings: {
      errorHandling: ErrorHandlingMode.PERFECTIONIST,
      runType: RunType.FLOOR_COUNT,
      runTarget: 10
    },
    isDefault: true
  }
]


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
  const [customModes, setCustomModes] = useState<TypingMode[]>([])
  const [currentMode, setCurrentMode] = useState<TypingMode>(DEFAULT_MODES[0])
  const [currentRun, setCurrentRun] = useState<Run | null>(null)
  const [currentFloor, setCurrentFloor] = useState<Floor | null>(null)
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [typedCharacters, setTypedCharacters] = useState<string>('')
  const [firstErrorPosition, setFirstErrorPosition] = useState<number | null>(null)
  const [sideMenuOpen, setSideMenuOpen] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showModeManager, setShowModeManager] = useState(false)
  const [historicalSessions, setHistoricalSessions] = useState<TypingSession[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])

  // Combine default and custom modes
  const allModes = [...DEFAULT_MODES, ...customModes]

  // Helper functions for run and floor management - declared in order to avoid circular dependencies
  const shouldContinueRun = useCallback((run: Run) => {
    switch (run.runType) {
      case RunType.TIME_BASED: {
        const elapsed = (Date.now() - run.startTime.getTime()) / (1000 * 60) // minutes
        return elapsed < (run.runTarget || 0)
      }
      case RunType.FLOOR_COUNT:
        return run.floorsCompleted < (run.runTarget || 0)
      case RunType.ENDLESS:
        return true
      default:
        return false
    }
  }, [])

  const completeCurrentRun = useCallback(async (run: Run) => {
    const completedRun: Run = {
      ...run,
      endTime: new Date(),
      isActive: false
    }
    setCurrentRun(completedRun)
    setCurrentFloor(null)

    // Save run to database (simplified for now)
    console.log('Run completed:', completedRun)
    
    // Show completion message
    alert(`Run completed! ${completedRun.floorsCompleted} floors finished with ${completedRun.averageAccuracy.toFixed(1)}% accuracy and ${completedRun.averageWPM.toFixed(1)} WPM average.`)
  }, [])

  const startNewFloor = useCallback(() => {
    const newFloor = generateFloor()
    newFloor.startTime = new Date()
    setCurrentFloor(newFloor)
    setCurrentCharIndex(0)
    setTypedCharacters('')
    setFirstErrorPosition(null)
    setHasError(false)
  }, [])

  const completeCurrentFloor = useCallback(() => {
    if (!currentFloor || !currentRun) return

    const now = new Date()
    const completedFloor: Floor = {
      ...currentFloor,
      endTime: now,
      completed: true,
      typedText: typedCharacters
    }

    // Calculate floor stats
    const duration = (now.getTime() - (completedFloor.startTime?.getTime() || 0)) / 1000
    const wordCount = completedFloor.text.split(' ').length
    completedFloor.wpm = duration > 0 ? (wordCount / (duration / 60)) : 0
    completedFloor.accuracy = completedFloor.correctCharacters + completedFloor.incorrectCharacters > 0 
      ? (completedFloor.correctCharacters / (completedFloor.correctCharacters + completedFloor.incorrectCharacters)) * 100 
      : 0

    // Update run with completed floor
    const updatedRun: Run = {
      ...currentRun,
      floors: [...currentRun.floors, completedFloor],
      floorsCompleted: currentRun.floorsCompleted + 1,
      totalCharacters: currentRun.totalCharacters + completedFloor.text.length,
      totalCorrectCharacters: currentRun.totalCorrectCharacters + completedFloor.correctCharacters,
      totalIncorrectCharacters: currentRun.totalIncorrectCharacters + completedFloor.incorrectCharacters
    }

    // Calculate run averages
    updatedRun.averageAccuracy = updatedRun.totalCorrectCharacters + updatedRun.totalIncorrectCharacters > 0
      ? (updatedRun.totalCorrectCharacters / (updatedRun.totalCorrectCharacters + updatedRun.totalIncorrectCharacters)) * 100
      : 0
    updatedRun.averageWPM = updatedRun.floors.reduce((sum, f) => sum + f.wpm, 0) / updatedRun.floors.length

    setCurrentRun(updatedRun)

    // Check if run should continue
    if (shouldContinueRun(updatedRun)) {
      startNewFloor()
    } else {
      completeCurrentRun(updatedRun)
    }
  }, [currentFloor, currentRun, typedCharacters, shouldContinueRun, startNewFloor, completeCurrentRun])

  const startNewRun = useCallback(() => {
    const newRun: Run = {
      id: `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      modeId: currentMode.id,
      startTime: new Date(),
      runType: currentMode.settings.runType,
      runTarget: currentMode.settings.runTarget,
      floorsCompleted: 0,
      totalCharacters: 0,
      totalCorrectCharacters: 0,
      totalIncorrectCharacters: 0,
      averageAccuracy: 0,
      averageWPM: 0,
      isActive: true,
      floors: []
    }
    setCurrentRun(newRun)
    startNewFloor()
  }, [currentMode, startNewFloor])

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
      setCurrentRun(null)
      setCurrentFloor(null)
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



  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Start new run if none exists
    if (!currentRun) {
      startNewRun()
      return
    }

    // Ensure we have a current floor
    if (!currentFloor) {
      return
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

    // Update floor keystroke tracking
    const updatedFloor = { ...currentFloor }

    if (currentMode.settings.errorHandling === ErrorHandlingMode.FORGIVING) {
      // Forgiving mode: existing behavior
      const expectedChar = currentFloor.text[currentCharIndex]
      
      if (typedChar === expectedChar) {
        setHasError(false)
        
        if (currentCharIndex === currentFloor.text.length - 1) {
          // Floor completed
          updatedFloor.correctCharacters++
          updatedFloor.typedText = typedCharacters + typedChar
          setCurrentFloor(updatedFloor)
          completeCurrentFloor()
        } else {
          // Move to next character
          updatedFloor.correctCharacters++
          setCurrentCharIndex(currentCharIndex + 1)
          setCurrentFloor(updatedFloor)
        }
      } else {
        // Wrong key pressed
        setHasError(true)
        updatedFloor.incorrectCharacters++
        setCurrentFloor(updatedFloor)
      }
    } else {
      // Perfectionist mode: allow wrong characters to be typed
      const newTypedChars = typedCharacters + typedChar
      setTypedCharacters(newTypedChars)
      setCurrentCharIndex(newTypedChars.length)
      
      // Determine the expected character at the current correct position
      const correctPosition = firstErrorPosition !== null ? firstErrorPosition : typedCharacters.length
      const expectedChar = currentFloor.text[correctPosition]
      
      if (firstErrorPosition === null && typedChar === expectedChar) {
        // No error yet and typed correct character
        updatedFloor.correctCharacters++
        
        // Check if floor is completed correctly
        if (newTypedChars === currentFloor.text) {
          // Floor completed
          updatedFloor.typedText = newTypedChars
          setCurrentFloor(updatedFloor)
          completeCurrentFloor()
        } else {
          setCurrentFloor(updatedFloor)
        }
      } else {
        // Either we already had an error, or this is the first wrong character
        if (firstErrorPosition === null) {
          // This is the first error
          setFirstErrorPosition(typedCharacters.length)
          setHasError(true)
        }
        
        updatedFloor.incorrectCharacters++
        setCurrentFloor(updatedFloor)
      }
    }
  }, [currentRun, currentFloor, currentCharIndex, currentMode, typedCharacters, firstErrorPosition, startNewRun, completeCurrentFloor])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  const renderFloor = () => {
    if (!currentFloor) {
      return <div className="sentence inactive">Loading floor...</div>
    }

    const sentence = currentFloor.text

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


  // Mode manager state
  const [editingMode, setEditingMode] = useState<TypingMode | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    errorHandling: ErrorHandlingMode
    runType: RunType
    runTarget: number
  }>({
    name: '',
    errorHandling: ErrorHandlingMode.FORGIVING,
    runType: RunType.FLOOR_COUNT,
    runTarget: 10
  })

  const renderModeManager = () => {
    if (!showModeManager) return null

    const resetForm = () => {
      setFormData({
        name: '',
        errorHandling: ErrorHandlingMode.FORGIVING,
        runType: RunType.FLOOR_COUNT,
        runTarget: 10
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
        createMode(trimmedName, { 
          errorHandling: formData.errorHandling,
          runType: formData.runType,
          runTarget: formData.runTarget
        })
      } else if (editingMode) {
        updateMode(editingMode.id, {
          name: trimmedName,
          settings: { 
            errorHandling: formData.errorHandling,
            runType: formData.runType,
            runTarget: formData.runTarget
          }
        })
      }
      resetForm()
    }

    const startEdit = (mode: TypingMode) => {
      setEditingMode(mode)
      setFormData({
        name: mode.name,
        errorHandling: mode.settings.errorHandling,
        runType: mode.settings.runType,
        runTarget: mode.settings.runTarget || 10
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
                
                <div className="form-group">
                  <label>Run Type:</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="runType"
                        value={RunType.TIME_BASED}
                        checked={formData.runType === RunType.TIME_BASED}
                        onChange={(e) => setFormData(prev => ({ ...prev, runType: e.target.value as RunType }))}
                      />
                      <span>Time-based Run</span>
                      <small>Run for a specific amount of time</small>
                    </label>
                    
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="runType"
                        value={RunType.FLOOR_COUNT}
                        checked={formData.runType === RunType.FLOOR_COUNT}
                        onChange={(e) => setFormData(prev => ({ ...prev, runType: e.target.value as RunType }))}
                      />
                      <span>Floor-count Run</span>
                      <small>Complete a specific number of floors</small>
                    </label>
                    
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="runType"
                        value={RunType.ENDLESS}
                        checked={formData.runType === RunType.ENDLESS}
                        onChange={(e) => setFormData(prev => ({ ...prev, runType: e.target.value as RunType }))}
                      />
                      <span>Endless Run</span>
                      <small>Continue until manually stopped</small>
                    </label>
                  </div>
                </div>
                
                {formData.runType !== RunType.ENDLESS && (
                  <div className="form-group">
                    <label htmlFor="run-target">
                      {formData.runType === RunType.TIME_BASED ? 'Duration (minutes):' : 'Number of floors:'}
                    </label>
                    <input
                      id="run-target"
                      type="number"
                      min="1"
                      max={formData.runType === RunType.TIME_BASED ? "120" : "100"}
                      value={formData.runTarget}
                      onChange={(e) => setFormData(prev => ({ ...prev, runTarget: parseInt(e.target.value) || 1 }))}
                      required
                    />
                  </div>
                )}
                
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
                    <p><strong>Run Type:</strong> {
                      mode.settings.runType === RunType.TIME_BASED ? `Time-based (${mode.settings.runTarget || 0}min)` :
                      mode.settings.runType === RunType.FLOOR_COUNT ? `Floor-count (${mode.settings.runTarget || 0} floors)` :
                      'Endless'
                    }</p>
                    {mode.createdAt && (
                      <p><strong>Created:</strong> {new Date(mode.createdAt).toLocaleDateString()}</p>
                    )}
                  </div>
                  
                  <div className="mode-card-actions">
                    <button
                      onClick={() => {
                        setCurrentMode(mode)
                        setCurrentRun(null)
                        setCurrentFloor(null)
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
                  setCurrentRun(null)
                  setCurrentFloor(null)
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
        {currentRun && (
          <>
            <div className="stat-item">
              <span className="stat-label">Floors:</span>
              <span className="stat-value">{currentRun.floorsCompleted}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Accuracy:</span>
              <span className="stat-value">{currentRun.averageAccuracy.toFixed(1)}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Avg WPM:</span>
              <span className="stat-value">{currentRun.averageWPM.toFixed(1)}</span>
            </div>
          </>
        )}
        {!currentRun && (
          <>
            <div className="stat-item">
              <span className="stat-label">Floors:</span>
              <span className="stat-value">0</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Accuracy:</span>
              <span className="stat-value">0%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Avg WPM:</span>
              <span className="stat-value">0</span>
            </div>
          </>
        )}
      </div>

      <div className="typing-area">
        {renderFloor()}
      </div>
      
      <div className="status">
        {currentRun && (
          <>
            <p>Floor {currentRun.floorsCompleted + 1} - {
              currentRun.runType === RunType.TIME_BASED ? `Time-based (${currentRun.runTarget}min)` :
              currentRun.runType === RunType.FLOOR_COUNT ? `Floor ${currentRun.floorsCompleted + 1} of ${currentRun.runTarget}` :
              `Endless run - Floor ${currentRun.floorsCompleted + 1}`
            }</p>
            {currentFloor && (
              <p>Character {currentCharIndex + 1} of {currentFloor.text.length}</p>
            )}
            {hasError && <p className="error">Wrong key! Press the correct key to continue.</p>}
          </>
        )}
        {!currentRun && (
          <p>Press any key to start a new run!</p>
        )}
      </div>
    </div>
  )
}

export default App