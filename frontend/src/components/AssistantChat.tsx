import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { getAIResponse } from '../data/mockData';
import { postChatMessage } from '../api/client';

const SUGGESTED_PROMPTS = [
  'Can I climb stairs today?',
  'My pain is 8/10, what do I do?',
  'When is my next appointment?',
  'What meds do I take today?',
  'What symptoms are urgent?',
];

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Lightweight markdown renderer for assistant bubbles */
function renderMarkdown(text: string): string {
  let html = text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Table rows (naïve)
    .replace(/\|(.+)\|/g, (_m, inner: string) => {
      const cells = inner.split('|').map((c: string) => c.trim());
      const isRule = cells.every((c: string) => /^[-:]+$/.test(c) || c === '');
      if (isRule) return '';
      return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join('')}</tr>`;
    })
    .replace(/(<tr>[\s\S]*?<\/tr>)+/g, (m) => `<table>${m}</table>`)
    // Bullet lists
    .replace(/^[•\-]\s(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)+/g, (m) => `<ul>${m}</ul>`)
    // Double newline → paragraph
    .split('\n\n')
    .map((para) => (para.startsWith('<') ? para : `<p>${para.replace(/\n/g, '<br/>')}</p>`))
    .join('');

  return html;
}

interface AssistantChatProps {
  patientId: string;
  token: string | null;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'init',
  role: 'assistant',
  content: `👋 Hi John! I'm **Rapid Agent**, your AI recovery assistant.\n\nI'm here to guide you through your **Total Hip Replacement** recovery — currently **Week 1 post-discharge**.\n\nAsk me about your medications, upcoming appointments, what you can safely do today, or any symptoms you're experiencing.`,
  timestamp: new Date(),
};

export function AssistantChat({ patientId, token }: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Realistic typing delay
    await new Promise(res => setTimeout(res, 700 + Math.random() * 700));

    const { answer, demo } = await postChatMessage(text, patientId, token);
    const responseText = demo ? getAIResponse(text) : answer;

    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: responseText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMsg]);
    setIsTyping(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  return (
    <div className="chat-container">
      {/* Premium AI agent header */}
      <div className="chat-header-banner" role="banner">
        <div className="chat-agent-avatar" aria-hidden="true">⚡</div>
        <div>
          <div className="chat-agent-name">Rapid Agent AI</div>
          <div className="chat-agent-status">Active · Ready to help</div>
        </div>
        <div className="chat-powered-by">Powered by Gemini</div>
      </div>

      {/* Messages */}
      <div className="chat-messages" id="chat-messages" aria-live="polite" aria-label="Chat conversation">
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className={`chat-avatar ${msg.role}`} aria-hidden="true">
              {msg.role === 'assistant' ? '⚡' : 'JM'}
            </div>
            <div className="chat-bubble-wrapper">
              <div
                className={`chat-bubble${msg.role === 'assistant' ? ' chat-bubble-md' : ''}`}
                dangerouslySetInnerHTML={
                  msg.role === 'assistant'
                    ? { __html: renderMarkdown(msg.content) }
                    : undefined
                }
              >
                {msg.role === 'user' ? msg.content : undefined}
              </div>
              <div className="chat-time" aria-label={`Sent at ${formatTime(msg.timestamp)}`}>
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="chat-message assistant" aria-label="AI is typing">
            <div className="chat-avatar assistant" aria-hidden="true">⚡</div>
            <div className="chat-bubble-wrapper">
              <div className="typing-indicator-bubble" role="status" aria-label="AI is typing a response">
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
      <div className="suggestions-label" aria-label="Suggested questions">Try asking</div>
      <div className="chat-suggestions" role="group" aria-label="Suggested questions">
        {SUGGESTED_PROMPTS.map(prompt => (
          <button
            key={prompt}
            className="suggestion-chip"
            onClick={() => void sendMessage(prompt)}
            disabled={isTyping}
            type="button"
            aria-label={`Ask: ${prompt}`}
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
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isTyping}
          autoComplete="off"
          aria-label="Type your message"
        />
        <button
          type="button"
          className="chat-send-btn"
          onClick={() => void sendMessage(input)}
          disabled={!input.trim() || isTyping}
          aria-label="Send message"
          id="chat-send-btn"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
