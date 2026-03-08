import { Link } from 'react-router-dom';

// ── Tiny SVG wrapper ───────────────────────────────────────────────
function Ico({ children }) {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

// ── Feature icons ──────────────────────────────────────────────────
const TimelineIcon = () => (
  <Ico>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Ico>
);
const CeremonyIcon = () => (
  <Ico>
    <path d="m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16" />
  </Ico>
);
const TableIcon = () => (
  <Ico>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </Ico>
);
const VendorIcon = () => (
  <Ico>
    <rect width="8" height="4" x="8" y="2" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </Ico>
);
const ShuttleIcon = () => (
  <Ico>
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </Ico>
);
const DecorIcon = () => (
  <Ico>
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
    <path d="M7 7h.01" />
  </Ico>
);
const BedroomIcon = () => (
  <Ico>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </Ico>
);
const RehearsalIcon = () => (
  <Ico>
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M7 2v20" />
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
  </Ico>
);
const DetailsIcon = () => (
  <Ico>
    <line x1="4" x2="4" y1="21" y2="14" />
    <line x1="4" x2="4" y1="6" y2="2" />
    <line x1="12" x2="12" y1="21" y2="12" />
    <line x1="12" x2="12" y1="4" y2="2" />
    <line x1="20" x2="20" y1="21" y2="16" />
    <line x1="20" x2="20" y1="8" y2="2" />
    <line x1="1" x2="7" y1="14" y2="14" />
    <line x1="9" x2="15" y1="4" y2="4" />
    <line x1="17" x2="23" y1="16" y2="16" />
  </Ico>
);
const MessageIcon = () => (
  <Ico>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Ico>
);
const SageIcon = () => (
  <Ico>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4M19 17v4M3 5h4M17 19h4" />
  </Ico>
);

// ── Feature data ───────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <TimelineIcon />,
    title: 'Day-of Timeline',
    description:
      'Build your hour-by-hour schedule together. We calculate golden hour automatically so your sunset photos are perfectly timed.',
  },
  {
    icon: <CeremonyIcon />,
    title: 'Ceremony Order',
    description:
      'Drag your wedding party into place. Pick roles, group who walks together, and sort by tradition with one click.',
  },
  {
    icon: <TableIcon />,
    title: 'Table Layout',
    description:
      'Seat your guests, finalise your linen choices, and plan every table in the room — all in one view.',
  },
  {
    icon: <VendorIcon />,
    title: 'Vendor Checklist',
    description:
      'Log every vendor, upload contracts, and keep confirmations in one place. No more hunting through your inbox.',
  },
  {
    icon: <ShuttleIcon />,
    title: 'Shuttle Schedule',
    description:
      'Plan guest transport runs. Enter your ceremony time and we\'ll suggest pickup times automatically.',
  },
  {
    icon: <DecorIcon />,
    title: 'Decor Inventory',
    description:
      'Track every piece — where it\'s coming from, who\'s bringing it, and where it goes home at the end of the night.',
  },
  {
    icon: <BedroomIcon />,
    title: 'Bedroom Assignments',
    description:
      'Assign overnight guests to each room for Friday and Saturday night. Pets and all.',
  },
  {
    icon: <RehearsalIcon />,
    title: 'Rehearsal Dinner',
    description:
      'Tell us the details for your rehearsal dinner — bar, food, setup, guest count — so we can have everything ready.',
  },
  {
    icon: <DetailsIcon />,
    title: 'Wedding Details',
    description:
      'Ceremony location, arbor style, send-off type, social handles, and everything else that makes your day yours.',
  },
  {
    icon: <MessageIcon />,
    title: 'Direct Messages',
    description:
      'One message thread, straight to your Rixey coordinator. No more wondering if your email landed.',
  },
  {
    icon: <SageIcon />,
    title: 'Sage AI',
    description:
      'Ask anything — your timeline, your contract, what time cocktail hour starts. Your AI assistant knows Rixey inside out.',
    highlight: true,
  },
];

const STEPS = [
  {
    title: 'Log in with your link',
    description:
      'Use the email address you booked with. Your portal is already set up and waiting for you.',
  },
  {
    title: 'Fill in your details',
    description:
      'Go at your own pace. Save as you go, come back whenever. There\'s no right order.',
  },
  {
    title: 'We handle the rest',
    description:
      'Your coordinator sees every update the moment you make it. Nothing gets missed.',
  },
];

// ── Arrow icon ─────────────────────────────────────────────────────
function ArrowRight() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────
export default function Preview() {
  return (
    <div className="min-h-screen bg-cream-50 font-sans text-sage-900">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <img src="/rixey-manor-logo.png" alt="Rixey Manor" className="h-8" />
        <Link
          to="/"
          className="text-sm font-medium text-sage-600 hover:text-sage-700 flex items-center gap-1.5 transition-colors"
        >
          Log in <ArrowRight />
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="text-center px-6 pt-14 pb-20 max-w-3xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest text-sage-400 mb-5">
          Rixey Manor · Planning Portal
        </p>
        <h1 className="font-serif text-5xl sm:text-6xl text-sage-800 leading-[1.1] mb-6">
          Your wedding,<br />planned in one place.
        </h1>
        <p className="text-lg text-sage-500 leading-relaxed mb-10 max-w-xl mx-auto">
          We built this so the two of you can fill in every detail at your own pace —
          and everything lands straight with your coordinator. No email chains. No repeating yourself.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-7 py-3.5 bg-sage-600 text-white rounded-xl font-medium text-sm hover:bg-sage-700 transition-colors shadow-sm"
        >
          Open your portal <ArrowRight />
        </Link>
      </section>

      {/* Thin decorative divider */}
      <div className="max-w-3xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-cream-300 to-transparent" />
      </div>

      {/* ── Features ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-serif text-3xl sm:text-4xl text-sage-800 mb-3">
            Everything you need. Nothing you don't.
          </h2>
          <p className="text-sage-400 text-sm">
            Eleven planning tools, all set up for your wedding the moment you log in.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`rounded-2xl p-5 border transition-all hover:shadow-sm ${
                f.highlight
                  ? 'bg-sage-800 border-sage-700 text-white sm:col-span-2 lg:col-span-1'
                  : 'bg-white border-cream-200 hover:border-sage-200'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mb-3 ${
                  f.highlight ? 'bg-white/10 text-white' : 'bg-sage-50 text-sage-600'
                }`}
              >
                {f.icon}
              </div>
              <h3
                className={`font-semibold text-sm mb-1 ${
                  f.highlight ? 'text-white' : 'text-sage-800'
                }`}
              >
                {f.title}
              </h3>
              <p
                className={`text-sm leading-relaxed ${
                  f.highlight ? 'text-sage-200' : 'text-sage-400'
                }`}
              >
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-sage-800 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-3xl sm:text-4xl text-white text-center mb-16">
            How it works
          </h2>
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
        <h2 className="font-serif text-3xl sm:text-4xl text-sage-800 mb-3">
          Ready to start planning?
        </h2>
        <p className="text-sage-400 text-sm mb-8">
          Your portal is set up and waiting for you.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-7 py-3.5 bg-sage-600 text-white rounded-xl font-medium text-sm hover:bg-sage-700 transition-colors shadow-sm"
        >
          Open your portal <ArrowRight />
        </Link>
      </section>

      <footer className="text-center pb-10 text-xs text-cream-400">
        Rixey Manor · Rapidan, VA
      </footer>
    </div>
  );
}
