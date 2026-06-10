import React, { useImperativeHandle } from 'react';
import { Settings, Home, Compass, BookOpen, FileText, CheckCircle, Sparkles, Image, Eye, Download, Library, Send, X, Monitor, Smartphone, Menu, Copy, Check, Trash2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';
import SettingsModal from '@/components/notebook/SettingsModal';
import { useNotebookTheme } from '@/components/notebook/ThemeProvider';
import MobilePageToggle from '@/components/notebook/MobilePageToggle';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';

const PHASES = [
  { id: 'plan',    label: 'Plan',    accent: '#b48a57' },
  { id: 'write',   label: 'Write',   accent: '#7a8f5e' },
  { id: 'refine',  label: 'Refine',  accent: '#6788a3' },
  { id: 'publish', label: 'Publish', accent: '#8b6fa8' },
];
const TAB_META = {
  home:       { icon: Home,        phase: 'plan' },
  setup:      { icon: Compass,     phase: 'plan' },
  foundation: { icon: BookOpen,    phase: 'plan' },
  outline:    { icon: FileText,    phase: 'write' },
  review:     { icon: CheckCircle, phase: 'refine' },
  tools:      { icon: Sparkles,    phase: 'refine' },
  cover:      { icon: Image,       phase: 'publish' },
  preview:    { icon: Eye,         phase: 'publish' },
  export:     { icon: Download,    phase: 'publish' },
};

/* ─── Chat message with copy button ─── */
function ChatBubble({ m, ink, accent }) {
  const [copied, setCopied] = React.useState(false);
  const isUser = m.role === 'user';
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(m.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <div style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%', position: 'relative', group: true }}>
      <div style={{
        padding: '8px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.5,
        background: isUser ? accent : `color-mix(in srgb, ${ink} 8%, transparent)`,
        color: isUser ? '#fff' : ink,
        border: isUser ? 'none' : `1px solid color-mix(in srgb, ${ink} 12%, transparent)`,
      }}>{m.text}</div>
      <button onClick={handleCopy} title="Copy" style={{
        position: 'absolute', top: 4, right: isUser ? 'auto' : 4, left: isUser ? 4 : 'auto',
        background: `color-mix(in srgb, ${ink} 10%, transparent)`, border: 'none', borderRadius: 6,
        width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.4, transition: 'opacity 150ms',
      }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}>
        {copied ? <Check size={11} style={{ color: isUser ? '#fff' : ink }} /> : <Copy size={11} style={{ color: isUser ? '#fff' : ink }} />}
      </button>
    </div>
  );
}

/* ─── Brainstorm Chat Panel (persisted per project) ─── */
function getProjectIdFromUrl() {
  const match = window.location.pathname.match(/\/projects\/([^/]+)/);
  return match ? match[1] : 'global';
}
function getChatStorageKey(pid) { return 'ubs_brainstorm_' + pid; }
function loadChatHistory(pid) {
  try { const raw = localStorage.getItem(getChatStorageKey(pid)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveChatHistory(pid, messages) {
  try { localStorage.setItem(getChatStorageKey(pid), JSON.stringify(messages.slice(-100))); } catch {}
}

function BrainstormChat({ open, onClose, projectTitle }) {
  const { theme: T } = useNotebookTheme();
  const pid = getProjectIdFromUrl();
  const [messages, setMessages] = React.useState(() => {
    const saved = loadChatHistory(pid);
    return saved && saved.length > 0 ? saved : [
      { role: 'assistant', text: "Hi! I'm your brainstorm partner. Ask me anything about your story — characters, plot holes, world-building, or just bounce ideas." },
    ];
  });
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef(null);
  const prevPidRef = React.useRef(pid);

  // Switch chat history when project changes
  React.useEffect(() => {
    if (pid !== prevPidRef.current) {
      prevPidRef.current = pid;
      const saved = loadChatHistory(pid);
      setMessages(saved && saved.length > 0 ? saved : [
        { role: 'assistant', text: "Hi! I'm your brainstorm partner. Ask me anything about your story — characters, plot holes, world-building, or just bounce ideas." },
      ]);
    }
  }, [pid]);

  // Persist on change
  React.useEffect(() => { saveChatHistory(pid, messages); }, [messages, pid]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleClear = () => {
    if (!window.confirm('Clear this chat history? This cannot be undone.')) return;
    const fresh = [{ role: 'assistant', text: "Chat cleared. What would you like to brainstorm?" }];
    setMessages(fresh);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setBusy(true);
    try {
      const ctx = window.__ubsProjectContext || {};
      const contextBlock = [
        ctx.title ? `Title: ${ctx.title}` : '',
        ctx.genre ? `Genre: ${ctx.genre}` : '',
        ctx.seed_concept ? `Premise: ${ctx.seed_concept}` : '',
        ctx.characters_md ? `Characters:\n${ctx.characters_md.substring(0, 1500)}` : '',
        ctx.world_md ? `World:\n${ctx.world_md.substring(0, 1000)}` : '',
        ctx.outline_md ? `Outline:\n${ctx.outline_md.substring(0, 1500)}` : '',
      ].filter(Boolean).join('\n\n');
      const recentHistory = [...messages.slice(-12), { role: 'user', text }];
      const result = await invokeLLMWithRetry({
        prompt: `You are a creative writing brainstorm partner for a book project. Be concise, specific, and actionable. Never be generic. Reference the project details when relevant.

STORY ENGINE (CRITICAL): Every story needs a clear engine: "They must [OBJECTIVE] before [DEADLINE] or else [CONSEQUENCE]." If the author's idea doesn't have this yet, help them find it. Ask: "What must they accomplish? What's the ticking clock? What happens if they fail?" A premise without an engine is a setting, not a story.

ESCALATION: Each chapter should raise the stakes above the previous one. If two consecutive chapters feel like "more of the same," flag it — the plot is stalling.

CHARACTER VOICE: Push the author to define how each character SOUNDS different — speech rhythm, vocabulary, verbal habits. If all characters sound the same, the story loses depth.

BUILD WHEN ASKED: When the author asks you to BUILD, WRITE, CREATE, or GENERATE something — a story bible, outline, character sheet, premise — DO IT. Produce the actual content. Do NOT say "that's your creative work." You are a ghostwriter AND a coach. Once you have enough info, produce the output.

--- PROJECT CONTEXT ---\n${contextBlock}\n--- END CONTEXT ---\n\nConversation so far:\n${recentHistory.map(m => `${m.role === 'user' ? 'Author' : 'Brainstorm Partner'}: ${m.text}`).join('\n')}\n\nRespond as the Brainstorm Partner. Keep it under 200 words unless the author asks for something detailed or asks you to build/create something — then give as much as needed.`,
      });
      const reply = typeof result === 'string' ? result : result?.data || result?.text || 'Sorry, I couldn\'t generate a response.';
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong: ' + (err.message || 'Unknown error') }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  const ink = T.page.ink;
  const muted = `color-mix(in srgb, ${ink} 55%, transparent)`;

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'fixed', inset: 0,
      background: T.page.bg,
      fontFamily: 'Inter,sans-serif', color: ink,
      zIndex: 9999, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: `1px solid ${T.page.headerBorder}` }}>
        <Sparkles size={14} style={{ color: T.accent }} />
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>AI Brainstorm</span>
        <span style={{ fontSize: 10, color: muted, background: `rgba(180,138,87,.12)`, padding: '2px 8px', borderRadius: 999 }}>{projectTitle}</span>
        <button onClick={handleClear} title="Clear chat" style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, padding: 4, display: 'flex', alignItems: 'center' }}><Trash2 size={15} /></button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ink, padding: 4, display: 'flex', alignItems: 'center' }}><X size={18} /></button>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <ChatBubble key={i} m={m} ink={ink} accent={T.accent} />
        ))}
        {busy && <div style={{ alignSelf: 'flex-start', maxWidth: '85%', padding: '8px 12px', borderRadius: 12, fontSize: 13, color: muted, background: `color-mix(in srgb, ${ink} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${ink} 12%, transparent)` }}>Thinking…</div>}
      </div>
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${T.page.headerBorder}`, display: 'flex', gap: 8, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Brainstorm an idea…" style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: `1px solid ${T.page.railBorder}`, background: 'transparent', fontSize: 14, color: ink, outline: 'none', fontFamily: 'Inter,sans-serif' }} />
        <button onClick={handleSend} disabled={busy || !input.trim()} style={{ background: T.accent, border: 'none', borderRadius: 10, width: 38, height: 38, cursor: busy || !input.trim() ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', opacity: busy || !input.trim() ? 0.5 : 1 }}><Send size={16} /></button>
      </div>
    </div>
  );
}

/* ─── Section Rail (desktop) ─── */
function SectionRail({ sections, active, onChange, collapsed, T }) {
  const sMap = {};
  for (const s of sections) sMap[s.id] = s;
  return (
    <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {PHASES.map(phase => {
        const tabs = phase.id === 'plan' ? ['home','setup','foundation'] : phase.id === 'write' ? ['outline'] : phase.id === 'refine' ? ['review','tools'] : ['cover','preview','export'];
        const pt = tabs.filter(id => sMap[id]);
        if (!pt.length) return null;
        return (
          <div key={phase.id} style={{ marginBottom: collapsed ? 6 : 10 }}>
            {collapsed ? (
              <div style={{ margin: '8px 0 4px', display: 'flex', justifyContent: 'center' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: phase.accent }} />
              </div>
            ) : (
              <div style={{ padding: '6px 16px 4px', fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 600, color: phase.accent, letterSpacing: '.18em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: phase.accent }} />
                {phase.label}
              </div>
            )}
            {pt.map(tabId => {
              const isActive = active === tabId;
              const meta = TAB_META[tabId];
              const IconComp = meta?.icon || Home;
              return (
                <button key={tabId} onClick={() => onChange(tabId)} title={collapsed ? sMap[tabId]?.label : ''} style={{
                  width: '100%', padding: collapsed ? '10px 0' : '10px 14px 10px 16px',
                  display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 11,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: isActive ? T.page.bg : 'transparent',
                  border: 'none', borderLeft: `3px solid ${isActive ? phase.accent : 'transparent'}`,
                  color: T.page.ink, fontFamily: 'Inter,sans-serif', fontSize: 13.5, fontWeight: isActive ? 600 : 400,
                  textAlign: 'left', cursor: 'pointer', transition: 'all 120ms',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = `color-mix(in srgb, ${T.page.innerBg} 60%, transparent)`; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? T.page.bg : 'transparent'; }}
                >
                  <span style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: isActive ? phase.accent : `color-mix(in srgb, ${T.page.ink} 55%, transparent)` }}>
                    <IconComp size={16} />
                  </span>
                  {!collapsed && <span style={{ flex: 1 }}>{sMap[tabId]?.label}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Spiral ─── */
function Spiral() {
  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 52, pointerEvents: 'none', zIndex: 8, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: '10px 0' }} aria-hidden="true">
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 18, transform: 'translateX(-50%)', background: 'linear-gradient(90deg, rgba(0,0,0,.28) 0%, rgba(0,0,0,.12) 40%, rgba(0,0,0,.08) 50%, rgba(0,0,0,.12) 60%, rgba(0,0,0,.28) 100%)', boxShadow: 'inset 0 0 10px rgba(0,0,0,.4)' }} />
      {Array.from({ length: 24 }).map((_, i) => (
        <svg key={i} viewBox="0 0 56 26" style={{ width: 52, height: 24, position: 'relative', zIndex: 1, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.35))' }}>
          <path d="M8 22 C8 8, 28 3, 28 3 C28 3, 48 8, 48 22" fill="none" stroke="rgba(0,0,0,.55)" strokeWidth="4" strokeLinecap="round" />
          <path d="M8 22 C8 8, 28 3, 28 3 C28 3, 48 8, 48 22" fill="none" stroke="url(#ring)" strokeWidth="3.2" strokeLinecap="round" />
          <defs><linearGradient id="ring" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d4c49a"/><stop offset=".35" stopColor="#a89068"/><stop offset=".6" stopColor="#7a6240"/><stop offset="1" stopColor="#3e301c"/></linearGradient></defs>
        </svg>
      ))}
    </div>
  );
}

/* ─── Page wrapper (desktop) — FIXED: overflow + border-radius ─── */
function Page({ children, ruled, margin, T, style = {} }) {
  return (
    <div style={{
      flex: 1, position: 'relative', background: T.page.bg, color: T.page.ink,
      boxShadow: 'inset 0 0 40px rgba(0,0,0,.04)', overflowY: 'auto', overflowX: 'hidden', minWidth: 0, ...style,
    }}>
      {margin && <div style={{ position: 'absolute', top: 0, left: 56, width: 1, height: '100%', background: T.page.margin, pointerEvents: 'none' }} />}
      <div style={{
        position: 'relative', padding: margin ? '40px 44px 60px 80px' : '40px 44px 60px',
        backgroundImage: ruled ? `repeating-linear-gradient(to bottom, transparent 0, transparent 30px, ${T.page.ruling} 30px, ${T.page.ruling} 31px)` : 'none',
        backgroundPosition: '0 52px',
        minHeight: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden',
        wordBreak: 'normal', overflowWrap: 'break-word',
      }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Mobile Drawer ─── */
function MobileDrawer({ open, onClose, sections, activeTab, onTabChange, T, projectTitle, subtitle, onBackToLibrary }) {
  if (!open) return null;
  const ink = T.page.ink;
  const bg = T.page.bg;
  const innerBg = T.page.innerBg;
  const accent = T.accent;
  const muted = `color-mix(in srgb, ${ink} 55%, transparent)`;
  const rule = `color-mix(in srgb, ${ink} 18%, transparent)`;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} />
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: 280,
        background: innerBg, boxShadow: '8px 0 30px rgba(0,0,0,.2)',
        display: 'flex', flexDirection: 'column',
        animation: 'ubs-drawer-in 200ms ease-out',
      }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${rule}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: T.type.heading, fontSize: 18, fontWeight: 500, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{projectTitle}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: 20, padding: 4 }}>×</button>
          </div>
          {subtitle && <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeof subtitle === 'string' && subtitle.length > 40 ? subtitle.substring(0, 40) + '…' : subtitle}</div>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
          {PHASES.map(phase => {
            const tabs = phase.id === 'plan' ? ['home','setup','foundation'] : phase.id === 'write' ? ['outline'] : phase.id === 'refine' ? ['review','tools'] : ['cover','preview','export'];
            const phaseSections = tabs.filter(id => sections.find(s => s.id === id));
            if (!phaseSections.length) return null;
            return (
              <div key={phase.id} style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.14em', color: accent, padding: '0 10px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: accent }} />
                  {phase.label}
                </div>
                {phaseSections.map(tabId => {
                  const s = sections.find(sec => sec.id === tabId);
                  if (!s) return null;
                  const active = activeTab === tabId;
                  const meta = TAB_META[tabId];
                  const IconComp = meta?.icon || Home;
                  return (
                    <button key={tabId} onClick={() => { onTabChange(tabId); onClose(); }} style={{
                      width: '100%', padding: '11px 14px', borderRadius: 10,
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: active ? bg : 'transparent',
                      border: 'none', cursor: 'pointer',
                      borderLeft: `3px solid ${active ? accent : 'transparent'}`,
                      fontFamily: 'Inter,sans-serif', fontSize: 14, fontWeight: active ? 500 : 400,
                      color: active ? ink : `color-mix(in srgb, ${ink} 72%, transparent)`,
                      textAlign: 'left', marginBottom: 2,
                      boxShadow: active ? '0 1px 4px rgba(0,0,0,.06)' : 'none',
                    }}>
                      <IconComp size={16} style={{ color: active ? accent : muted }} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${rule}`, display: 'flex', gap: 8 }}>
          <button onClick={onBackToLibrary} style={{
            flex: 1, padding: '10px 0', borderRadius: 10,
            background: 'transparent', border: `1px solid ${rule}`,
            fontFamily: 'Inter,sans-serif', fontSize: 12, color: ink, fontWeight: 500,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Library size={13} /> Library
          </button>
        </div>
      </div>
      <style>{`@keyframes ubs-drawer-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
    </div>
  );
}

/* ─── Mobile Shell ─── */
function MobileView({ projectTitle, subtitle, sections, activeTab, setActiveTab, T, settings, navigate }) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activePane, setActivePane] = React.useState('left');
  const [chatOpen, setChatOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const activeSection = sections.find(s => s.id === activeTab) || sections[0];
  const isSplit = activeSection.layout === 'split';

  React.useEffect(() => { setActivePane('left'); }, [activeTab]);

  const ink = T.page.ink;
  const bg = T.page.bg;
  const innerBg = T.page.innerBg;
  const accent = T.accent;
  const muted = `color-mix(in srgb, ${ink} 55%, transparent)`;
  const rule = `color-mix(in srgb, ${ink} 18%, transparent)`;
  const phase = PHASES.find(p => { const m = TAB_META[activeTab]; return m && p.id === m.phase; }) || PHASES[0];

  return (
    <div style={{
      width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
      background: bg, color: ink, fontFamily: 'Inter, system-ui, sans-serif',
      overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px',
        background: `color-mix(in srgb, ${bg} 95%, ${accent} 5%)`,
        borderBottom: `1px solid ${rule}`, flexShrink: 0,
      }}>
        <button onClick={() => setDrawerOpen(true)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          color: ink, display: 'flex', alignItems: 'center',
        }}>
          <Menu size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: T.type.heading, fontSize: 16, fontWeight: 500,
            color: ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{projectTitle}</div>
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={(e) => { e.stopPropagation(); setChatOpen(o => !o); }} title="AI Brainstorm" style={{
            background: chatOpen ? accent : `color-mix(in srgb, ${accent} 15%, transparent)`,
            border: 'none', borderRadius: 999, width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: chatOpen ? '#fff' : accent,
          }}>
            <Sparkles size={14} />
          </button>
          <BrainstormChat open={chatOpen} onClose={() => setChatOpen(false)} projectTitle={projectTitle} />
        </div>
        <button onClick={() => setSettingsOpen(true)} style={{
          background: `color-mix(in srgb, ${accent} 15%, transparent)`,
          border: 'none', borderRadius: 999, width: 32, height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: accent,
        }}>
          <Settings size={14} />
        </button>
      </div>

      {isSplit && (
        <MobilePageToggle activePage={activePane} onToggle={setActivePane} sectionId={activeSection.id} />
      )}

      <style>{`
        .ubs-mobile-pane-scroll {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          touch-action: pan-y;
        }

        /*
          Desktop notebook panes intentionally use h-full / overflow-hidden so the
          two-page spread can manage its own scroll. On mobile those same classes
          trap the Chapters/Scenes content inside a fixed-height clipped box.
          Force the active mobile pane back into normal document flow so the
          single mobile scroll container can scroll the full chapter queue/editor.
        */
        .ubs-mobile-pane-scroll .ubs-outline-left-pane,
        .ubs-mobile-pane-scroll .ubs-outline-right-pane {
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
          display: block !important;
        }

        .ubs-mobile-pane-scroll .ubs-outline-left-pane > *,
        .ubs-mobile-pane-scroll .ubs-outline-right-pane > * {
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
          flex: 0 0 auto !important;
        }

        .ubs-mobile-pane-scroll textarea,
        .ubs-mobile-pane-scroll [contenteditable="true"],
        .ubs-mobile-pane-scroll .ProseMirror {
          max-width: 100% !important;
          overflow-wrap: break-word !important;
          white-space: pre-wrap !important;
        }
      `}</style>

      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden', background: bg,
      }}>
        <div
          className="ubs-mobile-pane-scroll"
          style={{
            height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
            padding: '20px 16px calc(32px + env(safe-area-inset-bottom))', background: bg,
          }}
        >
          {isSplit ? (
            activePane === 'left' ? activeSection.left : activeSection.right
          ) : (
            activeSection.content
          )}
        </div>
      </div>

      <div style={{
        padding: '10px 16px', borderTop: `1px solid ${rule}`,
        background: innerBg, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
        <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: muted, textTransform: 'uppercase', letterSpacing: '.1em' }}>
          {phase.label}
        </span>
        <span style={{ fontSize: 11, color: muted }}>›</span>
        <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 500, color: ink }}>{activeSection.label}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'Inter,sans-serif', fontSize: 11, color: accent, fontWeight: 500,
        }}>Library</button>
      </div>

      <MobileDrawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        sections={sections} activeTab={activeTab} onTabChange={setActiveTab}
        T={T} projectTitle={projectTitle} subtitle={subtitle}
        onBackToLibrary={() => navigate('/')}
      />
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

/* ═══════════════════ SHELL ═══════════════════ */
// NotebookShell v5: restored original split layout + auto single-pane mode under 1180px.
export default function NotebookShell({ projectTitle, subtitle, sections, navigateRef, initialTab }) {
  const { settings, theme: T } = useNotebookTheme();
  const [activeTab, setActiveTab] = React.useState(initialTab || sections[0]?.id || 'home');
  const [railCollapsed, setRailCollapsed] = React.useState(() => { try { return localStorage.getItem('ubs-rail-collapsed') === '1'; } catch { return false; } });
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [forceMobile, setForceMobile] = React.useState(false);
  const [forceDesktop, setForceDesktop] = React.useState(false);
  const [isNarrowDesktop, setIsNarrowDesktop] = React.useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  useImperativeHandle(navigateRef, () => ({ goToTab: (tabId) => setActiveTab(tabId) }));

  React.useEffect(() => {
    if (!chatOpen) return;
    const close = () => setChatOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [chatOpen]);

  React.useEffect(() => {
    const updateNarrowMode = () => {
      const width = window.innerWidth || document.documentElement?.clientWidth || 0;
      const narrow = width > 0 && width < 1180;
      setIsNarrowDesktop(narrow);
      if (!narrow) setForceDesktop(false);
    };

    updateNarrowMode();
    window.addEventListener('resize', updateNarrowMode);
    return () => window.removeEventListener('resize', updateNarrowMode);
  }, []);

  // Desktop notebook spreads need real width. When the preview/browser gets
  // narrow, switch to the already-built mobile/single-pane layout instead of
  // crushing the right page into one-letter vertical text.
  const showMobile = isMobile || forceMobile || (isNarrowDesktop && !forceDesktop);

  if (showMobile) {
    return (
      <div style={{ position: 'relative' }}>
        {!isMobile && (
          <button onClick={() => { setForceMobile(false); setForceDesktop(true); }} title="Switch to desktop view" style={{
            position: 'fixed', top: 8, right: 8, zIndex: 100,
            background: T.accent, color: '#fff', border: 'none', borderRadius: 999,
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,.3)',
          }}>
            <Monitor size={16} />
          </button>
        )}
        <MobileView
          projectTitle={projectTitle} subtitle={subtitle}
          sections={sections} activeTab={activeTab} setActiveTab={setActiveTab}
          T={T} settings={settings} navigate={navigate}
        />
      </div>
    );
  }

  const toggleRail = () => setRailCollapsed(c => { const n = !c; try { localStorage.setItem('ubs-rail-collapsed', n ? '1' : '0'); } catch {} return n; });
  const activeSection = sections.find(s => s.id === activeTab) || sections[0];
  const wide = activeSection.layout === 'wide';
  const phase = PHASES.find(p => { const m = TAB_META[activeTab]; return m && p.id === m.phase; }) || PHASES[0];
  const ink = T.page.ink;
  const inkSoft = `color-mix(in srgb, ${ink} 55%, transparent)`;
  const pill = `color-mix(in srgb, ${T.page.bg} 70%, transparent)`;

  return (
    <div style={{ width: '100%', height: '100%', padding: '12px', boxSizing: 'border-box', display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
      <div style={{
        position: 'relative', flex: 1, display: 'flex', flexDirection: 'column',
        minHeight: 0, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden',
        background: T.cover.gradient, borderRadius: 18, padding: '24px 30px 28px',
        boxShadow: '0 2px 0 rgba(255,225,180,.22) inset, 0 -3px 0 rgba(25,12,4,.55) inset, 3px 0 0 rgba(25,12,4,.3) inset, -2px 0 0 rgba(255,225,180,.14) inset, 0 2px 4px rgba(0,0,0,.25), 0 18px 36px -10px rgba(0,0,0,.5), 0 50px 90px -24px rgba(0,0,0,.55)',
      }}>
        {T.cover.pattern && <div style={{ position: 'absolute', inset: 0, borderRadius: 18, backgroundImage: T.cover.pattern, pointerEvents: 'none', zIndex: 0 }} />}
        <div style={{ position: 'absolute', inset: 12, borderRadius: 13, border: `1px dashed ${T.cover.stitching}`, pointerEvents: 'none', zIndex: 1 }} />
        <div style={{ position: 'absolute', right: 36, bottom: 14, zIndex: 2, fontFamily: T.type.heading, fontSize: 9, fontWeight: 600, letterSpacing: '.3em', color: T.cover.monogramColor, textShadow: '0 1px 0 rgba(255,225,180,.22), 0 -1px 0 rgba(0,0,0,.3)', pointerEvents: 'none' }}>
          UNITY · BOOK · STUDIO
        </div>
        <div style={{ position: 'absolute', left: '52%', bottom: -38, width: 16, height: 78, background: T.cover.ribbon, boxShadow: '2px 3px 8px rgba(0,0,0,.35)', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)', zIndex: 0, pointerEvents: 'none', transform: 'rotate(-2deg)', transformOrigin: 'top center' }} />

        <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 3, padding: '8px 12px', background: T.pageStack.background, boxShadow: T.pageStack.ringShadow, zIndex: 2, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: T.page.innerBg, borderRadius: '2px 8px 8px 2px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', boxShadow: 'inset 0 2px 10px rgba(0,0,0,.12)', position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px 12px', borderBottom: `1px solid ${T.page.headerBorder}`, flexShrink: 0 }}>
              <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: pill, border: `1px solid ${T.page.railBorder}`, borderRadius: 999, cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 500, color: inkSoft }}>
                <Library size={14} /> Library
              </button>
              <span style={{ color: inkSoft, fontSize: 11, opacity: 0.5 }}>/</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ margin: 0, fontFamily: T.type.heading, fontSize: 22, fontWeight: 500, color: ink, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{projectTitle}</h1>
                {subtitle && <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: inkSoft, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 350 }}>{typeof subtitle === 'string' && subtitle.length > 60 ? subtitle.substring(0, 60) + '…' : subtitle}</div>}
              </div>

              <div style={{ position: 'relative' }}>
                <button title="AI Brainstorm" onClick={(e) => { e.stopPropagation(); setChatOpen(o => !o); }}
                  style={{ background: chatOpen ? T.accent : pill, border: `1px solid ${chatOpen ? T.accent : T.page.railBorder}`, padding: 8, borderRadius: 999, cursor: 'pointer', color: chatOpen ? '#fff' : inkSoft, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
                  <Sparkles size={16} />
                </button>
                <BrainstormChat open={chatOpen} onClose={() => setChatOpen(false)} projectTitle={projectTitle} />
              </div>

              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: inkSoft }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: phase.accent, display: 'inline-block', marginRight: 4 }} />
                  {phase.label} › {activeSection.label}
                </span>
              </div>

              <button onClick={() => setForceMobile(true)} title="Preview mobile view" style={{ width: 34, height: 34, borderRadius: 999, border: `1px solid ${T.page.railBorder}`, background: pill, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: inkSoft }}>
                <Smartphone size={16} />
              </button>

              <button onClick={() => setSettingsOpen(true)} style={{ width: 34, height: 34, borderRadius: 999, border: `1px solid ${T.page.railBorder}`, background: pill, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: inkSoft }}>
                <Settings size={16} />
              </button>
            </div>

            {/* Content: rail + pages */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
              <div style={{ overflowY: 'auto', overflowX: 'visible', borderRight: `1px solid ${T.page.railBorder}`, background: T.page.innerBg, width: railCollapsed ? 56 : 156, flexShrink: 0, transition: 'width 220ms cubic-bezier(.4,.2,.2,1)', position: 'relative' }}>
                <SectionRail sections={sections} active={activeTab} onChange={setActiveTab} collapsed={railCollapsed} T={T} />
              </div>
              <button onClick={toggleRail} title={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} style={{
                position: 'absolute', top: '50%', left: railCollapsed ? 50 : 150, transform: 'translateY(-50%)',
                width: 28, height: 52, borderRadius: '0 14px 14px 0', background: T.accent, border: 'none',
                boxShadow: '0 2px 6px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.25)',
                color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, zIndex: 10, transition: 'left 220ms cubic-bezier(.4,.2,.2,1)',
              }}>
                <span style={{ display: 'inline-block', transform: `translateX(2px) rotate(${railCollapsed ? 180 : 0}deg)`, transition: 'transform 260ms', fontWeight: 700 }}>‹</span>
              </button>

              <div style={{ flex: 1, display: 'flex', background: T.page.bg, position: 'relative', minHeight: 0, minWidth: 0 }}>
                {wide ? (
                  <Page ruled={false} margin={false} T={T} style={{ borderRadius: '0 8px 8px 0' }}>{activeSection.content}</Page>
                ) : (
                  <>
                    <Page ruled={settings.ruledLines} margin={settings.showMargin} T={T} style={{ borderRight: `1px solid ${T.page.railBorder}` }}>{activeSection.left}</Page>
                    <Page ruled={settings.ruledLines} margin={false} T={T} style={{ borderRadius: '0 8px 8px 0' }}>{activeSection.right}</Page>
                    <Spiral />
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 60, transform: 'translateX(-50%)', background: 'linear-gradient(90deg, rgba(0,0,0,.18) 0%, rgba(0,0,0,.06) 30%, transparent 50%, rgba(0,0,0,.06) 70%, rgba(0,0,0,.18) 100%)', pointerEvents: 'none', zIndex: 1 }} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}