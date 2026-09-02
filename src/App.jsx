import { useState, useEffect, useRef, useCallback } from 'react'
import Hangul from 'hangul-js'
import { wordSets } from './data/words'
import { proverbs } from './data/sentences'
import { longTexts } from './data/longtexts'
import './App.css'

const MODES = [
  { key: 'word', label: '낱말연습' },
  { key: 'short', label: '짧은글연습' },
  { key: 'long', label: '긴글연습' },
]

function pickRandom(arr, exclude) {
  if (arr.length <= 1) return arr[0]
  let next
  do {
    next = arr[Math.floor(Math.random() * arr.length)]
  } while (next === exclude)
  return next
}

// 줄바꿈(\n)은 스페이스로 입력해도 인정 — 비교용으로 정규화
function normalizeForCompare(str) {
  return str.replace(/\n/g, ' ')
}

// 한글 자모 단위로 정확히 비교 (hangul-js 이용, 줄바꿈=스페이스 허용)
function compareHangul(target, typed) {
  const targetJamo = Hangul.disassemble(normalizeForCompare(target))
  const typedJamo = Hangul.disassemble(normalizeForCompare(typed))
  let correct = 0
  for (let i = 0; i < typedJamo.length; i++) {
    if (typedJamo[i] === targetJamo[i]) correct++
  }
  return { correct, total: typedJamo.length }
}

export default function App() {
  const [mode, setMode] = useState('short')
  const [wordCategory, setWordCategory] = useState('한글-일반')
  const [target, setTarget] = useState('')
  const [longIndex, setLongIndex] = useState(0)
  const [input, setInput] = useState('')
  const [startTime, setStartTime] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [stats, setStats] = useState({ typed: 0, correct: 0, best: 0 })
  const [round, setRound] = useState(0)
  const [finished, setFinished] = useState(false)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  const loadTarget = useCallback((m, cat, prevTarget) => {
    if (m === 'word') {
      setTarget(pickRandom(wordSets[cat], prevTarget))
    } else if (m === 'short') {
      setTarget(pickRandom(proverbs, prevTarget))
    } else if (m === 'long') {
      setTarget(longTexts[longIndex % longTexts.length].body.trim())
    }
  }, [longIndex])

  useEffect(() => {
    loadTarget(mode, wordCategory, null)
    setInput('')
    setStartTime(null)
    setElapsed(0)
    setFinished(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, wordCategory, longIndex])

  useEffect(() => {
    if (startTime && !finished) {
      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - startTime) / 1000)
      }, 100)
    }
    return () => clearInterval(timerRef.current)
  }, [startTime, finished])

  const handleChange = (e) => {
    const val = e.target.value
    if (!startTime) setStartTime(Date.now())
    setInput(val)

    if (normalizeForCompare(val) === normalizeForCompare(target)) {
      clearInterval(timerRef.current)
      const timeSec = (Date.now() - startTime) / 1000
      const { correct, total } = compareHangul(target, val)
      const cpm = timeSec > 0 ? Math.round((total / timeSec) * 60) : 0
      setStats((s) => ({
        typed: s.typed + total,
        correct: s.correct + correct,
        best: Math.max(s.best, cpm),
      }))
      setFinished(true)
      setElapsed(timeSec)
      setTimeout(() => {
        setRound((r) => r + 1)
        if (mode === 'long') {
          setLongIndex((i) => i + 1)
        } else {
          loadTarget(mode, wordCategory, target)
          setInput('')
          setStartTime(null)
          setElapsed(0)
          setFinished(false)
          inputRef.current?.focus()
        }
      }, 900)
    }
  }

  const { correct: liveCorrect, total: liveTotal } = compareHangul(target, input)
  const accuracy = liveTotal > 0 ? Math.round((liveCorrect / liveTotal) * 100) : 100
  const cpm = elapsed > 0 ? Math.round((liveTotal / elapsed) * 60) : 0

  const renderTarget = () => {
    const chars = target.split('')
    return chars.map((ch, i) => {
      let cls = 'char-pending'
      if (i < input.length) {
        const typedCh = input[i]
        // 줄바꿈 위치엔 스페이스 입력도 정답으로 인정
        const isMatch = typedCh === ch || (ch === '\n' && typedCh === ' ')
        cls = isMatch ? 'char-correct' : 'char-wrong'
      } else if (i === input.length) {
        cls = 'char-cursor'
      }
      return (
        <span key={i} className={cls}>
          {ch === '\n' ? '↵\n' : ch}
        </span>
      )
    })
  }

  return (
    <div className="dos-screen" onClick={() => inputRef.current?.focus()}>
      <div className="dos-header">
        <span className="dos-title">◆ 타자핑(TAJAPING) - 도스식 타자연습 ◆</span>
      </div>

      <div className="dos-menu">
        {MODES.map((m) => (
          <button
            key={m.key}
            className={mode === m.key ? 'dos-tab active' : 'dos-tab'}
            onClick={() => setMode(m.key)}
          >
            [{m.label}]
          </button>
        ))}
        {mode === 'word' && (
          <select
            className="dos-select"
            value={wordCategory}
            onChange={(e) => setWordCategory(e.target.value)}
          >
            {Object.keys(wordSets).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="dos-statusbar">
        <span>회차: {round}</span>
        <span>경과: {elapsed.toFixed(1)}초</span>
        <span>타수: {cpm}타/분</span>
        <span>정확도: {accuracy}%</span>
        <span>최고: {stats.best}타/분</span>
      </div>

      <div className="dos-textbox">
        <pre className="dos-target">{renderTarget()}</pre>
      </div>

      <textarea
        ref={inputRef}
        className="dos-input"
        value={input}
        onChange={handleChange}
        autoFocus
        spellCheck={false}
        placeholder="여기에 입력하세요 (화면의 글자를 그대로 따라 치세요)"
        rows={mode === 'long' ? 6 : 1}
      />

      <div className="dos-footer">
        누적: {stats.correct}/{stats.typed}자 (정확도{' '}
        {stats.typed > 0 ? Math.round((stats.correct / stats.typed) * 100) : 100}%) | ESC 없이
        브라우저 새로고침으로 초기화
      </div>
    </div>
  )
}
