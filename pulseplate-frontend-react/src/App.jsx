import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { renderMarkdown, escapeHtml } from './markdown.js'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function buildProfileText(payload) {
  return (
    `Age: ${payload.age}; Body stats: ${payload.body_stats}; Activity: ${payload.activity_level}; ` +
    `Diet: ${payload.dietary_preference}; Restrictions: ${payload.restrictions}; Goal: ${payload.goal}; Notes: ${payload.notes}`
  )
}

const formContainerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

export default function App() {
  const [age, setAge] = useState('')
  const [bodyStats, setBodyStats] = useState('')
  const [activityLevel, setActivityLevel] = useState('')
  const [dietaryPreference, setDietaryPreference] = useState('')
  const [goal, setGoal] = useState('')
  const [restrictions, setRestrictions] = useState('')
  const [notes, setNotes] = useState('')

  const [followupInput, setFollowupInput] = useState('')
  const [entries, setEntries] = useState([])
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('READY') // READY | SYNCING | ERROR
  const [showFollowup, setShowFollowup] = useState(false)

  const messageHistoryRef = useRef([])
  const outputRef = useRef(null)

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' })
  }, [entries])

  const streamPlan = async (payload, isFollowup) => {
    setSending(true)
    setStatus('SYNCING')

    const assistantId = Date.now() + Math.random()

    setEntries((prev) => {
      const base = isFollowup
        ? [...prev, { id: assistantId - 0.5, role: 'user', text: payload.followup }]
        : []
      return [...base, { id: assistantId, role: 'assistant', text: '', streaming: true, failed: false }]
    })

    let rawBuffer = ''

    try {
      const res = await fetch(`${API_BASE}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isFollowup
            ? { followup: payload.followup, message_history: messageHistoryRef.current }
            : payload
        ),
      })

      if (!res.ok || !res.body) {
        throw new Error(`Server responded with ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let partial = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        partial += decoder.decode(value, { stream: true })

        const events = partial.split('\n\n')
        partial = events.pop()

        for (const evt of events) {
          if (!evt.startsWith('data: ')) continue
          const data = JSON.parse(evt.slice(6))

          if (data.error) {
            setEntries((prev) =>
              prev.map((e) =>
                e.id === assistantId
                  ? { ...e, streaming: false, failed: true, text: `Something went wrong: ${data.error}` }
                  : e
              )
            )
            setStatus('ERROR')
            setSending(false)
            return
          }
          if (data.done) continue
          if (data.text) {
            rawBuffer += data.text
            const snapshot = rawBuffer
            setEntries((prev) =>
              prev.map((e) => (e.id === assistantId ? { ...e, text: snapshot } : e))
            )
          }
        }
      }

      setEntries((prev) =>
        prev.map((e) => (e.id === assistantId ? { ...e, streaming: false } : e))
      )

      messageHistoryRef.current = [
        ...messageHistoryRef.current,
        { role: 'user', content: isFollowup ? payload.followup : buildProfileText(payload) },
        { role: 'assistant', content: rawBuffer },
      ]

      setShowFollowup(true)
      setStatus('READY')
    } catch (err) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === assistantId
            ? { ...e, streaming: false, failed: true, text: `Couldn't reach the server: ${err.message}` }
            : e
        )
      )
      setStatus('ERROR')
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      age,
      body_stats: bodyStats,
      activity_level: activityLevel,
      dietary_preference: dietaryPreference,
      restrictions,
      goal,
      notes,
      message_history: [],
    }
    messageHistoryRef.current = []
    setShowFollowup(false)
    streamPlan(payload, false)
  }

  const handleFollowup = (e) => {
    e.preventDefault()
    const text = followupInput.trim()
    if (!text) return
    setFollowupInput('')
    streamPlan({ followup: text }, true)
  }

  const statusClass = status === 'SYNCING' ? 'syncing' : status === 'ERROR' ? 'error' : ''

  return (
    <div className="page">
      <motion.header
        className="site-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="brand">
          <svg className="pulse-mark" viewBox="0 0 140 44" width="120" height="38" aria-hidden="true">
            <motion.polyline
              points="0,22 30,22 38,22 44,6 50,38 56,22 64,22 72,22 78,10 84,34 90,22 140,22"
              fill="none"
              stroke="var(--coral)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className={sending ? 'pulse-active' : ''}
            />
          </svg>
          <div>
            <h1>
              PulsePlate<span>AI</span>
            </h1>
            <p className="tagline">A personalized nutrition starting point, tuned to how you actually live.</p>
          </div>
        </div>
        <motion.div
          className={`status-readout ${statusClass}`}
          animate={statusClass === 'syncing' ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={statusClass === 'syncing' ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : {}}
        >
          {status}
        </motion.div>
      </motion.header>

      <main className="layout">
        <motion.section
          className="panel form-panel"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
          whileHover={{ y: -2 }}
        >
          <h2>
            <span className="eyebrow">Step 01 — Log your profile</span>Tell PulsePlate about you
          </h2>

          <motion.form
            className="profile-form"
            onSubmit={handleSubmit}
            variants={formContainerVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div className="field-row" variants={fieldVariants}>
              <div>
                <label htmlFor="age">Age</label>
                <input
                  type="text"
                  id="age"
                  required
                  placeholder="e.g. 29"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="bodyStats">Weight &amp; height</label>
                <input
                  type="text"
                  id="bodyStats"
                  required
                  placeholder="e.g. 68 kg, 170 cm"
                  value={bodyStats}
                  onChange={(e) => setBodyStats(e.target.value)}
                />
              </div>
            </motion.div>

            <motion.div variants={fieldVariants}>
              <label htmlFor="activityLevel">Activity level</label>
              <select
                id="activityLevel"
                required
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value)}
              >
                <option value="">Select one</option>
                <option>Sedentary (desk job, little exercise)</option>
                <option>Lightly active (1-2 workouts/week)</option>
                <option>Moderately active (3-4 workouts/week)</option>
                <option>Very active (5+ workouts/week)</option>
                <option>Athlete / physically demanding job</option>
              </select>
            </motion.div>

            <motion.div variants={fieldVariants}>
              <label htmlFor="dietaryPreference">Dietary preference</label>
              <select
                id="dietaryPreference"
                required
                value={dietaryPreference}
                onChange={(e) => setDietaryPreference(e.target.value)}
              >
                <option value="">Select one</option>
                <option>No restrictions</option>
                <option>Vegetarian</option>
                <option>Vegan</option>
                <option>Pescatarian</option>
                <option>Keto / low-carb</option>
                <option>Halal</option>
                <option>Kosher</option>
                <option>Other (specify in notes)</option>
              </select>
            </motion.div>

            <motion.div variants={fieldVariants}>
              <label htmlFor="goal">Primary goal</label>
              <select id="goal" required value={goal} onChange={(e) => setGoal(e.target.value)}>
                <option value="">Select one</option>
                <option>Lose weight gradually</option>
                <option>Maintain current weight</option>
                <option>Build muscle</option>
                <option>Improve energy levels</option>
                <option>Eat more consistently / build habits</option>
                <option>General wellness</option>
              </select>
            </motion.div>

            <motion.div variants={fieldVariants}>
              <label htmlFor="restrictions">
                Allergies, intolerances, or medical notes <span className="hint">(always respected)</span>
              </label>
              <textarea
                id="restrictions"
                rows={2}
                placeholder="e.g. peanut allergy, lactose intolerant, managing type 2 diabetes..."
                value={restrictions}
                onChange={(e) => setRestrictions(e.target.value)}
              />
            </motion.div>

            <motion.div variants={fieldVariants}>
              <label htmlFor="notes">
                Anything else? <span className="hint">(optional — meals/day, cuisines you love, budget...)</span>
              </label>
              <textarea
                id="notes"
                rows={2}
                placeholder="e.g. prefer 3 meals + 1 snack, love Mediterranean food, cooking for one..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </motion.div>

            <motion.button
              type="submit"
              id="submitBtn"
              variants={fieldVariants}
              disabled={sending}
              whileHover={!sending ? { scale: 1.015, filter: 'brightness(1.08)' } : {}}
              whileTap={!sending ? { scale: 0.97 } : {}}
            >
              <span>{sending ? 'Building…' : 'Build my daily plan'}</span>
            </motion.button>
          </motion.form>
        </motion.section>

        <motion.section
          className="panel output-panel"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
          whileHover={{ y: -2 }}
        >
          <h2>
            <span className="eyebrow">Step 02 — Your plan</span>Personalized nutrition starting point
          </h2>

          <div className={`output-body ${status === 'SYNCING' ? 'streaming-glow' : ''}`} ref={outputRef}>
            {entries.length === 0 && (
              <p className="placeholder">
                Fill in your profile and build your plan — a personalized calorie/macro estimate, a
                sample day of meals, and habit tips will stream in here.
              </p>
            )}

            <AnimatePresence initial={false}>
              {entries.map((entry) =>
                entry.role === 'user' ? (
                  <motion.p
                    key={entry.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <strong>You:</strong> {entry.text}
                  </motion.p>
                ) : (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {entry.failed ? (
                      <div className="error-box">{entry.text}</div>
                    ) : (
                      <div
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.text) }}
                      />
                    )}
                    {entry.streaming && !entry.failed && <span className="cursor-blink" />}
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showFollowup && (
              <motion.form
                className="followup-form"
                onSubmit={handleFollowup}
                initial={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: '1.5rem', paddingTop: '1.25rem' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <input
                  type="text"
                  placeholder="Ask a follow-up — swap a meal, adjust a macro..."
                  autoComplete="off"
                  value={followupInput}
                  onChange={(e) => setFollowupInput(e.target.value)}
                  disabled={sending}
                />
                <motion.button
                  type="submit"
                  aria-label="Send follow-up"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  disabled={sending}
                >
                  &#8594;
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.section>
      </main>

      <motion.footer
        className="site-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        <p>
          Built with Claude · PulsePlate AI is a course project offering general educational guidance,
          not medical or dietetic advice. Speak with a registered dietitian or doctor before making
          significant changes.
        </p>
      </motion.footer>
    </div>
  )
}
