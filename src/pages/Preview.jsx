import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Tiny SVG wrapper ───────────────────────────────────────────────
function Ico({ children }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      {children}
    </svg>
  );
}

const TimelineIcon  = () => <Ico><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ico>;
const CeremonyIcon  = () => <Ico><path d="m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16"/></Ico>;
const TableIcon     = () => <Ico><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></Ico>;
const VendorIcon    = () => <Ico><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></Ico>;
const ShuttleIcon   = () => <Ico><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></Ico>;
const DecorIcon     = () => <Ico><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></Ico>;
const BedroomIcon   = () => <Ico><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Ico>;
const RehearsalIcon = () => <Ico><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></Ico>;
const DetailsIcon   = () => <Ico><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="6" y2="2"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="4" y2="2"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="8" y2="2"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="4" y2="4"/><line x1="17" x2="23" y1="16" y2="16"/></Ico>;
const MessageIcon   = () => <Ico><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Ico>;
const SageIcon      = () => <Ico><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4M19 17v4M3 5h4M17 19h4"/></Ico>;
const SendIcon      = () => <Ico><path d="m22 2-7 20-4-9-9-4 20-7z"/><path d="M22 2 11 13"/></Ico>;
const ArrowRight    = () => <Ico><path d="M5 12h14M12 5l7 7-7 7"/></Ico>;

// ── Features ───────────────────────────────────────────────────────
const FEATURES = [
  { icon: <TimelineIcon />,  title: 'Day-of Timeline',       description: 'Build your hour-by-hour schedule. Golden hour is calculated automatically based on your date.' },
  { icon: <CeremonyIcon />,  title: 'Ceremony Order',        description: 'Drag your wedding party into place. Pick roles, group who walks together, sort by tradition in one click.' },
  { icon: <TableIcon />,     title: 'Table Layout',          description: 'Seat your guests, finalise your linen choices, and plan every table in the room.' },
  { icon: <VendorIcon />,    title: 'Vendor Checklist',      description: 'Log every vendor, upload contracts, keep confirmations in one place. No more inbox hunting.' },
  { icon: <ShuttleIcon />,   title: 'Shuttle Schedule',      description: 'Plan guest transport runs. Enter your ceremony time and we\'ll suggest pickup times automatically.' },
  { icon: <DecorIcon />,     title: 'Decor Inventory',       description: 'Track every piece — where it\'s coming from, who\'s bringing it, where it goes home.' },
  { icon: <BedroomIcon />,   title: 'Bedroom Assignments',   description: 'Assign overnight guests to rooms for Friday and Saturday. Pets and all.' },
  { icon: <RehearsalIcon />, title: 'Rehearsal Dinner',      description: 'Tell us the details — bar, food, setup, guest count — so we can have everything ready.' },
  { icon: <DetailsIcon />,   title: 'Wedding Details',       description: 'Arbor style, send-off type, social handles, dogs coming — everything that makes your day yours.' },
  { icon: <MessageIcon />,   title: 'Direct Messages',       description: 'One message thread, straight to your Rixey coordinator. No wondering if your email landed.' },
  { icon: <SageIcon />,      title: 'Sage AI',               description: 'Ask anything — your timeline, alcohol quantities, what to budget for flowers. Trained on Rixey inside out.', highlight: true },
];

const STEPS = [
  { title: 'Create your account',  description: 'Just your email and wedding date. Takes about 30 seconds.' },
  { title: 'Fill in your details', description: 'Go at your own pace. Save as you go. Come back whenever.' },
  { title: 'We handle the rest',   description: 'Your coordinator sees every update in real time. Nothing gets missed.' },
];

const SUGGESTED_QUESTIONS = [
  'What\'s included with Rixey?',
  'How much alcohol do I need for 100 guests?',
  'What time should my ceremony start?',
  'Can we bring our dog?',
];

// ── Sage demo chat ─────────────────────────────────────────────────
function SageDemo() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m Sage — Rixey\'s planning assistant. Ask me anything about the venue, your timeline, vendors, or wedding day logistics.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const conversationHistory = messages
    .filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0)
    .map(m => ({ role: m.role, content: m.content }));

  async function send(text) {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sage-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, conversationHistory }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Sorry, I couldn\'t get a response.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong — try again in a moment.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-sage-800 text-white">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
          <SageIcon />
        </div>
        <div>
          <div className="font-semibold text-sm">Sage</div>
          <div className="text-xs text-sage-300">Rixey Manor planning assistant</div>
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-green-400" title="Online" />
      </div>

      {/* Messages */}
      <div className="h-72 overflow-y-auto px-4 py-4 space-y-3 bg-cream-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-sage-600 text-white rounded-br-sm'
                  : 'bg-white border border-cream-200 text-sage-800 rounded-bl-sm'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-cream-200 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-sage-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-sage-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-sage-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div className="px-4 py-2 flex flex-wrap gap-2 border-t border-cream-200 bg-cream-50">
          {SUGGESTED_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              className="text-xs px-3 py-1.5 rounded-full border border-cream-300 text-sage-600 bg-white hover:border-sage-400 hover:bg-sage-50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-cream-200 bg-white">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask Sage anything about Rixey..."
          className="flex-1 text-sm border border-cream-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sage-300"
          disabled={loading}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="p-2 rounded-xl bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-40 transition-colors shrink-0"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

// ── Sign-up form ───────────────────────────────────────────────────
function SignUpForm() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ names: '', email: '', password: '', weddingDate: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password || !form.weddingDate) {
      setError('Email, password, and wedding date are required.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: signUpError } = await signUp(form.email, form.password);
      if (signUpError) { setError(signUpError.message); setLoading(false); return; }

      const userId = data?.user?.id;
      if (!userId) { setError('Something went wrong creating your account.'); setLoading(false); return; }

      // Create the wedding record
      const eventCode = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
      const { data: wedding } = await supabase
        .from('weddings')
        .insert([{ event_code: eventCode, couple_names: form.names.trim() || null, wedding_date: form.weddingDate, created_by: userId }])
        .select().single();

      // Create profile
      await supabase.from('profiles').insert([{
        id: userId,
        name: form.names.trim() || form.email,
        email: form.email,
        role: 'couple-bride',
        wedding_date: form.weddingDate,
        wedding_id: wedding?.id || null,
      }]);

      // Initialise checklist
      if (wedding?.id) {
        fetch(`${API_URL}/api/checklist/initialize/${wedding.id}`, { method: 'POST' }).catch(() => {});
        fetch(`${API_URL}/api/admin/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'new_wedding', message: `New wedding: ${form.names || form.email} on ${form.weddingDate}. Code: ${eventCode}.`, wedding_id: wedding.id, user_id: userId }),
        }).catch(() => {});
      }

      navigate('/dashboard');
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full border border-cream-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white';

  return (
    <div className="bg-white rounded-2xl border border-cream-200 shadow-sm p-7">
      <h3 className="font-serif text-2xl text-sage-800 mb-1">Start planning</h3>
      <p className="text-sm text-sage-400 mb-6">Create your portal in under a minute.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-sage-600 mb-1.5">Your names</label>
          <input
            className={inputClass}
            placeholder="e.g. Emma & James"
            value={form.names}
            onChange={e => set('names', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sage-600 mb-1.5">Email address</label>
          <input
            type="email"
            required
            className={inputClass}
            placeholder="you@example.com"
            value={form.email}
            onChange={e => set('email', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sage-600 mb-1.5">Wedding date</label>
          <input
            type="date"
            required
            className={inputClass}
            value={form.weddingDate}
            onChange={e => set('weddingDate', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-sage-600 mb-1.5">Password</label>
          <input
            type="password"
            required
            minLength={6}
            className={inputClass}
            placeholder="At least 6 characters"
            value={form.password}
            onChange={e => set('password', e.target.value)}
          />
        </div>

        {error && (
          <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-sage-600 text-white rounded-xl font-medium text-sm hover:bg-sage-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating your portal…' : <>Create your portal <ArrowRight /></>}
        </button>
      </form>

      <p className="text-center text-xs text-sage-400 mt-4">
        Already have an account?{' '}
        <a href="/" className="text-sage-600 hover:underline">Sign in</a>
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────
export default function Preview() {
  return (
    <div className="min-h-screen bg-cream-50 font-sans text-sage-900">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <img src="/rixey-manor-logo.png" alt="Rixey Manor" className="h-8" />
        <a href="/" className="text-sm font-medium text-sage-600 hover:text-sage-700 transition-colors">
          Sign in
        </a>
      </nav>

      {/* ── Hero + Sign-up ── */}
      <section className="px-6 pt-10 pb-20 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sage-400 mb-5">
              Rixey Manor · Planning Portal
            </p>
            <h1 className="font-serif text-5xl sm:text-6xl text-sage-800 leading-[1.1] mb-6">
              Your wedding,<br />planned in one place.
            </h1>
            <p className="text-lg text-sage-500 leading-relaxed mb-8">
              We built this so the two of you can fill in every detail at your own pace —
              and everything lands straight with your coordinator. No email chains. No repeating yourself.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-sage-500">
              {['11 planning tools', 'AI assistant included', 'Direct coordinator messages', 'Free with your booking'].map(f => (
                <span key={f} className="flex items-center gap-1.5 bg-white border border-cream-200 rounded-full px-3 py-1.5">
                  <span className="text-sage-500">✓</span> {f}
                </span>
              ))}
            </div>
          </div>

          {/* Right: sign-up form */}
          <div>
            <SignUpForm />
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-cream-300 to-transparent" />
      </div>

      {/* ── Features ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-serif text-3xl sm:text-4xl text-sage-800 mb-3">
            Everything you need. Nothing you don't.
          </h2>
          <p className="text-sage-400 text-sm">Eleven tools, all set up for your wedding the moment you log in.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className={`rounded-2xl p-5 border transition-all hover:shadow-sm ${
                f.highlight
                  ? 'bg-sage-800 border-sage-700 sm:col-span-2 lg:col-span-1'
                  : 'bg-white border-cream-200 hover:border-sage-200'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${f.highlight ? 'bg-white/10 text-white' : 'bg-sage-50 text-sage-600'}`}>
                {f.icon}
              </div>
              <h3 className={`font-semibold text-sm mb-1 ${f.highlight ? 'text-white' : 'text-sage-800'}`}>{f.title}</h3>
              <p className={`text-sm leading-relaxed ${f.highlight ? 'text-sage-300' : 'text-sage-400'}`}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Try Sage ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sage-400 mb-4">Try it now</p>
            <h2 className="font-serif text-3xl sm:text-4xl text-sage-800 mb-4">
              Ask Sage anything.
            </h2>
            <p className="text-sage-500 leading-relaxed mb-6">
              Sage is your AI planning assistant, trained on everything Rixey — venue details, vendor budgets, timeline advice, alcohol quantities, what to bring, what to borrow. Ask a real question right now.
            </p>
            <p className="text-sm text-sage-400">
              Once you create your account, Sage gets smarter — it'll know your vendors, your timeline, and your specific wedding details.
            </p>
          </div>
          <SageDemo />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-sage-800 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-3xl sm:text-4xl text-white text-center mb-16">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12">
            {STEPS.map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-11 h-11 rounded-full border border-white/20 text-white font-serif text-xl flex items-center justify-center mx-auto mb-5">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sage-300 text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quote ── */}
      <section className="bg-rose-100 py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="font-serif text-2xl sm:text-3xl text-sage-800 leading-relaxed mb-5">
            "We wanted couples to feel looked after from the moment they book — not just on the day itself."
          </p>
          <p className="text-sm text-sage-500 tracking-wide">— The Rixey Manor Team</p>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="py-20 px-6 text-center">
        <h2 className="font-serif text-3xl sm:text-4xl text-sage-800 mb-3">Ready to start planning?</h2>
        <p className="text-sage-400 text-sm mb-8">Your portal is waiting — takes 30 seconds to set up.</p>
        <a
          href="#top"
          onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="inline-flex items-center gap-2 px-7 py-3.5 bg-sage-600 text-white rounded-xl font-medium text-sm hover:bg-sage-700 transition-colors shadow-sm"
        >
          Create your portal <ArrowRight />
        </a>
      </section>

      <footer className="text-center pb-10 text-xs text-cream-400">
        Rixey Manor · Rapidan, VA ·{' '}
        <a href="/staff" className="hover:text-sage-400 transition-colors">Staff login</a>
      </footer>
    </div>
  );
}
