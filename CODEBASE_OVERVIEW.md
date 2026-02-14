# Rixey Portal - Codebase Overview

## 1. Purpose & Summary

**Rixey Portal** is a wedding planning platform built for **Rixey Manor**, a wedding venue. It serves two distinct user groups:

### For Couples (Clients)
A personalized dashboard where engaged couples can:
- Chat with "Sage", an AI wedding planning assistant powered by Claude
- Build their wedding day timeline
- Plan table layouts and seating
- Track vendors and upload contracts
- Create inspiration galleries
- Estimate staffing needs
- Access planning resources and book meetings
- Message the venue team directly

### For Venue Staff (Admin)
A management portal where Rixey Manor staff can:
- View all weddings and client profiles
- Monitor client conversations with Sage
- See AI-extracted planning notes from conversations
- Respond to questions Sage couldn't answer confidently
- Manage the knowledge base that powers Sage
- Track API usage and costs
- Sync emails and meeting transcripts
- Send direct messages to clients

---

## 2. Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **Vite** | Build tool and dev server |
| **React Router v6** | Client-side routing |
| **Tailwind CSS** | Utility-first styling |
| **Supabase JS Client** | Database & auth client |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js + Express** | API server |
| **Anthropic SDK** | Claude AI integration |
| **Supabase Admin Client** | Server-side database access |
| **Multer** | File upload handling |
| **Google APIs** | Gmail integration |

### Database & Auth
| Service | Purpose |
|---------|---------|
| **Supabase** | PostgreSQL database + Auth + Storage |

### AI
| Service | Purpose |
|---------|---------|
| **Claude (Anthropic)** | Powers Sage AI assistant |

### External Integrations
| Service | Purpose |
|---------|---------|
| **Calendly** | Meeting scheduling (embedded) |
| **Gmail API** | Email sync for planning notes |
| **Zoom API** | Meeting transcript sync |
| **HoneyBook** | External link to contracts |
| **Google Sheets** | External link to planning spreadsheets |

---

## 3. Architecture

```
rixey-portal/
├── public/                    # Static assets
├── scripts/                   # Database migrations & import scripts
│   ├── add_direct_messages_table.sql
│   ├── add_planning_tools_tables.sql
│   ├── add_uncertain_questions_table.sql
│   ├── add_usage_and_kb_tables.sql
│   ├── create_new_tables.sql
│   └── reset_all_data.sql
├── server/
│   └── index.js              # Express API server (all backend logic)
├── src/
│   ├── components/           # Reusable React components
│   │   ├── AdminInbox.jsx        # Admin message center
│   │   ├── BookingCalendly.jsx   # Calendly embed for scheduling
│   │   ├── ClientInbox.jsx       # Client direct messaging
│   │   ├── CouplePhoto.jsx       # Photo upload widget
│   │   ├── InspoGallery.jsx      # Inspiration image gallery
│   │   ├── KnowledgeBaseAdmin.jsx # KB management UI
│   │   ├── OnboardingChecklist.jsx # New user checklist
│   │   ├── PlanningChecklist.jsx # Wedding task checklist
│   │   ├── ProtectedRoute.jsx    # Auth route wrapper
│   │   ├── StaffingCalculator.jsx # Staff estimation wizard
│   │   ├── TableLayoutPlanner.jsx # Table/seating planner
│   │   ├── TimelineBuilder.jsx   # Wedding day timeline
│   │   ├── UpcomingMeetings.jsx  # Calendly meeting display
│   │   ├── UsageStats.jsx        # API cost tracking
│   │   └── VendorChecklist.jsx   # Vendor tracking
│   ├── context/
│   │   └── AuthContext.jsx   # Authentication state management
│   ├── lib/
│   │   └── supabase.js       # Supabase client initialization
│   ├── pages/                # Route-level components
│   │   ├── Accommodations.jsx    # Guest lodging info
│   │   ├── Admin.jsx             # Admin portal (main)
│   │   ├── Dashboard.jsx         # Client portal (main)
│   │   ├── GmailCallback.jsx     # OAuth callback handler
│   │   ├── Login.jsx             # Auth page (login/signup)
│   │   ├── ResetPassword.jsx     # Password reset
│   │   ├── Vendors.jsx           # Public vendor directory
│   │   └── ZoomCallback.jsx      # Zoom OAuth callback
│   ├── App.jsx               # Root component with routing
│   ├── index.css             # Global styles + Tailwind
│   └── main.jsx              # React entry point
├── .env                      # Environment variables (not in git)
├── .env.example              # Template for env vars
├── package.json              # Dependencies
├── vite.config.js            # Vite configuration
└── tailwind.config.js        # Tailwind configuration (in package.json)
```

### Data Flow
```
User Browser
     ↓
React Frontend (Vite dev server / Vercel in prod)
     ↓
Express API Server (localhost:3001 / Railway in prod)
     ↓
├── Supabase (Database, Auth, Storage)
├── Anthropic API (Claude for Sage)
├── Gmail API (Email sync)
└── Zoom API (Meeting sync)
```

---

## 4. Database Schema

All tables are in Supabase PostgreSQL.

### Core Tables

#### `profiles`
User profiles linked to Supabase Auth.
```sql
- id: UUID (references auth.users)
- email: TEXT
- name: TEXT
- role: TEXT ('admin', 'couple-1', 'couple-2', 'family', 'planner')
- wedding_id: UUID (references weddings)
- phone: TEXT
- created_at: TIMESTAMPTZ
```

#### `weddings`
Central wedding record that links all wedding data.
```sql
- id: UUID PRIMARY KEY
- couple_names: TEXT
- wedding_date: DATE
- event_code: TEXT UNIQUE (6-char code for login)
- honeybook_link: TEXT
- google_sheets_link: TEXT
- archived: BOOLEAN
- escalation_handled_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
```

### Messaging Tables

#### `messages`
Sage AI chat history.
```sql
- id: UUID PRIMARY KEY
- user_id: UUID (references profiles)
- content: TEXT
- sender: TEXT ('user' or 'sage')
- created_at: TIMESTAMPTZ
```

#### `direct_messages`
Human-to-human messages between clients and admin.
```sql
- id: UUID PRIMARY KEY
- wedding_id: UUID (references weddings)
- sender_type: TEXT ('client' or 'admin')
- sender_id: UUID
- content: TEXT
- read: BOOLEAN
- created_at: TIMESTAMPTZ
```

### Planning Data Tables

#### `wedding_timeline`
Wedding day schedule.
```sql
- id: UUID PRIMARY KEY
- wedding_id: UUID UNIQUE (references weddings)
- ceremony_start: TIME
- reception_start: TIME
- reception_end: TIME
- timeline_data: JSONB (events, settings)
- notes: TEXT
- updated_at: TIMESTAMPTZ
```

#### `wedding_tables`
Table layout configuration.
```sql
- id: UUID PRIMARY KEY
- wedding_id: UUID UNIQUE (references weddings)
- guest_count: INT
- table_shape: TEXT
- guests_per_table: INT
- head_table: BOOLEAN
- head_table_size: INT
- sweetheart_table: BOOLEAN
- kids_table: BOOLEAN
- kids_count: INT
- linen_color: TEXT
- napkin_color: TEXT
- extra_tables: JSONB
- updated_at: TIMESTAMPTZ
```

#### `wedding_staffing`
Staffing estimates from calculator.
```sql
- id: UUID PRIMARY KEY
- wedding_id: UUID UNIQUE (references weddings)
- answers: JSONB (all calculator inputs)
- friday_bartenders: INT
- friday_extra_hands: INT
- friday_total: INT
- saturday_bartenders: INT
- saturday_extra_hands: INT
- saturday_total: INT
- total_staff: INT
- total_cost: DECIMAL
- updated_at: TIMESTAMPTZ
```

#### `vendor_checklist`
Vendor tracking.
```sql
- id: UUID PRIMARY KEY
- wedding_id: UUID (references weddings)
- vendor_type: TEXT
- vendor_name: TEXT
- vendor_contact: TEXT
- contract_uploaded: BOOLEAN
- contract_url: TEXT
- contract_date: DATE
- notes: TEXT
- is_booked: BOOLEAN
```

#### `inspo_gallery`
Inspiration images (max 20 per wedding).
```sql
- id: UUID PRIMARY KEY
- wedding_id: UUID (references weddings)
- image_url: TEXT
- caption: TEXT
- display_order: INT
- uploaded_by: UUID
```

#### `couple_photos`
Main couple photo.
```sql
- id: UUID PRIMARY KEY
- wedding_id: UUID UNIQUE (references weddings)
- image_url: TEXT
- uploaded_by: UUID
```

#### `planning_checklist`
Task checklist items.
```sql
- id: UUID PRIMARY KEY
- wedding_id: UUID (references weddings)
- task_text: TEXT
- is_completed: BOOLEAN
- completed_at: TIMESTAMPTZ
- completed_by: UUID
- completed_via: TEXT ('manual' or 'sage')
- category: TEXT
- due_date: DATE
- is_custom: BOOLEAN
```

### AI & Knowledge Tables

#### `planning_notes`
AI-extracted notes from conversations/emails.
```sql
- id: UUID PRIMARY KEY
- wedding_id: UUID (references weddings)
- category: TEXT (vendor, guest_count, decor, etc.)
- content: TEXT
- source: TEXT (sage, email, zoom, contract)
- status: TEXT (pending, confirmed, outdated)
- created_at: TIMESTAMPTZ
```

#### `knowledge_base`
Information that powers Sage responses.
```sql
- id: UUID PRIMARY KEY
- category: TEXT
- subcategory: TEXT
- question: TEXT
- answer: TEXT
- keywords: TEXT[]
- source: TEXT
- last_updated: TIMESTAMPTZ
```

#### `uncertain_questions`
Questions Sage wasn't confident about.
```sql
- id: UUID PRIMARY KEY
- wedding_id: UUID (references weddings)
- question: TEXT
- sage_response: TEXT
- confidence_level: INT
- admin_answer: TEXT
- answered_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
```

### Admin Tables

#### `admin_notifications`
System notifications for admin.
```sql
- id: UUID PRIMARY KEY
- type: TEXT
- message: TEXT
- wedding_id: UUID
- read: BOOLEAN
- created_at: TIMESTAMPTZ
```

#### `api_usage`
Token usage tracking per conversation.
```sql
- id: UUID PRIMARY KEY
- wedding_id: UUID
- user_id: UUID
- model: TEXT
- input_tokens: INT
- output_tokens: INT
- cost: DECIMAL
- created_at: TIMESTAMPTZ
```

### Storage Buckets (Supabase Storage)
- `couple-photos` - Couple profile photos
- `inspo-gallery` - Inspiration images
- `vendor-contracts` - Uploaded contracts

---

## 5. Authentication & Authorization

### Auth Provider
Supabase Auth with email/password.

### Login Flow
1. User enters **email** + **event code** (6-character wedding code)
2. System verifies event code exists in `weddings` table
3. If new user: Creates account and links to wedding
4. If existing: Logs in and loads their wedding data

### Role System
| Role | Access |
|------|--------|
| `admin` | Full access to Admin portal (`/admin`) |
| `couple-1` | Primary couple member - Dashboard access |
| `couple-2` | Secondary couple member - Dashboard access |
| `family` | Limited dashboard access |
| `planner` | Wedding planner - Dashboard access |

### Route Protection
- `ProtectedRoute.jsx` wraps protected pages
- Checks `AuthContext` for logged-in user
- Redirects to `/login` if not authenticated
- Admin routes check for `role === 'admin'`

### Auth Context (`src/context/AuthContext.jsx`)
Provides:
- `user` - Current Supabase auth user
- `profile` - User's profile with role and wedding_id
- `wedding` - Full wedding record
- `signIn()`, `signUp()`, `signOut()` functions
- `loading` state for auth initialization

---

## 6. Key Features

### Client Dashboard (`/dashboard`)

| Feature | Component | Description |
|---------|-----------|-------------|
| **Sage AI Chat** | Inline in Dashboard | Chat with AI wedding assistant |
| **Timeline Builder** | `TimelineBuilder.jsx` | Build wedding day schedule |
| **Table Planner** | `TableLayoutPlanner.jsx` | Plan seating and table layout |
| **Staffing Calculator** | `StaffingCalculator.jsx` | Estimate bartenders and extra hands |
| **Vendor Checklist** | `VendorChecklist.jsx` | Track vendors and contracts |
| **Inspiration Gallery** | `InspoGallery.jsx` | Upload up to 20 inspo images |
| **Planning Checklist** | `PlanningChecklist.jsx` | Track planning tasks |
| **Direct Messages** | `ClientInbox.jsx` | Message venue staff |
| **Book Meetings** | `BookingCalendly.jsx` | Schedule calls via Calendly |
| **Couple Photo** | `CouplePhoto.jsx` | Upload profile photo |

### Admin Portal (`/admin`)

| Feature | Component/Section | Description |
|---------|-------------------|-------------|
| **Wedding List** | Main view | See all weddings with activity status |
| **Wedding Profiles** | Click into wedding | Full view of couple's planning data |
| **Sage Needs Help** | Modal | Answer questions Sage was uncertain about |
| **Messages Tab** | `AdminInbox.jsx` | View/respond to all client messages |
| **Meetings Tab** | `UpcomingMeetings.jsx` | See scheduled Calendly meetings |
| **Knowledge Base** | `KnowledgeBaseAdmin.jsx` | Manage Sage's knowledge |
| **Usage & Costs** | `UsageStats.jsx` | Track API token usage |
| **Email Sync** | Gmail integration | Pull planning info from emails |
| **Zoom Sync** | Zoom integration | Pull notes from meeting transcripts |

### Sage AI Assistant

Sage is the AI chat assistant powered by Claude. Key behaviors:
- Answers wedding planning questions using knowledge base
- Extracts planning details (vendors, guest count, etc.) from conversations
- Saves extracted info as `planning_notes`
- Flags uncertain answers for admin review
- Maintains friendly, professional "Sage" personality
- Has context about Rixey Manor policies and procedures

---

## 7. API Routes

All routes are in `server/index.js` and served from `http://localhost:3001` (dev) or your Railway URL (prod).

### Chat & AI
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/chat` | Send message to Sage, get AI response |
| POST | `/api/notes-highlights` | Generate summary of planning notes |

### Messages (Direct)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/messages/:weddingId` | Get direct messages for wedding |
| POST | `/api/messages` | Send direct message |
| PUT | `/api/messages/read/:weddingId` | Mark messages as read |

### Planning Notes
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/planning-notes/:weddingId` | Get AI-extracted notes |

### Timeline
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/timeline/:weddingId` | Get wedding timeline |
| POST | `/api/timeline` | Save/update timeline |

### Tables
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/tables/:weddingId` | Get table setup |
| POST | `/api/tables` | Save/update table setup |

### Staffing
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/staffing/:weddingId` | Get staffing estimate |
| POST | `/api/staffing` | Save staffing estimate |

### Vendors
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/vendors/:weddingId` | Get vendor list |
| POST | `/api/vendors` | Add/update vendor |
| DELETE | `/api/vendors/:id` | Delete vendor |

### Inspiration Gallery
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/inspo/:weddingId` | Get gallery images |
| POST | `/api/inspo` | Upload image |
| DELETE | `/api/inspo/:id` | Delete image |

### Couple Photo
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/couple-photo/:weddingId` | Get couple photo |
| POST | `/api/couple-photo` | Upload/replace photo |
| DELETE | `/api/couple-photo/:weddingId` | Delete photo |

### Planning Checklist
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/checklist/:weddingId` | Get checklist items |
| POST | `/api/checklist` | Add task |
| PUT | `/api/checklist/:id` | Update task |
| POST | `/api/checklist/initialize/:weddingId` | Create default tasks |

### Knowledge Base
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/knowledge-base` | Get all KB entries |
| POST | `/api/knowledge-base` | Add KB entry |
| PUT | `/api/knowledge-base/:id` | Update KB entry |
| DELETE | `/api/knowledge-base/:id` | Delete KB entry |

### Uncertain Questions
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/uncertain-questions` | Get unanswered questions |
| POST | `/api/uncertain-questions/:id/answer` | Submit admin answer |
| DELETE | `/api/uncertain-questions/:id` | Delete question |

### Usage Tracking
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/usage` | Get usage stats (optional weddingId filter) |
| GET | `/api/usage/summary` | Get aggregated usage summary |

### Gmail Integration
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/gmail/status` | Check if Gmail connected |
| GET | `/api/gmail/auth` | Get OAuth URL |
| GET | `/api/gmail/callback` | OAuth callback handler |
| POST | `/api/gmail/sync` | Sync emails for planning notes |
| POST | `/api/gmail/disconnect` | Disconnect Gmail |

### Zoom Integration
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/zoom/status` | Check if Zoom connected |
| GET | `/api/zoom/auth` | Get OAuth URL |
| GET | `/api/zoom/callback` | OAuth callback handler |
| POST | `/api/zoom/sync` | Sync meeting transcripts |
| POST | `/api/zoom/disconnect` | Disconnect Zoom |

### Contract Processing
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/extract-contract` | Upload contract, extract notes via AI |
| POST | `/api/ask-contracts` | Ask questions about uploaded contracts |

---

## 8. UI Components & User Flows

### Login Flow
```
/login
  ├── Enter email + event code
  ├── New user? → Create account → Link to wedding
  └── Existing? → Login → Redirect based on role
        ├── Admin → /admin
        └── Client → /dashboard
```

### Client Dashboard Layout
```
┌─────────────────────────────────────────────────────┐
│ Header: Logo, Couple Names, Days Until, Logout      │
├─────────────────────┬───────────────────────────────┤
│                     │                               │
│  Left Column:       │  Right Column:                │
│  - Hero (countdown) │  - Planning at a Glance       │
│  - Sage Chat        │    (Timeline, Tables,         │
│  - Resource Links   │     Vendors, Checklist,       │
│                     │     Staffing, Inspiration)    │
│                     │  - Direct Messages            │
│                     │  - Book a Meeting             │
│                     │  - External Tools             │
│                     │                               │
└─────────────────────┴───────────────────────────────┘
```

### Admin Portal Layout
```
┌─────────────────────────────────────────────────────┐
│ Header: Logo, Tabs (Weddings|Messages|Meetings|     │
│                      Knowledge Base|Usage)          │
├─────────────────────────────────────────────────────┤
│ Stats Row: Active | This Week | Upcoming | Alerts   │
├─────────────────────────────────────────────────────┤
│ Needs Attention: Uncertain Questions | Escalations  │
├───────────────────────────────┬─────────────────────┤
│                               │                     │
│  Weddings List (3/4):         │  Sidebar (1/4):     │
│  - Wedding cards with         │  - Email Sync       │
│    photo, activity status,    │  - Phone/SMS Sync   │
│    quick actions              │  - Zoom Sync        │
│                               │  - Sage Needs Help  │
│                               │  - Quick Links      │
│                               │                     │
└───────────────────────────────┴─────────────────────┘
```

### Wedding Profile View (Admin)
```
┌─────────────────────────────────────────────────────┐
│ Header: Couple Photo, Names, Date, Back Button      │
├───────────────┬─────────────────────────────────────┤
│ Left (1/3):   │ Right (2/3):                        │
│ - Stats       │ - Tabs: Notes | Messages | Timeline │
│ - Members     │         Tables | Vendors | Inspo    │
│ - Links       │         Checklist                   │
│ - Timeline    │                                     │
│   Summary     │ - Tab content area                  │
│ - Table       │                                     │
│   Summary     │                                     │
│ - Staffing    │                                     │
│   Summary     │                                     │
└───────────────┴─────────────────────────────────────┘
```

---

## 9. Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic (Claude AI)
ANTHROPIC_API_KEY=sk-ant-...

# Gmail Integration (optional)
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=http://localhost:5173/gmail-callback

# Zoom Integration (optional)
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret
ZOOM_REDIRECT_URI=http://localhost:5173/zoom-callback

# Server
PORT=3001

# Frontend (for production)
VITE_API_URL=http://localhost:3001
```

### Variable Prefixes
- `VITE_` prefix = Exposed to frontend (bundled into client code)
- No prefix = Server-only (kept secret)

---

## 10. How to Run

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account with project set up
- Anthropic API key

### Initial Setup

1. **Clone and install:**
```bash
git clone <your-repo-url>
cd rixey-portal
npm install
```

2. **Set up environment:**
```bash
cp .env.example .env
# Edit .env with your actual keys
```

3. **Set up database:**
   - Go to Supabase Dashboard → SQL Editor
   - Run each file in `scripts/` folder in order:
     1. `create_new_tables.sql`
     2. `add_direct_messages_table.sql`
     3. `add_planning_tools_tables.sql`
     4. `add_uncertain_questions_table.sql`
     5. `add_usage_and_kb_tables.sql`
   - Also run the staffing table SQL (see server/index.js comments)

4. **Set up Supabase Storage buckets:**
   - Create buckets: `couple-photos`, `inspo-gallery`, `vendor-contracts`
   - Set appropriate policies (private, authenticated access)

### Running Development

**Terminal 1 - Backend:**
```bash
npm run server
# Runs Express on http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
npm run dev
# Runs Vite on http://localhost:5173
```

### Building for Production

```bash
npm run build
# Creates optimized build in /dist
```

### Project Scripts (package.json)
```json
{
  "dev": "vite",                    // Frontend dev server
  "build": "vite build",            // Production build
  "preview": "vite preview",        // Preview production build
  "server": "node server/index.js"  // Backend server
}
```

---

## Quick Reference

### Key Files to Know
| File | Purpose |
|------|---------|
| `server/index.js` | All backend logic, API routes, AI integration |
| `src/pages/Dashboard.jsx` | Main client portal |
| `src/pages/Admin.jsx` | Main admin portal |
| `src/context/AuthContext.jsx` | Authentication state |
| `src/components/TimelineBuilder.jsx` | Complex timeline tool |
| `src/components/TableLayoutPlanner.jsx` | Complex table planning tool |
| `src/components/StaffingCalculator.jsx` | Multi-step staffing wizard |

### Color Palette (Tailwind)
- `sage-*` - Primary green tones (headers, buttons)
- `cream-*` - Secondary warm neutrals (backgrounds, borders)
- `amber-*` - Warning/attention states
- `red-*` - Errors/escalations

### Design Patterns
- Modals for detailed tools (Timeline, Tables, etc.)
- Cards with rounded corners and subtle shadows
- Collapsible sections for secondary content
- Inline editing where possible
- Real-time saves (no explicit save buttons where feasible)

---

*Last updated: February 2025*
*Built with Claude Code (Opus 4.5)*
