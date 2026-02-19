# Rixey Portal - Complete System Documentation

*Last Updated: February 2026*
*For rebuild/backup purposes*

---

## WHAT IS RIXEY PORTAL?

Rixey Portal is a custom wedding planning assistant and client management system built specifically for Rixey Manor, a wedding venue. It serves two main audiences:

1. **Clients (Couples & Family Members)** - Access a personalized dashboard with an AI wedding planning assistant named "Sage," plus tools to track vendors, upload inspiration photos, manage checklists, and store contracts.

2. **Rixey Staff (Admins)** - Access a comprehensive dashboard to view all weddings, see AI conversation histories, review planning notes extracted from client communications, manage the knowledge base Sage uses, and sync communications from Zoom, email, and text messages.

---

## THE PURPOSE

The portal exists to:

- **Reduce repetitive questions** - Sage answers common wedding planning questions 24/7, trained on Rixey Manor's specific policies, spaces, and recommendations
- **Centralize wedding information** - All vendor contacts, contracts, planning notes, and preferences in one place per wedding
- **Extract insights automatically** - When clients chat with Sage, mention vendors, share preferences, or upload contracts, the system extracts and stores this information for easy reference
- **Sync communications** - Pull in Zoom meeting transcripts, text messages (via Quo/OpenPhone), and emails to capture planning details discussed outside the portal
- **Track costs** - Monitor AI API usage and costs per wedding

---

## USER TYPES & ACCESS

### Clients
- **Couples** (Bride, Groom, or custom term) - Full planning access, can upload contracts, manage vendors
- **Family Members** (Mother/Father of Bride/Groom) - Access to chat with Sage and view wedding info
- **Wedding Party** (Best Man, Maid of Honor) - Limited access
- **VIP Guests** - View-only access

Each client creates an account with an **event code** (provided by Rixey) that links them to their wedding.

### Admins
- Staff members with @rixeymanor.com email addresses
- Access to all weddings, all data, full management capabilities
- Can answer escalated questions, manage knowledge base, sync communications

---

## KEY FEATURES

### For Clients (Dashboard)

1. **Sage AI Chat**
   - 24/7 AI assistant trained on Rixey Manor knowledge
   - Answers questions about venue, planning, timelines, vendors
   - Shares relevant links from the Rixey website
   - Extracts planning notes from conversations (vendor mentions, dates, preferences)
   - Can analyze uploaded contracts and answer questions about them

2. **Vendor Checklist**
   - Track all wedding vendors (photographer, caterer, florist, etc.)
   - Store vendor contact information
   - Upload vendor contracts (PDF or image)
   - Mark vendors as booked
   - System extracts key details from contracts automatically

3. **Inspiration Gallery**
   - Upload up to 20 inspiration images
   - Add captions describing style preferences
   - Helps Sage understand couple's aesthetic

4. **Couple Photo**
   - Upload a photo of themselves
   - Displayed in admin view for easy identification

5. **Planning Checklist**
   - Pre-populated with common wedding tasks by category
   - Can add custom tasks
   - Sage can mark tasks complete when couple mentions finishing something

6. **Resource Links**
   - Quick access to Rixey planning resources
   - Calendly booking links for meetings
   - HoneyBook and Google Sheets links (set by admin)

7. **Onboarding Checklist**
   - Guides new clients through initial setup
   - Tracks: photo upload, first message, vendor added, etc.

### For Admins (Admin Dashboard)

1. **Wedding Overview**
   - List of all weddings with dates, couple names
   - Quick stats: days until wedding, planning progress
   - Search and filter capabilities

2. **Wedding Profile View**
   - Complete view of any wedding's data
   - Planning notes extracted from all sources
   - Sage conversation history
   - Uploaded contracts with extracted text
   - Vendor list with contract status
   - Inspiration gallery
   - Usage/cost tracking

3. **Communication Sync**
   - **Zoom Integration**: Connect Zoom account, sync meeting transcripts, auto-match to weddings by couple names
   - **Quo/OpenPhone Integration**: Sync text messages from registered client phone numbers
   - **Gmail Integration**: Sync emails (coming feature)
   - All synced communications are analyzed for planning notes

4. **Knowledge Base Management**
   - Add/edit/delete knowledge entries Sage uses
   - Organized by category (venue, catering, timeline, etc.)
   - Used to train Sage's responses

5. **Escalation Inbox**
   - Questions Sage couldn't answer confidently
   - Admin can provide answers that get added to knowledge base
   - Helps Sage learn over time

6. **Uncertain Questions**
   - View questions where Sage had low confidence
   - Add answers to improve future responses

7. **API Usage & Costs**
   - Track token usage per wedding
   - Monitor costs by endpoint (chat, contract extraction, etc.)
   - See which weddings use the most AI resources

8. **Admin Notifications**
   - Alerts for new wedding signups
   - Escalated questions needing attention

---

## HOW SAGE WORKS

Sage is an AI assistant powered by Claude (Anthropic's AI). Here's how it processes conversations:

1. **Receives client message**
2. **Gathers context**:
   - Wedding details (date, venue choices, guest count)
   - Recent planning notes for this wedding
   - Vendor information
   - Uploaded contracts (if question is contract-related)
   - Inspiration gallery captions
   - Knowledge base entries matching the question
3. **Generates response** using Claude API with Rixey-specific system prompt
4. **Extracts planning notes** from the conversation (vendor mentions, dates, preferences, decisions)
5. **Saves conversation** for admin review
6. **Logs usage** for cost tracking

### Sage's Personality
- Warm but professional, like a knowledgeable friend
- Direct answers first, then context
- Shares relevant links proactively
- Honest when unsure - directs to human staff
- Never gives legal/tax advice
- Trained on Rixey Manor's specific policies and recommendations

### Planning Note Extraction
When clients mention things like:
- "We booked John Smith Photography" → Extracts vendor info
- "We're expecting 150 guests" → Extracts guest count
- "We want a fall color palette" → Extracts decor preference
- "Ceremony will be on the lawn" → Extracts ceremony location

These notes appear in the admin dashboard automatically.

---

## DATA STORAGE (Supabase)

All data is stored in Supabase (PostgreSQL database + file storage). Here's what's stored:

### Core Tables

**weddings**
- id, event_code, couple_names, wedding_date
- honeybook_link, google_sheet_link
- Links to all other wedding data

**profiles**
- User accounts linked to weddings
- id, email, name, role, phone, wedding_id
- Role determines access level (couple vs family vs VIP)

**messages** (Sage conversations)
- id, wedding_id, user_id
- content (the message text)
- role (user or assistant)
- timestamp

**planning_notes**
- Automatically extracted insights
- category (vendor, guest_count, decor, ceremony, etc.)
- content (the extracted information)
- source_message (where it came from)
- status (pending, confirmed, archived)

**contracts**
- Uploaded vendor contracts
- filename, file_url
- extracted_text (full text extracted by AI)
- summary (AI-generated summary)
- key_details (JSON of important terms)

**vendor_checklist**
- vendor_type, vendor_name, vendor_contact
- is_booked, contract_uploaded, contract_url
- notes

**inspo_gallery**
- image_url, caption
- display_order
- Max 20 per wedding

**couple_photos**
- Single photo per wedding
- image_url

**planning_checklist**
- task_text, category
- is_completed, completed_at, completed_by
- completed_via (manual or sage)
- is_custom (user-added vs default tasks)

### Knowledge & AI Tables

**knowledge_base**
- title, category, subcategory
- content (the knowledge text)
- active (on/off toggle)
- Used to train Sage's responses

**uncertain_questions**
- Questions where Sage had low confidence
- question, attempted_answer, confidence_score
- admin_answer (when staff provides answer)
- added_to_kb (if answer was added to knowledge base)

**usage_logs**
- API cost tracking per request
- endpoint, input_tokens, output_tokens, model
- wedding_id for per-wedding cost analysis

### Communication Sync Tables

**processed_zoom_meetings**
- Tracks which Zoom meetings have been synced
- zoom_meeting_id, wedding_id, meeting_topic
- transcript, notes_extracted

**processed_quo_messages**
- Tracks synced text messages
- quo_message_id, wedding_id, phone_number
- direction (inbound/outbound), body_text

**processed_emails**
- Tracks synced Gmail messages
- email_id, wedding_id, subject
- body_text, notes_extracted

### OAuth & Integration Tables

**zoom_tokens**
- Zoom OAuth credentials
- access_token, refresh_token, expiry_date

**gmail_tokens**
- Gmail OAuth credentials
- access_token, refresh_token, expiry_date

**admin_notifications**
- type, message, wedding_id
- read (boolean)

**onboarding_progress**
- Tracks client onboarding completion
- couple_photo_uploaded, first_message_sent, etc.

### File Storage (Supabase Storage Buckets)

**vendor-contracts**
- PDF and image uploads of vendor contracts
- Private, 10MB limit

**inspo-gallery**
- Inspiration images
- Private, 5MB limit

**couple-photos**
- Couple profile photos
- Private, 5MB limit

---

## EXTERNAL INTEGRATIONS

### Claude AI (Anthropic)
- Powers Sage chat assistant
- Used for contract text extraction
- Used for planning note extraction
- Model: claude-sonnet-4-20250514
- Requires: ANTHROPIC_API_KEY

### Supabase
- PostgreSQL database
- File storage
- User authentication
- Requires: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

### Zoom
- OAuth integration for meeting sync
- Pulls meeting recordings and transcripts
- Matches to weddings by topic/attendee names
- Requires: ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET

### Quo (formerly OpenPhone)
- Text message sync
- Matches messages by phone number to client profiles
- Extracts planning notes from SMS conversations
- Requires: QUO_API_KEY

### Gmail (Google)
- Email sync capability
- Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

### Calendly
- Links shared in Sage responses for booking meetings
- No direct API integration (just links)

### HoneyBook
- External CRM used by Rixey
- Links stored per wedding, displayed in dashboard
- No direct API integration

---

## TECHNICAL ARCHITECTURE

### Frontend (React + Vite)
- **Framework**: React with Vite bundler
- **Styling**: Tailwind CSS with custom sage/cream color palette
- **Routing**: React Router
- **State**: React Context for auth
- **Hosting**: Vercel

Key Pages:
- `/` - Login (client)
- `/dashboard` - Client dashboard
- `/staff` - Admin login
- `/admin` - Admin dashboard
- `/reset-password` - Password reset
- `/admin/zoom-callback` - Zoom OAuth callback
- `/admin/gmail-callback` - Gmail OAuth callback

### Backend (Node.js + Express)
- **Runtime**: Node.js
- **Framework**: Express
- **File Uploads**: Multer (in-memory storage)
- **Hosting**: Railway

Key Endpoints:
- `POST /api/chat` - Sage conversation
- `POST /api/chat-with-file` - Chat with file upload
- `POST /api/extract-contract` - Contract upload & extraction
- `GET/POST/PUT/DELETE /api/knowledge-base` - KB management
- `POST /api/zoom/sync` - Sync Zoom meetings
- `POST /api/quo/sync` - Sync text messages
- `GET /api/admin/weddings` - List all weddings
- `GET /api/usage/stats` - Usage statistics

### Authentication
- Supabase Auth handles user accounts
- Admin detection: email ends with @rixeymanor.com
- Row Level Security (RLS) on database tables
- Server uses service role key to bypass RLS for admin operations

---

## ENVIRONMENT VARIABLES

Required for deployment:

```
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Claude AI
ANTHROPIC_API_KEY=sk-ant-...

# Zoom Integration
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...

# Quo/OpenPhone Integration
QUO_API_KEY=...

# Google/Gmail Integration
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# URLs
FRONTEND_URL=https://your-frontend.vercel.app
CORS_ORIGINS=https://your-frontend.vercel.app

# Server
PORT=3001
```

---

## DEPLOYMENT

### Frontend (Vercel)
1. Connect GitHub repo to Vercel
2. Set root directory to project root
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variables

### Backend (Railway)
1. Connect GitHub repo to Railway
2. Set root directory to `server/`
3. Start command: `npm start`
4. Add environment variables

### Database (Supabase)
1. Create new Supabase project
2. Run SQL scripts in order:
   - Core tables (weddings, profiles, messages)
   - add_usage_and_kb_tables.sql
   - add_planning_tools_tables.sql
   - create_new_tables.sql
   - add_uncertain_questions_table.sql
   - add_direct_messages_table.sql
3. Create storage buckets:
   - vendor-contracts (private, 10MB)
   - inspo-gallery (private, 5MB)
   - couple-photos (private, 5MB)

---

## DEFAULT DATA

### Default Planning Checklist Categories
- Venue & Date
- Budget & Priorities
- Guest List
- Vendors
- Attire & Beauty
- Ceremony
- Reception
- Logistics
- Final Details

### Default Vendor Types
- Photographer
- Videographer
- Caterer
- Florist
- DJ
- Band
- Officiant
- Cake/Dessert
- Hair
- Makeup
- Coordinator
- Rentals
- Transportation

### Knowledge Base Categories
- venue
- catering
- timeline
- vendors
- logistics
- ceremony
- reception
- accommodations
- general

---

## SUPPORT & CONTACT

The app directs users to:
- **Isadora** - Venue owner/coordinator
- **Grace** - Planning support
- **Email**: (via HoneyBook)
- **Phone**: Quo/OpenPhone number for text support

---

## REBUILD CHECKLIST

If starting from scratch:

1. Set up Supabase project
2. Run all SQL migration scripts
3. Create storage buckets
4. Deploy backend to Railway with env vars
5. Deploy frontend to Vercel with env vars
6. Set up Zoom OAuth app (optional)
7. Get Quo API key (optional)
8. Populate knowledge base with Rixey content
9. Create first admin account (@rixeymanor.com email)
10. Test client signup flow with event code

---

*This document contains everything needed to understand and rebuild the Rixey Portal system.*
