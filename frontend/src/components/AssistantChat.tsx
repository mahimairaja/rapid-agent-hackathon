import { useState, useRef, useEffect } from 'react'
import type { ChatMessage } from '../types'
import { getAIResponse } from '../data/mockData'
import { postAgentChat, getClientTimeZone } from '../api/client'

const SUGGESTED_PROMPTS = [
  'Can I climb stairs today?',
  'My pain is 8/10, what should I do?',
  'When is my next appointment?',
  'What medications do I take today?',
  'What symptoms are urgent?',
]

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/** Very simple markdown-like renderer for chat bubbles. */
function renderMarkdown(text: string) {
  // Bold **text**
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Tables: a naive row-by-row pass
    .replace(/\|(.+)\|/g, (_m, inner) => {
      const cells = inner.split('|').map((c: string) => c.trim())
      const isHeader = cells.every((c: string) => c.startsWith('-') || c === '')
      if (isHeader) return ''
      return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join('')}</tr>`
    })
    // Wrap consecutive <tr> in a table
    .replace(/(<tr>.*?<\/tr>)+/gs, (match) => `<table>${match}</table>`)
    // Lists: lines starting with "- " or "1. "
    .replace(/^[•-] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    // Paragraphs (double newline)
    .split('\n\n')
    .map((para) => (para.startsWith('<') ? para : `<p>${para.replace(/\n/g, '<br/>')}</p>`))
    .join('')

  return html
}

interface AssistantChatProps {
  initialInput?: string | null
  onTurnComplete?: () => void
  token: string | null
  userInitials: string
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'init',
  role: 'assistant',
  content: `👋 Hi John! I'm your **Rapid Agent** recovery assistant.\n\nI'm here to help you through your **Total Hip Replacement** recovery — Week 1 post-discharge.\n\nAsk me about your medications, next appointment, what you can or can't do today, or what symptoms to watch for.`,
  timestamp: new Date(),
}

export function AssistantChat({
  initialInput,
  onTurnComplete,
  token,
  userInitials,
}: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState(initialInput ?? '')
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Simulate typing delay
    await new Promise((res) => setTimeout(res, 800 + Math.random() * 600))

    // Try real API first, fall back to local simulation
    const result = await postAgentChat(
      {
        message: text.trim(),
        session_id: sessionId,
        time_zone: getClientTimeZone(),
      },
      token,
    )

    if (result.sessionId) {
      setSessionId(result.sessionId)
    }

    const responseText = result.demo ? getAIResponse(text) : result.reply

    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: responseText,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, assistantMsg])
    setIsTyping(false)
    onTurnComplete?.()
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  return (
    <div className="chat-container">
      {/* Messages */}
      <div className="chat-messages" id="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className={`chat-avatar ${msg.role}`}>
              {msg.role === 'assistant' ? '🤖' : userInitials}
            </div>
            <div>
              <div
                className={`chat-bubble${msg.role === 'assistant' ? ' chat-bubble-md' : ''}`}
                dangerouslySetInnerHTML={
                  msg.role === 'assistant' ? { __html: renderMarkdown(msg.content) } : undefined
                }
              >
                {msg.role === 'user' ? msg.content : undefined}
              </div>
              <div className="chat-time">{formatTime(msg.timestamp)}</div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="chat-message assistant">
            <div className="chat-avatar assistant">🤖</div>
            <div className="chat-bubble" style={{ padding: 0 }}>
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      <div className="chat-suggestions">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            className="suggestion-chip"
            onClick={() => void sendMessage(prompt)}
            disabled={isTyping}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="chat-input-row">
        <input
          ref={inputRef}
          id="chat-input"
          className="chat-input"
          type="text"
          placeholder="Ask about your recovery…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isTyping}
          autoComplete="off"
        />
        <button
          type="button"
          className="chat-send-btn"
          onClick={() => void sendMessage(input)}
          disabled={!input.trim() || isTyping}
          aria-label="Send message"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
