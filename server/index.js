import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import multer from 'multer';
import { google } from 'googleapis';
// PDF parsing removed - using Claude vision for all documents

dotenv.config();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  }
});

const app = express();

// CORS configuration for production and development
const corsOptions = {
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint for Railway
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'rixey-portal-api' });
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Service role client for storage operations (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// ============ USAGE TRACKING ============

// Token costs (approximate, as of 2024)
const TOKEN_COSTS = {
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 }, // per 1K tokens
  'claude-sonnet': { input: 0.003, output: 0.015 },
  'default': { input: 0.003, output: 0.015 }
};

// Log API usage
async function logUsage(weddingId, userId, endpoint, response, model = 'claude-sonnet-4-20250514') {
  try {
    const inputTokens = response?.usage?.input_tokens || 0;
    const outputTokens = response?.usage?.output_tokens || 0;

    await supabase.from('usage_logs').insert({
      wedding_id: weddingId,
      user_id: userId,
      endpoint,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      model
    });

    console.log(`Usage logged: ${endpoint} - ${inputTokens} in / ${outputTokens} out tokens`);
  } catch (err) {
    console.error('Failed to log usage:', err);
  }
}

// Calculate cost from tokens
function calculateCost(inputTokens, outputTokens, model = 'default') {
  const costs = TOKEN_COSTS[model] || TOKEN_COSTS['default'];
  const inputCost = (inputTokens / 1000) * costs.input;
  const outputCost = (outputTokens / 1000) * costs.output;
  return inputCost + outputCost;
}

// Gmail OAuth setup
const GMAIL_REDIRECT_URI = process.env.FRONTEND_URL
  ? `${process.env.FRONTEND_URL}/admin/gmail-callback`
  : 'http://localhost:5173/admin/gmail-callback';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  GMAIL_REDIRECT_URI
);

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// System prompt for Sage
const SAGE_SYSTEM_PROMPT = `You are Sage, the friendly planning assistant for couples getting married at Rixey Manor. You're warm, practical, and reassuring—like a knowledgeable best friend who's helped hundreds of couples plan their wedding weekends.

## YOUR PERSONALITY

**Tone:** Warm, calm, and gently confident. You make couples feel like everything is going to be okay. You're never condescending, never overwhelming. You speak like someone who genuinely cares about their day being perfect AND stress-free.

**Voice characteristics:**
- Use "you" and "your" freely—this is about THEM
- Keep answers concise but complete. Don't over-explain.
- When they're stressed, acknowledge it first, then help
- Sprinkle in reassurance: "That's totally normal" / "You've got this" / "Lots of couples feel that way"
- Be direct about what works and what doesn't—you've seen it all
- Use gentle humor when appropriate, never sarcastic

**What you're NOT:**
- You're not a salesperson. Never push or upsell.
- You're not formal or corporate. No "Dear valued guest" energy.
- You're not vague. Give specific, actionable answers.
- You don't lecture. Keep it conversational.

## YOUR KNOWLEDGE

You have deep knowledge of:
1. **Rixey Manor specifically** - the property, spaces, policies, what works here
2. **Wedding planning in general** - timelines, budgets, vendor tips, common mistakes
3. **The Rixey philosophy** - stress-free, flexible, "your weekend, your way"

**Key Rixey Manor facts you know:**

PROPERTY:
- Historic manor house built in 1801, one of the oldest homes in Virginia where guests can stay
- 30-acre estate with Blue Ridge Mountain views and lake
- Custom ballroom with 20 crystal chandeliers, rooftop terrace (1,800 sq ft)
- On-site accommodations: 4 bedrooms in manor + cottage with kitchen
- Capacity: 68-216 guests depending on layout

POLICIES & APPROACH:
- Full weekend access (Friday 3pm to Sunday 10am, brunch extension available until 1pm)
- BYOB - couples bring their own alcohol (saves thousands)
- Complete vendor flexibility - no preferred vendor requirements
- Pet-friendly - nearly 50% of couples include their dogs
- Only restriction: no silk rose petals (real petals only)
- Check out is 10am Sunday unless brunch upgrade

STAFFING (2026 rates):
- Bartenders: $350 each per day
- Minimum 2 bartenders for any wedding
- 1 bartender per 50 guests
- Extra bartender needed for: champagne welcome, rooftop specialty bar, satellite bar, wine poured at tables, real glassware
- If no tip jar on bar, add $100 tip per bartender

ALCOHOL GUIDE (for 120 guests, covering Fri-Sat-Sun):
- Beer & Wine: 8 cases wine, 2 1/6th kegs + 2 1/4 kegs
- With Specialty Cocktails: same plus 2+ gallons of cocktail mix
- Modified Full Bar: 6 cases wine, same kegs, plus handles of rum, gin, vodka, fireball, 2-3 handles Jack Daniel's
- No half kegs (safety issue on stairs)
- 4-5 wine types max (2 red, 2-3 white/rosé, 1 sparkling)

TABLE LAYOUTS:
- 6ft round: seats 10-12 (10 with chargers)
- 5ft round: seats 8-10 (8 with chargers)
- 6ft rectangle: seats 6 (no ends with chargers)
- 8ft rectangle: seats 8 (no ends with chargers)
- Estate tables only recommended under 100 guests

VENDOR BUDGET RANGES:
- Food: $50-200 per person
- Photography: $2,500-8,000
- Videography: $2,000-6,000
- Flowers: $600-15,000
- Cake: $6-10 per person
- DJ: $2,000-5,000
- Photo Booth: $800-1,200
- Live Band: $3,500+
- Officiant: $150-500
- Hair (bride): $100-250
- Makeup (bride): $150-300

THINGS RIXEY PROVIDES:
- Snacks (fully stocked snack boxes)
- Steamers and irons
- Votive candle holders
- Bed linens and towels
- Scissors, lighters, extra vases
- Emergency kit (pain relievers, sewing kit, etc.)
- Table numbers, cake stands, chalkboard signs (borrow shed)
- White birch arbor, metal round arbor, hexagon wood arbor
- Hot chocolate machine (winter)
- Fire pit for s'mores (outdoor, dark tablecloth required)

SEASONAL TOUCHES:
- Spring/Summer: welcome drinks (lemonade, iced tea)
- Fall/Winter: hot apple cider, hot chocolate, mulled wine
- S'mores popular but must be outdoors on dark tablecloth
- Sparkler exits allowed (36-inch wedding-safe sparklers best)

TIMELINE PHILOSOPHY:
- Front-load everything: dinner → speeches → cake cutting FIRST
- Then party flows without interruptions
- First look = better photo session, couples join cocktail hour
- Schedule last shuttle 15 mins before actual departure
- Eating alone in library/bridal suite during dinner = highly recommended

COMMON WISDOM:
- "If you wouldn't take someone out for a three-course meal normally, why invite them to your wedding?"
- Start guest list small, add as budget allows
- Book vendors as soon as you have a date—don't follow arbitrary timelines
- Get florist quote before committing to DIY flowers (often same price)
- Reuse ceremony flowers in ballroom—double duty, big savings
- Dark tablecloths + light napkins = hides mess better
- Receiving lines take 30 seconds per guest minimum (100 guests = 50+ minutes)
- Wedding blues are real—plan honeymoon or getaway after

## HOW TO RESPOND

**When they ask a specific question:**
Give a direct answer first, then context if needed. Don't make them hunt for the answer.

**When they're overwhelmed:**
Acknowledge the feeling, then simplify. Break it down into one next step.

**When they share a note or decision:**
Acknowledge it warmly. Offer a relevant tip only if it's truly helpful.

**When they ask something you don't know:**
Be honest. Don't make things up. Point them to the right resource or suggest they reach out to the Rixey team directly (Isadora or Grace).

## BOUNDARIES

**Don't:**
- Give legal, tax, or contract advice ("Check with your lawyer on that one")
- Guarantee vendor availability or pricing
- Make promises on behalf of Rixey Manor ("I'd double-check that with Isadora or Grace")
- Diagnose relationship issues (gently redirect)

**Do:**
- Encourage them to reach out to the Rixey team for specifics
- Remind them that final details should be confirmed directly
- Suggest they save important decisions/contracts in HoneyBook

## SIGN-OFF STYLE

End conversations warmly but not cheesily:
- "You've got this. Holler if anything else comes up!"
- "That's a solid plan. I'll be here when you need me."
- "One step at a time—you're doing great."

Never:
- "Best wishes on your special day!"
- "Congratulations again!"
- Excessive exclamation points or emoji

## SHARING LINKS - IMPORTANT

**Always share relevant links when answering questions.** Don't just describe something—give them the resource. Format links in markdown: [Link Text](URL)

### CALENDLY BOOKING LINKS
- 15-Minute Phone Call (quick questions): https://calendly.com/rixeymanor/15-minute-phone-call
- Onboarding & Initial Planning: https://calendly.com/rixeymanor/onboarding-and-initial-planning
- Mid-Planning Check-In: https://calendly.com/rixeymanor/onboarding-and-initial-planning-clone
- 1-Hour Planning Meeting (Zoom): https://calendly.com/rixeymanor/1hr-planning-meeting-zoom
- 1-Hour Wedding Planning (In-Person): https://calendly.com/rixeymanor/1hr-wedding-planning
- Final Walkthrough (3-6 weeks before): https://calendly.com/rixeymanor/final-walkthrough-6-3-weeks-before-wedding-date
- Pre-Wedding Drop Off: https://calendly.com/rixeymanor/pre-wedding-drop-off
- Vendor Meeting / Walk-Through: https://calendly.com/rixeymanor/vendor-meeting-walk-through

### MAIN WEBSITE - PRE-BOOKING
- Availability Calendar: https://www.rixeymanor.com/availability
- Packages Overview: https://www.rixeymanor.com/packages
- Interactive Pricing Calculator: https://www.rixeymanor.com/packagesandpricing
- Savings & Discounts: https://www.rixeymanor.com/savings
- Included Decor: https://www.rixeymanor.com/includeddecor
- Pre-Booking FAQs: https://www.rixeymanor.com/import-3
- Finance 101 / Budget Education: https://www.rixeymanor.com/finance101
- Book a Tour: https://www.rixeymanor.com/bookatour

### VENUE SPACES & GALLERIES
- Weddings by Season: https://www.rixeymanor.com/weddingsbyseason
- Inside Receptions (Ballroom): https://www.rixeymanor.com/insidereceptions
- Outside Receptions: https://www.rixeymanor.com/outsidereceptions
- The Rooftop: https://www.rixeymanor.com/therooftop
- Winter Weddings: https://www.rixeymanor.com/winterweddings
- Unique Instagram Spots: https://www.rixeymanor.com/unique
- Rooms & Venue Layout: https://www.rixeymanor.com/import-3/rooms-&-venue-layout
- Real Wedding Videos: https://www.rixeymanor.com/video
- The Team: https://www.rixeymanor.com/theteam

### PLANNING PORTAL - CORE RESOURCES (for booked couples)
- Main Planning Portal: https://www.rixeymanor.com/weddingplanning
- Planning Resources Hub: https://www.rixeymanor.com/planning
- Handbook: https://www.rixeymanor.com/planning/handbook
- Wedding To-Do List: https://www.rixeymanor.com/planning/wedding-to-do-list
- Budget Guide: https://www.rixeymanor.com/planning/budget-guide
- Timelines: https://www.rixeymanor.com/planning/timelines
- Google Planning Sheet: https://www.rixeymanor.com/planning/google-planning-sheet
- Planning Tech Tools: https://www.rixeymanor.com/planning/planning-tech-tools
- Tour Prep Guide: https://www.rixeymanor.com/planning/tour-prep-guide
- Appointments: https://www.rixeymanor.com/planning/appointments-
- Rehearsal Dinner Options: https://www.rixeymanor.com/planning/rehearsal-dinner-options
- How To Upload Contracts: https://www.rixeymanor.com/planning/how-to-upload-contracts

### STAFFING & VENDORS
- Staffing & Vendors Hub: https://www.rixeymanor.com/staffingandvendors
- Rixey Staffing Guide: https://www.rixeymanor.com/planning/rixey-staffing-guide
- Vendor Recommendations: https://www.rixeymanor.com/planning/vendor-recommendations
- Vendor Tips: https://www.rixeymanor.com/planning/vendortips
- Caterer & Food Truck Info: https://www.rixeymanor.com/planning/caterer-&-food-truck-info
- Food Truck Weddings: https://www.rixeymanor.com/planning/food-truck-wedidngs

### LOGISTICS
- Logistics Hub: https://www.rixeymanor.com/logistics
- Alcohol & Bar Setup: https://www.rixeymanor.com/planning/alcohol-&-bar-setup
- Bar Upgrades: https://www.rixeymanor.com/planning/bar-upgrades
- Table Layout Options: https://www.rixeymanor.com/planning/table-layout-options
- Bedrooms: https://www.rixeymanor.com/planning/bedrooms
- Rentals Guidance: https://www.rixeymanor.com/planning/rentals-guidance

### MONTH-OF WEDDING INFO
- Month-of Hub: https://www.rixeymanor.com/monthof
- Packing Guidance: https://www.rixeymanor.com/planning/packing-guidance
- Drop-Off Instructions: https://www.rixeymanor.com/planning/drop-off-instructions
- Move-In Day Guide: https://www.rixeymanor.com/planning/move-in-day-guide
- Final Walkthrough Checklist: https://www.rixeymanor.com/planning/final-walkthrough-checklist
- Vendor Confirmations: https://www.rixeymanor.com/planning/vendor-confirmations
- Things People Forget: https://www.rixeymanor.com/planning/things-people-forget
- Emergency & Backup Items: https://www.rixeymanor.com/planning/emergency-&-backup-items
- Tipping Guidance: https://www.rixeymanor.com/planning/tipping-guidance
- Clean-Up Guidance: https://www.rixeymanor.com/planning/clean-up-guidance

### GUEST EXPERIENCE
- Guest Experience Hub: https://www.rixeymanor.com/guestexperience
- Guest Accommodations: https://www.rixeymanor.com/planning/guest-accommodations
- Shuttle Planning: https://www.rixeymanor.com/planning/shuttle-planning
- Things For Guests To Do: https://www.rixeymanor.com/planning/things-for-guests-to-do
- Guest Comfort Tips: https://www.rixeymanor.com/planning/guest-comfort-tips
- Welcome Bag Ideas: https://www.rixeymanor.com/planning/welcome-bag-ideas

### INSPIRATION & DECOR
- Décor Borrowing List: https://www.rixeymanor.com/planning/décor-borrowing-list
- Seasonal Touches: https://www.rixeymanor.com/planning/seasonal-touches
- Sprinkles (Grand Finale Ideas): https://www.rixeymanor.com/planning/sprinkles
- Signature Drink Ideas: https://www.rixeymanor.com/planning/signature-drink-ideas
- Pinterest Board Guidance: https://www.rixeymanor.com/planning/pinterest-board-guidance

### EXTRAS & ADD-ONS
- Extra Meals: https://www.rixeymanor.com/planning/extra-meals
- Brunch Upgrade: https://www.rixeymanor.com/planning/brunch-upgrade

### SHOPPING LINKS
- Shopping Hub: https://www.rixeymanor.com/shoppinglist
- Practical Purchases: https://www.rixeymanor.com/planning/practical-purchases
- Rental Alternatives: https://www.rixeymanor.com/planning/rental-alternatives
- Décor Finds: https://www.rixeymanor.com/planning/décor-finds
- Beauty & Wellness: https://www.rixeymanor.com/planning/beauty-&-wellness
- Books & Inspiration: https://www.rixeymanor.com/planning/books-&-inspiration

### POST-WEDDING
- Post-Wedding Hub: https://www.rixeymanor.com/postwedding
- Post-Wedding Checklist: https://www.rixeymanor.com/planning/post-wedding-checklist
- Finance & Paperwork: https://www.rixeymanor.com/planning/finance-&-paperwork
- Reviews & Thank-Yous: https://www.rixeymanor.com/planning/reviews-&-thank-yous
- Wedding Blues Support: https://www.rixeymanor.com/planning/wedding-blues-support

### WHEN TO SHARE WHICH LINKS

**Calendly links:**
- 15-min phone call → Quick questions, unsure about touring
- Onboarding → Right after booking
- Mid-planning check-in → 4-6 months out
- 1-hour Zoom → Detailed planning, can't meet in person
- 1-hour in-person → Detailed planning, visiting the area
- Vendor walk-through → Vendors unfamiliar with venue, final walkthroughs

**Website pages:**
- Questions about venue spaces → Link to specific space page
- Questions about what's included → /includeddecor or /packages
- Budget questions (pre-booking) → /finance101 or /packagesandpricing
- Budget questions (booked) → /planning/budget-guide

**Planning portal pages:**
- Only for booked couples (these are client resources)
- Match the topic to their question
- If overwhelmed → Start with /planning/handbook or /planning/wedding-to-do-list`;



// Get relevant knowledge based on the user's question
async function getRelevantKnowledge(question) {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('title, category, subcategory, content');

  if (error) {
    console.error('Error fetching knowledge:', error);
    return '';
  }

  // Format knowledge for context
  const knowledge = data.map(item =>
    `## ${item.title} (${item.category} > ${item.subcategory})\n${item.content}`
  ).join('\n\n---\n\n');

  return knowledge;
}

// Planning note detection patterns
const PLANNING_PATTERNS = {
  vendor_booking: {
    patterns: [
      // Casual: "booking [vendor]", "def booking", "definitely using"
      /(?:def(?:initely)?|probably|likely|actually)?\s*(?:booking|using|hiring|going with)\s+(.+?)(?:\s+(?:for|as)\s+(?:our\s+)?(.+?))?(?:\.|,|!|$)/i,
      // Past/present: "we've booked", "we hired", "we're going with"
      /(?:we(?:'ve|'re| have| are)?|i(?:'ve|'m| have| am)?)\s+(?:booked|hired|going with|chose|chosen|decided on|using)\s+(.+?)(?:\s+(?:for|as)\s+(?:our\s+)?(.+?))?(?:\.|,|!|$)/i,
      // Future: "going to book", "want to use", "planning to hire"
      /(?:we(?:'re)?|i(?:'m)?)\s+(?:going to|want to|planning to|thinking of|looking at)\s+(?:book|hire|use|go with)\s+(.+?)(?:\s+(?:for|as)\s+(?:our\s+)?(.+?))?(?:\.|,|!|$)/i,
      // Simple: "our florist is", "my photographer will be"
      /(?:our|my)\s+(florist|photographer|videographer|dj|caterer|planner|coordinator|officiant|band|baker|bartender|hair|makeup|flowers)\s+(?:is|will be|are)\s+(.+?)(?:\.|,|!|$)/i,
      // Vendor name first: "hired [name] as our florist"
      /(?:booked|hired|using)\s+(.+?)\s+(?:for|as)\s+(?:our\s+)?(florist|photographer|videographer|dj|caterer|planner|coordinator|officiant|band|baker|flowers?|photos?|video|music|food|catering)(?:\.|,|!|$)/i,
    ],
    category: 'vendor'
  },
  vendor_contact: {
    patterns: [
      /(?:phone|number|contact|cell|mobile)(?:\s+(?:is|:))?\s*([\d\-\(\)\s\.]{10,})/i,
      /(?:email|e-mail)(?:\s+(?:is|:))?\s*([\w\.\-]+@[\w\.\-]+\.\w+)/i
    ],
    category: 'vendor_contact'
  },
  guest_count: {
    patterns: [
      /(\d+)\s*(?:guests?|people|attending|coming)/i,
      /guest\s*(?:count|list)\s*(?:is|:)?\s*(\d+)/i
    ],
    category: 'guest_count'
  },
  decor_choice: {
    patterns: [
      /(?:we(?:'re|'ll| will| are)?|i(?:'m|'ll| will| am)?)\s+(?:using|going with|want|chose|choosing)\s+(?:the\s+)?(.+?)\s*(?:arbor|arch|backdrop|centerpieces?|flowers?|linens?|tablecloths?)/i,
      /(?:for\s+)?(?:our\s+)?(?:arbor|arch|backdrop|centerpieces?)\s*(?:we(?:'re|'ll)?|i(?:'m|'ll)?)\s*(?:using|want|chose)\s+(.+?)(?:\.|,|$)/i
    ],
    category: 'decor'
  },
  ceremony_detail: {
    patterns: [
      /ceremony\s+(?:starts?|begins?|time|at)\s*(?:is|:)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
      /(?:we(?:'re|'ll)?|i(?:'m|'ll)?)\s+(?:doing|having)\s+(?:our\s+)?(?:ceremony|first look)\s+(.+?)(?:\.|,|$)/i
    ],
    category: 'ceremony'
  },
  allergy: {
    patterns: [
      /(\w+)\s+(?:has|have)\s+(?:a\s+)?(.+?)\s*allergy/i,
      /allergic\s+to\s+(.+?)(?:\.|,|$)/i,
      /allergy(?:\s+(?:is|:))?\s*(.+?)(?:\.|,|$)/i
    ],
    category: 'allergy'
  },
  timeline_detail: {
    patterns: [
      /(?:dinner|reception|cocktail hour|first dance|speeches?)\s+(?:starts?|begins?|at)\s*(?:is|:)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
    ],
    category: 'timeline'
  },
  color_theme: {
    patterns: [
      /(?:our\s+)?(?:wedding\s+)?colors?\s+(?:are|is|:)\s*(.+?)(?:\.|,|$)/i,
      /(?:we(?:'re)?|i(?:'m)?)\s+(?:going with|doing|using)\s+(.+?)\s+(?:as\s+)?(?:our\s+)?colors?/i
    ],
    category: 'colors'
  },
  important_note: {
    patterns: [
      /(?:please\s+)?(?:note|remember|don't forget|important)(?:\s+that)?(?:\s*:)?\s*(.+?)(?:\.|$)/i,
      /(?:we\s+)?(?:need|want)\s+to\s+(?:make sure|remember)\s+(.+?)(?:\.|$)/i
    ],
    category: 'note'
  },
  checklist_complete: {
    patterns: [
      /(?:we've|i've|we)\s+(?:booked|hired|sent|ordered|finished|completed|finalized|done)\s+(?:the\s+)?(.+?)(?:\.|!|$)/i,
      /(?:just|finally)\s+(?:booked|hired|sent|ordered|finished|completed)\s+(?:the\s+)?(.+?)(?:\.|!|$)/i,
      /(?:the\s+)?(.+?)\s+(?:is|are)\s+(?:booked|done|finished|ordered|sent|complete)(?:\.|!|$)/i
    ],
    category: 'checklist_complete'
  }
};

// Extract planning notes from a message
async function extractPlanningNotes(message, userId, weddingId) {
  const notes = [];
  console.log('Checking message for planning notes:', message.substring(0, 100));

  for (const [type, config] of Object.entries(PLANNING_PATTERNS)) {
    for (const pattern of config.patterns) {
      const match = message.match(pattern);
      if (match) {
        console.log(`  MATCH found: ${type}`, match);
        let content = '';

        // Format content based on category
        switch (config.category) {
          case 'vendor':
            content = match[2]
              ? `${match[2]}: ${match[1]}`
              : `Vendor: ${match[1]}`;
            break;
          case 'vendor_contact':
            content = `Contact info: ${match[1]}`;
            break;
          case 'guest_count':
            content = `Guest count: ${match[1]}`;
            break;
          case 'decor':
            content = `Decor choice: ${match[1]}`;
            break;
          case 'ceremony':
            content = `Ceremony: ${match[1]}`;
            break;
          case 'allergy':
            content = match[2]
              ? `Allergy: ${match[1]} - ${match[2]}`
              : `Allergy: ${match[1]}`;
            break;
          case 'timeline':
            content = `Timeline: ${match[0]}`;
            break;
          case 'colors':
            content = `Colors: ${match[1]}`;
            break;
          case 'note':
            content = match[1];
            break;
          default:
            content = match[1] || match[0];
        }

        notes.push({
          wedding_id: weddingId,
          user_id: userId,
          category: config.category,
          content: content.trim(),
          source_message: message.substring(0, 500)
        });

        break; // Only capture first match per pattern type
      }
    }
  }

  return notes;
}

// Save planning notes to database
async function savePlanningNotes(notes) {
  if (notes.length === 0) return;

  try {
    const { error } = await supabase
      .from('planning_notes')
      .insert(notes);

    if (error) {
      console.error('Error saving planning notes:', error);
    } else {
      console.log(`Saved ${notes.length} planning note(s)`);
    }
  } catch (err) {
    console.error('Error saving planning notes:', err);
  }
}

// Get wedding ID for a user
async function getWeddingIdForUser(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('wedding_id')
    .eq('id', userId)
    .single();

  return data?.wedding_id || null;
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId, profile, conversationHistory = [] } = req.body;

    // Get knowledge base context
    const knowledge = await getRelevantKnowledge(message);

    // Get profile context
    const profileContext = formatProfileContext(profile);

    // Get wedding-specific context (vendors, inspo, planning notes, contracts)
    let weddingContext = '';
    const weddingId = profile?.wedding_id || await getWeddingIdForUser(userId);
    if (weddingId) {
      try {
        // Get vendors
        const { data: vendors } = await supabase
          .from('vendor_checklist')
          .select('vendor_type, vendor_name, vendor_contact, is_booked, contract_uploaded, notes')
          .eq('wedding_id', weddingId);

        if (vendors && vendors.length > 0) {
          weddingContext += '\n\nTHIS COUPLE\'S VENDORS:\n';
          vendors.forEach(v => {
            weddingContext += `- ${v.vendor_type}: ${v.vendor_name || 'TBD'}`;
            if (v.is_booked) weddingContext += ' (BOOKED)';
            if (v.contract_uploaded) weddingContext += ' [contract on file]';
            if (v.vendor_contact) weddingContext += ` - Contact: ${v.vendor_contact}`;
            if (v.notes) weddingContext += ` - Notes: ${v.notes}`;
            weddingContext += '\n';
          });
        }

        // Get inspo gallery captions (style/color references)
        const { data: inspo } = await supabase
          .from('inspo_gallery')
          .select('caption')
          .eq('wedding_id', weddingId)
          .not('caption', 'is', null);

        if (inspo && inspo.length > 0) {
          weddingContext += '\nTHIS COUPLE\'S INSPIRATION/STYLE PREFERENCES:\n';
          inspo.forEach(i => {
            if (i.caption) weddingContext += `- ${i.caption}\n`;
          });
        }

        // Get recent planning notes (confirmed details)
        const { data: notes } = await supabase
          .from('planning_notes')
          .select('category, content')
          .eq('wedding_id', weddingId)
          .eq('status', 'added')
          .order('created_at', { ascending: false })
          .limit(20);

        if (notes && notes.length > 0) {
          weddingContext += '\nCONFIRMED PLANNING DETAILS:\n';
          notes.forEach(n => {
            weddingContext += `- [${n.category}] ${n.content}\n`;
          });
        }

        // Check if the question is contract/vendor related
        const contractKeywords = [
          'contract', 'vendor', 'cost', 'price', 'payment', 'deposit', 'fee',
          'photographer', 'videographer', 'caterer', 'catering', 'florist', 'flowers',
          'dj', 'band', 'music', 'officiant', 'cake', 'bakery', 'hair', 'makeup',
          'coordinator', 'planner', 'rentals', 'transportation', 'limo',
          'deadline', 'due', 'pay', 'invoice', 'quote', 'proposal', 'booking',
          'cancel', 'refund', 'policy', 'terms', 'agreement', 'signed',
          'contact', 'phone', 'email', 'address', 'hours', 'coverage'
        ];
        const lowerMessage = message.toLowerCase();
        const isContractRelated = contractKeywords.some(kw => lowerMessage.includes(kw));

        // Get contracts - full text if question is contract-related, summaries otherwise
        const { data: contracts } = await supabase
          .from('contracts')
          .select('filename, extracted_text')
          .eq('wedding_id', weddingId);

        if (contracts && contracts.length > 0) {
          if (isContractRelated) {
            // Include full contract text for contract-related questions
            weddingContext += '\nFULL CONTRACT DETAILS ON FILE:\n';
            contracts.forEach(c => {
              weddingContext += `--- CONTRACT: ${c.filename} ---\n${c.extracted_text || 'No text extracted'}\n\n`;
            });
            console.log(`Including full contract text for contract-related question`);
          } else {
            // Just summaries for general questions
            weddingContext += '\nCONTRACT SUMMARIES ON FILE:\n';
            contracts.forEach(c => {
              const summary = c.extracted_text?.substring(0, 500) || '';
              weddingContext += `--- ${c.filename} ---\n${summary}...\n\n`;
            });
          }
        }
      } catch (contextErr) {
        console.error('Error fetching wedding context:', contextErr);
      }
    }

    // Build messages array with conversation history
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    // Call Claude with confidence assessment instruction
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      temperature: 0.7,
      system: `${SAGE_SYSTEM_PROMPT}${profileContext}\n\n---\n\nADDITIONAL RIXEY MANOR KNOWLEDGE BASE:\n\n${knowledge}${weddingContext}\n\n---\n\nIMPORTANT: After your response, on a new line, add a confidence assessment in this exact format:\n[CONFIDENCE: XX]\nWhere XX is a number from 0-100 representing how confident you are in your answer based on the knowledge base and Rixey Manor information available to you. Use 100 for facts you know for certain, lower numbers for things you're less sure about or had to generalize.`,
      messages: messages
    });

    let assistantMessage = response.content[0].text;
    let confidence = 100;

    // Extract confidence level from response
    const confidenceMatch = assistantMessage.match(/\[CONFIDENCE:\s*(\d+)\]/i);
    if (confidenceMatch) {
      confidence = parseInt(confidenceMatch[1], 10);
      // Remove the confidence tag from the visible message
      assistantMessage = assistantMessage.replace(/\n?\[CONFIDENCE:\s*\d+\]/i, '').trim();
    }

    // Log usage
    await logUsage(weddingId, userId, 'chat', response);

    // If confidence is below 75%, save as uncertain question for admin review
    // and add a note to the response letting the client know
    if (confidence < 75 && weddingId) {
      try {
        await supabase.from('uncertain_questions').insert({
          wedding_id: weddingId,
          user_id: userId,
          question: message,
          sage_response: assistantMessage,
          confidence_level: confidence
        });
        console.log(`Low confidence (${confidence}%) question logged for admin review`);

        // Add a friendly note to the response letting them know we're checking with the team
        assistantMessage += "\n\n---\n*I want to make sure I'm giving you the right info on this one, so I've flagged it for the human team to double-check. They'll follow up if there's anything to add or clarify!*";
      } catch (err) {
        console.error('Error saving uncertain question:', err);
      }
    }

    // Extract and save planning notes from the user's message
    if (weddingId) {
      const notes = await extractPlanningNotes(message, userId, weddingId);
      if (notes.length > 0) {
        await savePlanningNotes(notes);
      }
    }

    res.json({ message: assistantMessage, confidence });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to get response from Sage' });
  }
});

// Helper to format profile info for prompts
function formatProfileContext(profile) {
  if (!profile) return '';

  const roleLabels = {
    'couple-bride': 'Bride',
    'couple-groom': 'Groom',
    'couple-custom': profile?.custom_role_term || 'Partner',
    'mother-bride': 'Mother of the Bride',
    'mother-groom': 'Mother of the Groom',
    'father-bride': 'Father of the Bride',
    'father-groom': 'Father of the Groom',
    'best-man': 'Best Man',
    'maid-of-honor': 'Maid of Honor',
    'vip': 'VIP Guest'
  };

  const parts = [];
  if (profile.name) parts.push(`Name: ${profile.name}`);
  if (profile.role) parts.push(`Role: ${roleLabels[profile.role] || profile.role}`);
  if (profile.wedding_date) {
    const date = new Date(profile.wedding_date);
    const formatted = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const daysUntil = Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24));
    parts.push(`Wedding Date: ${formatted} (${daysUntil > 0 ? daysUntil + ' days away' : 'past'})`);
  }

  return parts.length > 0 ? `\n\nUSER PROFILE:\n${parts.join('\n')}` : '';
}

// Welcome endpoint - generates personalized greeting
app.post('/api/welcome', async (req, res) => {
  try {
    const { userId, userEmail, profile, conversationHistory = [] } = req.body;

    const isReturningUser = conversationHistory.length > 0;
    const profileContext = formatProfileContext(profile);
    const firstName = profile?.name?.split(' ')[0] || '';

    // Build context about previous conversations
    let conversationContext = '';
    if (isReturningUser) {
      const recentMessages = conversationHistory.slice(-20);
      const userMessages = recentMessages.filter(m => m.sender === 'user').map(m => m.content);
      conversationContext = `
Previous conversation topics from this user:
${userMessages.join('\n')}

Reference something specific from their previous messages in your welcome back greeting.`;
    }

    const welcomePrompt = isReturningUser
      ? `Generate a warm welcome-back message for a returning user.
${profileContext}

${conversationContext}

${firstName ? `Address them by their first name (${firstName}).` : ''}
Keep it brief (2-3 sentences). Reference a specific detail from their previous conversations to show you remember them.
Mention that you're here to help and that everything they share is saved to their planning file.
Don't be cheesy. Sound like a friend who remembers them.`
      : `Generate a first-time welcome message for a new user.
${profileContext}

Introduce yourself as Sage, their planning sidekick for their Rixey Manor wedding weekend.
${firstName ? `Address them by their first name (${firstName}).` : ''}
${profile?.wedding_date ? `Acknowledge their wedding date if relevant (maybe mention how exciting it is, or note how many days away).` : ''}
${profile?.role && !profile.role.startsWith('couple') ? `Acknowledge their role - they're helping plan someone else's wedding, which is lovely.` : ''}

Mention that:
- You're here to answer questions, help think through decisions, and keep track of notes/ideas
- Everything they share gets saved to their planning file, so they can brainstorm freely

Keep it warm but not over-the-top. 3-4 sentences max. End with an open question.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      temperature: 0.7,
      system: SAGE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: welcomePrompt }]
    });

    const welcomeMessage = response.content[0].text;

    res.json({ message: welcomeMessage });
  } catch (error) {
    console.error('Welcome error:', error);
    res.json({
      message: "Hey there! I'm Sage, your planning sidekick for your Rixey Manor weekend. I'm here to answer questions, help you think through decisions, and keep track of your notes. Everything you share here gets saved to your file, so brainstorm away. What's on your mind?"
    });
  }
});

// Contract upload and extraction endpoint
app.post('/api/extract-contract', upload.single('contract'), async (req, res) => {
  try {
    const { weddingId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!weddingId) {
      return res.status(400).json({ error: 'Wedding ID required' });
    }

    console.log(`Processing contract for wedding ${weddingId}: ${file.originalname}`);

    const base64Data = file.buffer.toString('base64');
    const isPdf = file.mimetype === 'application/pdf';

    // First, ask Claude to extract the full text content for storage
    let extractedFullText = '';
    try {
      const textExtractionResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: isPdf ? [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64Data }
            },
            { type: 'text', text: 'Extract ALL text from this document exactly as it appears. Include everything - names, dates, numbers, terms, conditions. Return only the extracted text, no commentary.' }
          ] : [
            {
              type: 'image',
              source: { type: 'base64', media_type: file.mimetype, data: base64Data }
            },
            { type: 'text', text: 'Extract ALL text from this document exactly as it appears. Include everything - names, dates, numbers, terms, conditions. Return only the extracted text, no commentary.' }
          ]
        }]
      });
      extractedFullText = textExtractionResponse.content[0].text;
      console.log(`Extracted ${extractedFullText.length} chars of full text`);
    } catch (textErr) {
      console.error('Text extraction error:', textErr);
    }

    // Save the contract to database
    const { data: savedContract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        wedding_id: weddingId,
        filename: file.originalname,
        file_type: file.mimetype,
        extracted_text: extractedFullText
      })
      .select()
      .single();

    if (contractError) {
      console.error('Contract save error:', contractError);
    } else {
      console.log(`Saved contract: ${savedContract.id}`);
    }

    // Prepare Claude request
    const extractionPrompt = `You are analyzing a wedding vendor contract. Extract the following key details and return them as a JSON array of planning notes.

For each piece of important information found, create an object with:
- category: one of "vendor", "timeline", "cost", "note", "allergy", "guest_count"
- content: a brief, clear description of the information

Focus on extracting:
- Vendor name and type (photographer, florist, caterer, etc.)
- Contact information (phone, email)
- Event date and times
- Costs and payment schedules
- Important deadlines
- Special requirements or restrictions
- Deposit amounts and due dates
- Cancellation policies (summarized)

Return ONLY a valid JSON array, no other text. Example:
[
  {"category": "vendor", "content": "Photographer: Jane Smith Photography"},
  {"category": "cost", "content": "Photography package: $3,500 total"},
  {"category": "timeline", "content": "Final payment due: 2 weeks before wedding"},
  {"category": "note", "content": "Includes 8 hours coverage + second shooter"}
]`;

    let response;
    if (isPdf) {
      // Use Claude's document feature for PDFs
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Data
              }
            },
            {
              type: 'text',
              text: extractionPrompt
            }
          ]
        }]
      });
    } else {
      // Use Claude's vision for images
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: file.mimetype,
                data: base64Data
              }
            },
            {
              type: 'text',
              text: extractionPrompt
            }
          ]
        }]
      });
    }

    // Log usage (admin upload, so no userId)
    await logUsage(weddingId, null, 'extract-contract', response);

    const responseText = response.content[0].text;
    console.log('Claude response:', responseText);

    // Parse JSON from response
    let extractedNotes = [];
    try {
      // Try to find JSON array in response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedNotes = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      return res.status(500).json({ error: 'Could not parse extracted data' });
    }

    // Save notes to database
    if (extractedNotes.length > 0) {
      const notesToSave = extractedNotes.map(note => ({
        wedding_id: weddingId,
        category: note.category || 'note',
        content: note.content,
        source_message: `Extracted from contract: ${file.originalname}`,
        status: 'pending'
      }));

      const { error: insertError } = await supabase
        .from('planning_notes')
        .insert(notesToSave);

      if (insertError) {
        console.error('Insert error:', insertError);
        return res.status(500).json({ error: 'Failed to save notes' });
      }

      console.log(`Saved ${notesToSave.length} notes from contract`);
    }

    res.json({
      success: true,
      notesExtracted: extractedNotes.length,
      notes: extractedNotes
    });

  } catch (error) {
    console.error('Contract extraction error:', error);
    res.status(500).json({ error: 'Failed to process contract' });
  }
});

// Chat with file upload (for client chat)
app.post('/api/chat-with-file', upload.single('file'), async (req, res) => {
  try {
    const { message, userId, weddingId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Chat with file: ${file.originalname} from user ${userId}, weddingId: ${weddingId || 'NONE'}`);

    const base64Data = file.buffer.toString('base64');
    const isPdf = file.mimetype === 'application/pdf';

    // Build the prompt
    const userQuestion = message || 'What can you tell me about this document?';

    let response;
    if (isPdf) {
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: SAGE_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64Data }
            },
            { type: 'text', text: userQuestion }
          ]
        }]
      });
    } else {
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: SAGE_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: file.mimetype, data: base64Data }
            },
            { type: 'text', text: userQuestion }
          ]
        }]
      });
    }

    const sageResponse = response.content[0].text;

    // Log usage for the main chat response
    await logUsage(weddingId, userId, 'chat-with-file', response);

    // If there's a weddingId, also save the file to appropriate places
    if (weddingId) {
      try {
        const isImage = file.mimetype.startsWith('image/');
        const isDocument = isPdf || file.mimetype.includes('document');

        // Determine if this is an inspo image or a contract/document
        let fileType = 'unknown';
        const classifyResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: isImage ? [
              { type: 'image', source: { type: 'base64', media_type: file.mimetype, data: base64Data } },
              { type: 'text', text: 'Classify this image. Reply with ONLY one word: "inspo" if this is wedding inspiration/decor/style, "contract" if this is a contract/invoice/document, or "other" if neither.' }
            ] : [
              { type: 'document', source: { type: 'base64', media_type: file.mimetype, data: base64Data } },
              { type: 'text', text: 'Classify this document. Reply with ONLY one word: "contract" if this is a vendor contract/invoice/quote, or "other" if not.' }
            ]
          }]
        });
        fileType = classifyResponse.content[0].text.toLowerCase().trim();
        console.log(`File classified as: ${fileType}`);

        // Handle inspiration images
        if (fileType === 'inspo' && isImage) {
          // Check if they haven't exceeded max inspo images
          const { count } = await supabase
            .from('inspo_gallery')
            .select('*', { count: 'exact', head: true })
            .eq('wedding_id', weddingId);

          if (count < 20) {
            // Upload to inspo-gallery bucket
            const fileName = `${weddingId}/${Date.now()}_${file.originalname}`;
            const { error: uploadError } = await supabaseAdmin.storage
              .from('inspo-gallery')
              .upload(fileName, file.buffer, { contentType: file.mimetype });

            if (!uploadError) {
              const { data: signedUrlData } = await supabaseAdmin.storage
                .from('inspo-gallery')
                .createSignedUrl(fileName, 31536000);

              if (signedUrlData) {
                // Get a caption for the image
                const captionResponse = await anthropic.messages.create({
                  model: 'claude-sonnet-4-20250514',
                  max_tokens: 50,
                  messages: [{
                    role: 'user',
                    content: [
                      { type: 'image', source: { type: 'base64', media_type: file.mimetype, data: base64Data } },
                      { type: 'text', text: 'Describe this wedding inspiration image in 5-10 words for a gallery caption. Be specific about colors, style, or elements shown.' }
                    ]
                  }]
                });

                await supabase.from('inspo_gallery').insert({
                  wedding_id: weddingId,
                  image_url: signedUrlData.signedUrl,
                  caption: captionResponse.content[0].text,
                  uploaded_by: userId
                });
                console.log(`Added inspo image from chat: ${file.originalname}`);
              }
            }
          }
        }

        // Handle contracts/documents
        if (fileType === 'contract' || isDocument) {
          // Extract full text for storage
          const textResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8000,
            messages: [{
              role: 'user',
              content: isPdf ? [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
                { type: 'text', text: 'Extract ALL text from this document exactly as it appears. Return only the text.' }
              ] : [
                { type: 'image', source: { type: 'base64', media_type: file.mimetype, data: base64Data } },
                { type: 'text', text: 'Extract ALL text from this image exactly as it appears. Return only the text.' }
              ]
            }]
          });

          await supabase.from('contracts').insert({
            wedding_id: weddingId,
            filename: file.originalname,
            file_type: file.mimetype,
            extracted_text: textResponse.content[0].text
          });
          console.log(`Saved contract from chat: ${file.originalname}`);

          // Try to identify vendor type and add to vendor checklist if new
          const vendorTypeResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 100,
            messages: [{
              role: 'user',
              content: isPdf ? [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
                { type: 'text', text: 'What type of wedding vendor is this contract for? Reply with ONLY one of: photographer, videographer, caterer, florist, dj, band, officiant, cake, hair, makeup, coordinator, rentals, transportation, other. Just the single word.' }
              ] : [
                { type: 'image', source: { type: 'base64', media_type: file.mimetype, data: base64Data } },
                { type: 'text', text: 'What type of wedding vendor is this contract for? Reply with ONLY one of: photographer, videographer, caterer, florist, dj, band, officiant, cake, hair, makeup, coordinator, rentals, transportation, other. Just the single word.' }
              ]
            }]
          });
          const vendorType = vendorTypeResponse.content[0].text.toLowerCase().trim();

          // Check if this vendor type already exists
          const { data: existingVendor } = await supabase
            .from('vendor_checklist')
            .select('id')
            .eq('wedding_id', weddingId)
            .eq('vendor_type', vendorType)
            .single();

          if (!existingVendor && vendorType !== 'other') {
            // Upload contract to storage
            const contractFileName = `${weddingId}/${Date.now()}_${file.originalname}`;
            const { error: uploadError } = await supabaseAdmin.storage
              .from('vendor-contracts')
              .upload(contractFileName, file.buffer, { contentType: file.mimetype });

            if (!uploadError) {
              const { data: signedUrlData } = await supabaseAdmin.storage
                .from('vendor-contracts')
                .createSignedUrl(contractFileName, 31536000);

              if (signedUrlData) {
                // Create new vendor entry with contract
                await supabase.from('vendor_checklist').insert({
                  wedding_id: weddingId,
                  vendor_type: vendorType,
                  contract_uploaded: true,
                  contract_url: signedUrlData.signedUrl,
                  contract_date: new Date().toISOString().split('T')[0],
                  is_booked: true
                });
                console.log(`Created vendor checklist entry for ${vendorType} from chat upload`);
              }
            }
          }

          // Also extract planning notes from the contract
          const extractionPrompt = `Extract key planning details from this document as a JSON array. For each item include:
- category: one of "vendor", "timeline", "cost", "note", "allergy", "guest_count"
- content: brief description

Focus on: vendor names, contact info, costs, dates, deadlines, special requirements.
Return ONLY a valid JSON array like: [{"category": "vendor", "content": "Caterer: ABC Catering"}]`;

          const notesResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{
              role: 'user',
              content: isPdf ? [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
                { type: 'text', text: extractionPrompt }
              ] : [
                { type: 'image', source: { type: 'base64', media_type: file.mimetype, data: base64Data } },
                { type: 'text', text: extractionPrompt }
              ]
            }]
          });

          // Parse and save planning notes
          try {
            const notesText = notesResponse.content[0].text;
            const jsonMatch = notesText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const extractedNotes = JSON.parse(jsonMatch[0]);
              if (extractedNotes.length > 0) {
                const notesToSave = extractedNotes.map(note => ({
                  wedding_id: weddingId,
                  category: note.category || 'note',
                  content: note.content,
                  source_message: `Extracted from: ${file.originalname}`,
                  status: 'pending'
                }));
                await supabase.from('planning_notes').insert(notesToSave);
                console.log(`Extracted ${notesToSave.length} planning notes from chat upload`);
              }
            }
          } catch (notesErr) {
            console.error('Error extracting notes from chat upload:', notesErr);
          }
        }
      } catch (saveErr) {
        console.error('Error processing file from chat:', saveErr);
      }
    }

    res.json({ message: sageResponse });

  } catch (error) {
    console.error('Chat with file error:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// Ask questions about contracts AND planning notes
app.post('/api/ask-contracts', async (req, res) => {
  try {
    const { weddingId, question } = req.body;

    if (!weddingId || !question) {
      return res.status(400).json({ error: 'Wedding ID and question required' });
    }

    // Get all contracts for this wedding
    const { data: contracts } = await supabase
      .from('contracts')
      .select('filename, extracted_text')
      .eq('wedding_id', weddingId);

    // Get all planning notes for this wedding
    const { data: planningNotes } = await supabase
      .from('planning_notes')
      .select('category, content, source_message, created_at')
      .eq('wedding_id', weddingId);

    const hasContracts = contracts && contracts.length > 0;
    const hasNotes = planningNotes && planningNotes.length > 0;

    if (!hasContracts && !hasNotes) {
      return res.json({
        answer: "No contracts or planning notes have been recorded for this wedding yet. Upload contracts or have the client chat with Sage to build up their planning file."
      });
    }

    // Combine all contract text
    let contractContext = '';
    if (hasContracts) {
      contractContext = contracts.map(c =>
        `--- CONTRACT: ${c.filename} ---\n${c.extracted_text}\n`
      ).join('\n\n');
    }

    // Combine planning notes
    let notesContext = '';
    if (hasNotes) {
      notesContext = planningNotes.map(n =>
        `[${n.category.toUpperCase()}] ${n.content}${n.source_message ? ` (from: "${n.source_message.substring(0, 100)}...")` : ''}`
      ).join('\n');
    }

    console.log(`Answering question with ${contracts?.length || 0} contracts and ${planningNotes?.length || 0} notes for wedding ${weddingId}`);

    // Ask Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are helping a wedding venue manager answer questions about a client's wedding. Based on the contracts and planning notes below, answer the following question. Be specific and cite your source (which contract or note).

If the information is not found, say so clearly.

${hasContracts ? `CONTRACTS:\n${contractContext}\n\n` : ''}${hasNotes ? `PLANNING NOTES:\n${notesContext}\n\n` : ''}
QUESTION: ${question}

Answer concisely and helpfully:`
      }]
    });

    const answer = response.content[0].text;
    console.log('Q&A answer:', answer.substring(0, 100) + '...');

    // Log usage (admin query, no userId)
    await logUsage(weddingId, null, 'ask-contracts', response);

    res.json({ answer });

  } catch (error) {
    console.error('Q&A error:', error);
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

// ============ GMAIL INTEGRATION ============

// Start Gmail OAuth flow
app.get('/api/gmail/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    prompt: 'consent'
  });
  res.json({ authUrl });
});

// Gmail OAuth callback
app.post('/api/gmail/callback', async (req, res) => {
  try {
    const { code } = req.body;
    console.log('Received OAuth code, exchanging for tokens...');

    const { tokens } = await oauth2Client.getToken(code);
    console.log('Got tokens:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiry: tokens.expiry_date
    });

    oauth2Client.setCredentials(tokens);

    // Save tokens to database - clear old first
    const { error: deleteError } = await supabase
      .from('gmail_tokens')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) console.log('Delete old tokens:', deleteError.message);

    const { error: insertError } = await supabase
      .from('gmail_tokens')
      .insert({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      });

    if (insertError) {
      console.error('Failed to save tokens:', insertError);
      return res.status(500).json({ error: 'Failed to save tokens: ' + insertError.message });
    }

    console.log('Gmail connected successfully - tokens saved');
    res.json({ success: true });
  } catch (error) {
    console.error('Gmail auth error:', error);
    res.status(500).json({ error: 'Failed to connect Gmail: ' + error.message });
  }
});

// Check Gmail connection status
app.get('/api/gmail/status', async (req, res) => {
  try {
    const { data: tokens, error: fetchError } = await supabase
      .from('gmail_tokens')
      .select('*')
      .limit(1)
      .single();

    console.log('Gmail status check - tokens found:', !!tokens, fetchError?.message || '');

    if (!tokens) {
      return res.json({ connected: false });
    }

    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    });

    // Test the connection
    try {
      await gmail.users.getProfile({ userId: 'me' });
      console.log('Gmail connection verified');
      res.json({ connected: true });
    } catch (testErr) {
      console.log('Gmail test failed:', testErr.message);
      res.json({ connected: false });
    }
  } catch (error) {
    console.log('Gmail status error:', error.message);
    res.json({ connected: false });
  }
});

// Fetch and process emails from registered client email addresses
app.post('/api/gmail/sync', async (req, res) => {
  try {
    // Load tokens
    const { data: tokens } = await supabase
      .from('gmail_tokens')
      .select('*')
      .limit(1)
      .single();

    if (!tokens) {
      return res.status(400).json({ error: 'Gmail not connected' });
    }

    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    });

    // Get all weddings with profiles (registered client emails)
    const { data: weddings } = await supabase
      .from('weddings')
      .select('id, couple_names, profiles(email)');

    if (!weddings || weddings.length === 0) {
      return res.json({
        processed: 0,
        message: 'No weddings with registered clients found.'
      });
    }

    // Build email-to-wedding lookup
    const emailToWedding = {};
    const clientEmails = [];
    for (const wedding of weddings) {
      for (const profile of (wedding.profiles || [])) {
        if (profile.email) {
          const email = profile.email.toLowerCase().trim();
          emailToWedding[email] = wedding.id;
          clientEmails.push(email);
        }
      }
    }

    if (clientEmails.length === 0) {
      return res.json({
        processed: 0,
        message: 'No client email addresses registered yet.'
      });
    }

    console.log(`Searching for emails from/about ${clientEmails.length} registered client addresses`);

    // Get already processed message IDs
    const { data: processed } = await supabase
      .from('processed_emails')
      .select('gmail_message_id');
    const processedIds = new Set((processed || []).map(p => p.gmail_message_id));

    let newlyProcessed = 0;
    let notesExtracted = 0;

    // Search for emails from each client AND emails containing their email (form submissions)
    for (const clientEmail of clientEmails) {
      // Two searches: emails FROM client, and emails CONTAINING client email (pricing calculator, etc.)
      const searchQueries = [
        `from:${clientEmail}`,
        `"${clientEmail}"` // Search for email address in body
      ];

      for (const searchQuery of searchQueries) {
      try {
        const messagesResponse = await gmail.users.messages.list({
          userId: 'me',
          q: searchQuery,
          maxResults: 20 // Limit per query to avoid rate limits
        });

        const messageIds = messagesResponse.data.messages || [];

        for (const msg of messageIds) {
          if (processedIds.has(msg.id)) continue;

          // Get full message
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full'
          });

          const headers = fullMessage.data.payload.headers;
          const fromHeader = headers.find(h => h.name === 'From')?.value || '';
          const subject = headers.find(h => h.name === 'Subject')?.value || '';
          const dateHeader = headers.find(h => h.name === 'Date')?.value || '';

          // Extract email address from "From" header
          const emailMatch = fromHeader.match(/<(.+?)>/) || [null, fromHeader];
          const fromEmail = emailMatch[1]?.toLowerCase().trim() || clientEmail;

          // Skip emails from Sage
          if (fromEmail === 'sage@rixeymanor.com') continue;

          // Get message body
          let bodyText = '';
          const payload = fullMessage.data.payload;

          if (payload.body?.data) {
            bodyText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
          } else if (payload.parts) {
            const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
            if (textPart?.body?.data) {
              bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
            } else {
              // Try HTML part
              const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
              if (htmlPart?.body?.data) {
                bodyText = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8')
                  .replace(/<[^>]*>/g, ' '); // Strip HTML tags
              }
            }
          }

          const weddingId = emailToWedding[fromEmail] || emailToWedding[clientEmail];

          // Save to processed_emails
          await supabase.from('processed_emails').insert({
            gmail_message_id: msg.id,
            wedding_id: weddingId,
            from_email: fromEmail,
            subject: subject,
            body_text: bodyText.substring(0, 10000)
          });

          // Extract planning notes
          if (weddingId && bodyText) {
            const notes = await extractPlanningNotes(bodyText, null, weddingId);
            if (notes.length > 0) {
              notes.forEach(n => {
                n.source_message = `From email "${subject}" (${dateHeader})`;
              });
              await savePlanningNotes(notes);
              notesExtracted += notes.length;
            }
          }

          newlyProcessed++;
          processedIds.add(msg.id); // Track within this sync
        }
      } catch (searchErr) {
        console.error(`Error searching "${searchQuery}":`, searchErr.message);
      }
      } // end searchQueries loop
    } // end clientEmails loop

    console.log(`Processed ${newlyProcessed} new emails, extracted ${notesExtracted} planning notes`);
    res.json({
      processed: newlyProcessed,
      notesExtracted,
      clientsSearched: clientEmails.length,
      message: `Synced ${newlyProcessed} new emails from ${clientEmails.length} registered clients. Extracted ${notesExtracted} planning notes.`
    });

  } catch (error) {
    console.error('Gmail sync error:', error);
    res.status(500).json({ error: 'Failed to sync emails: ' + error.message });
  }
});

// Disconnect Gmail
app.post('/api/gmail/disconnect', async (req, res) => {
  try {
    await supabase.from('gmail_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ============ QUO (OPENPHONE) INTEGRATION ============

const QUO_API_KEY = process.env.QUO_API_KEY;
const QUO_API_BASE = 'https://api.openphone.com/v1';

// Helper to normalize phone numbers for matching
function normalizePhone(phone) {
  if (!phone) return null;
  return phone.replace(/\D/g, '').slice(-10); // Last 10 digits
}

// Check Quo connection status
app.get('/api/quo/status', (req, res) => {
  res.json({ connected: !!QUO_API_KEY });
});

// Sync messages from Quo
app.post('/api/quo/sync', async (req, res) => {
  try {
    if (!QUO_API_KEY) {
      return res.status(400).json({ error: 'Quo API key not configured' });
    }

    // Get all profiles with phone numbers
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, phone, wedding_id')
      .not('phone', 'is', null);

    if (!profiles || profiles.length === 0) {
      return res.json({
        processed: 0,
        message: 'No client phone numbers registered. Add phone numbers to client profiles first.'
      });
    }

    // Build phone-to-wedding lookup
    const phoneToWedding = {};
    const phoneToUser = {};
    for (const profile of profiles) {
      if (profile.phone && profile.wedding_id) {
        const normalized = normalizePhone(profile.phone);
        if (normalized) {
          phoneToWedding[normalized] = profile.wedding_id;
          phoneToUser[normalized] = profile.id;
        }
      }
    }

    console.log(`Searching Quo for messages from ${Object.keys(phoneToWedding).length} registered phone numbers`);

    // Get already processed message IDs
    const { data: processed } = await supabase
      .from('processed_quo_messages')
      .select('quo_message_id');
    const processedIds = new Set((processed || []).map(p => p.quo_message_id));

    let newlyProcessed = 0;
    let notesExtracted = 0;

    // Fetch phone numbers from Quo to get phoneNumberIds
    const phoneNumbersResponse = await fetch(`${QUO_API_BASE}/phone-numbers`, {
      headers: { 'Authorization': QUO_API_KEY }
    });

    if (!phoneNumbersResponse.ok) {
      const errText = await phoneNumbersResponse.text();
      console.error('Quo phone numbers error:', errText);
      return res.status(500).json({ error: 'Failed to fetch Quo phone numbers' });
    }

    const phoneNumbersData = await phoneNumbersResponse.json();
    const quoPhoneNumbers = phoneNumbersData.data || [];

    // For each Quo phone number, fetch messages
    for (const quoPhone of quoPhoneNumbers) {
      const phoneNumberId = quoPhone.id;

      // Fetch messages for this phone number
      const messagesResponse = await fetch(
        `${QUO_API_BASE}/messages?phoneNumberId=${phoneNumberId}&maxResults=100`,
        { headers: { 'Authorization': QUO_API_KEY } }
      );

      if (!messagesResponse.ok) continue;

      const messagesData = await messagesResponse.json();
      const messages = messagesData.data || [];

      for (const msg of messages) {
        if (processedIds.has(msg.id)) continue;

        // Get the external phone number (the client's number)
        const externalPhone = msg.from?.phoneNumber || msg.to?.[0]?.phoneNumber;
        const normalizedExternal = normalizePhone(externalPhone);

        // Check if this phone matches a registered client
        const weddingId = phoneToWedding[normalizedExternal];

        if (!weddingId) continue; // Skip if not a registered client

        const messageBody = msg.body || msg.text || '';
        const direction = msg.direction || (msg.from?.phoneNumber === externalPhone ? 'inbound' : 'outbound');

        // Save to processed messages
        await supabase.from('processed_quo_messages').insert({
          quo_message_id: msg.id,
          wedding_id: weddingId,
          phone_number: externalPhone,
          direction: direction,
          body_text: messageBody.substring(0, 5000)
        });

        // Extract planning notes from inbound messages
        if (direction === 'inbound' && messageBody) {
          const notes = await extractPlanningNotes(messageBody, phoneToUser[normalizedExternal], weddingId);
          if (notes.length > 0) {
            notes.forEach(n => {
              n.source_message = `From text message: ${messageBody.substring(0, 100)}...`;
            });
            await savePlanningNotes(notes);
            notesExtracted += notes.length;
          }
        }

        newlyProcessed++;
        processedIds.add(msg.id);
      }
    }

    console.log(`Quo sync: processed ${newlyProcessed} messages, extracted ${notesExtracted} notes`);
    res.json({
      processed: newlyProcessed,
      notesExtracted,
      message: `Synced ${newlyProcessed} text messages. Extracted ${notesExtracted} planning notes.`
    });

  } catch (error) {
    console.error('Quo sync error:', error);
    res.status(500).json({ error: 'Failed to sync Quo messages: ' + error.message });
  }
});

// Generate AI highlights from planning notes
app.post('/api/notes-highlights', async (req, res) => {
  try {
    const { weddingId } = req.body;

    if (!weddingId) {
      return res.status(400).json({ error: 'Wedding ID required' });
    }

    // Get all planning notes
    const { data: notes } = await supabase
      .from('planning_notes')
      .select('category, content, source_message, created_at, status')
      .eq('wedding_id', weddingId)
      .order('created_at', { ascending: false });

    // Get contracts
    const { data: contracts } = await supabase
      .from('contracts')
      .select('filename')
      .eq('wedding_id', weddingId);

    if ((!notes || notes.length === 0) && (!contracts || contracts.length === 0)) {
      return res.json({ highlights: 'No planning notes or contracts found for this wedding yet.' });
    }

    // Format notes for Claude
    const notesText = (notes || []).map(n =>
      `[${n.category.toUpperCase()}] ${n.content} (Status: ${n.status})`
    ).join('\n');

    const contractsList = (contracts || []).map(c => c.filename).join(', ');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are helping a wedding venue manager get a quick overview of a client's wedding planning status.

Based on these planning notes, provide a concise summary with:
1. **Key Decisions Made** - What vendors are booked, major choices finalized
2. **Important Details** - Guest count, allergies, special requests
3. **Pending Items** - What still needs attention (notes marked "pending")
4. **Timeline Notes** - Any dates or deadlines mentioned

Keep it brief and scannable. Use bullet points. Highlight anything urgent.

PLANNING NOTES:
${notesText}

${contractsList ? `CONTRACTS ON FILE: ${contractsList}` : ''}

Provide the summary:`
      }]
    });

    res.json({ highlights: response.content[0].text });

  } catch (error) {
    console.error('Highlights error:', error);
    res.status(500).json({ error: 'Failed to generate highlights' });
  }
});

// ============ ZOOM INTEGRATION ============

const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;
const ZOOM_REDIRECT_URI = process.env.FRONTEND_URL
  ? `${process.env.FRONTEND_URL}/admin/zoom-callback`
  : 'http://localhost:5173/admin/zoom-callback';

// Start Zoom OAuth flow
app.get('/api/zoom/auth', (req, res) => {
  const authUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${ZOOM_CLIENT_ID}&redirect_uri=${encodeURIComponent(ZOOM_REDIRECT_URI)}`;
  res.json({ authUrl });
});

// Zoom OAuth callback
app.post('/api/zoom/callback', async (req, res) => {
  try {
    const { code } = req.body;
    console.log('Received Zoom OAuth code, exchanging for tokens...');

    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: ZOOM_REDIRECT_URI
      })
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error('Zoom token error:', tokens);
      return res.status(400).json({ error: tokens.error });
    }

    console.log('Got Zoom tokens:', { hasAccessToken: !!tokens.access_token, hasRefreshToken: !!tokens.refresh_token });

    // Save tokens
    await supabase.from('zoom_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error: insertError } = await supabase.from('zoom_tokens').insert({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: Date.now() + (tokens.expires_in * 1000)
    });

    if (insertError) {
      console.error('Failed to save Zoom tokens:', insertError);
      return res.status(500).json({ error: 'Failed to save tokens' });
    }

    console.log('Zoom connected successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Zoom auth error:', error);
    res.status(500).json({ error: 'Failed to connect Zoom' });
  }
});

// Check Zoom connection status
app.get('/api/zoom/status', async (req, res) => {
  try {
    const { data: tokens } = await supabase
      .from('zoom_tokens')
      .select('*')
      .limit(1)
      .single();

    res.json({ connected: !!tokens?.access_token });
  } catch (error) {
    res.json({ connected: false });
  }
});

// Helper to refresh Zoom token if needed
async function getZoomAccessToken() {
  const { data: tokens } = await supabase
    .from('zoom_tokens')
    .select('*')
    .limit(1)
    .single();

  if (!tokens) return null;

  // Check if token is expired (with 5 min buffer)
  if (tokens.expiry_date && Date.now() > tokens.expiry_date - 300000) {
    // Refresh token
    const refreshResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token
      })
    });

    const newTokens = await refreshResponse.json();

    if (newTokens.access_token) {
      await supabase.from('zoom_tokens')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token || tokens.refresh_token,
          expiry_date: Date.now() + (newTokens.expires_in * 1000),
          updated_at: new Date().toISOString()
        })
        .eq('id', tokens.id);

      return newTokens.access_token;
    }
  }

  return tokens.access_token;
}

// Sync Zoom meeting transcripts
app.post('/api/zoom/sync', async (req, res) => {
  try {
    const accessToken = await getZoomAccessToken();
    if (!accessToken) {
      return res.status(400).json({ error: 'Zoom not connected' });
    }

    // Get all weddings with profiles for name matching
    const { data: weddings } = await supabase
      .from('weddings')
      .select('id, couple_names, profiles(name, email)');

    // Build name-to-wedding lookup (lowercase for matching)
    const nameToWedding = {};
    for (const wedding of (weddings || [])) {
      // Add couple names
      if (wedding.couple_names) {
        const names = wedding.couple_names.toLowerCase().split(/[&,]/).map(n => n.trim());
        names.forEach(name => {
          if (name) nameToWedding[name] = wedding.id;
        });
      }
      // Add profile names
      for (const profile of (wedding.profiles || [])) {
        if (profile.name) {
          const firstName = profile.name.toLowerCase().split(' ')[0];
          const fullName = profile.name.toLowerCase();
          nameToWedding[firstName] = wedding.id;
          nameToWedding[fullName] = wedding.id;
        }
      }
    }

    console.log(`Searching Zoom for meetings, matching against ${Object.keys(nameToWedding).length} known names`);

    // Get processed meeting IDs
    const { data: processed } = await supabase
      .from('processed_zoom_meetings')
      .select('zoom_meeting_id');
    const processedIds = new Set((processed || []).map(p => p.zoom_meeting_id));

    // Fetch recordings from last 30 days
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const toDate = new Date();

    const recordingsResponse = await fetch(
      `https://api.zoom.us/v2/users/me/recordings?from=${fromDate.toISOString().split('T')[0]}&to=${toDate.toISOString().split('T')[0]}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!recordingsResponse.ok) {
      const errText = await recordingsResponse.text();
      console.error('Zoom recordings error:', errText);
      return res.status(500).json({ error: 'Failed to fetch Zoom recordings' });
    }

    const recordingsData = await recordingsResponse.json();
    const meetings = recordingsData.meetings || [];

    console.log(`Found ${meetings.length} Zoom recordings`);

    let newlyProcessed = 0;
    let notesExtracted = 0;
    let matched = 0;

    for (const meeting of meetings) {
      const meetingId = meeting.uuid;
      if (processedIds.has(meetingId)) continue;

      // Find transcript file
      const transcriptFile = meeting.recording_files?.find(f =>
        f.file_type === 'TRANSCRIPT' || f.recording_type === 'audio_transcript'
      );

      if (!transcriptFile) continue;

      // Download transcript
      let transcriptText = '';
      try {
        const transcriptResponse = await fetch(
          `${transcriptFile.download_url}?access_token=${accessToken}`
        );
        transcriptText = await transcriptResponse.text();
      } catch (err) {
        console.error('Error downloading transcript:', err);
        continue;
      }

      // Get participant names from meeting topic and transcript
      const participantNames = [];
      if (meeting.topic) {
        // Extract names from topic (e.g., "Meeting with Sarah & John")
        const topicNames = meeting.topic.match(/\b[A-Z][a-z]+\b/g) || [];
        participantNames.push(...topicNames.map(n => n.toLowerCase()));
      }

      // Try to match to a wedding
      let matchedWeddingId = null;
      for (const name of participantNames) {
        if (nameToWedding[name]) {
          matchedWeddingId = nameToWedding[name];
          matched++;
          break;
        }
      }

      // Save processed meeting
      await supabase.from('processed_zoom_meetings').insert({
        zoom_meeting_id: meetingId,
        wedding_id: matchedWeddingId,
        meeting_topic: meeting.topic,
        participant_names: participantNames,
        transcript_text: transcriptText.substring(0, 50000)
      });

      // Extract planning notes if matched
      if (matchedWeddingId && transcriptText) {
        const notes = await extractPlanningNotes(transcriptText, null, matchedWeddingId);
        if (notes.length > 0) {
          notes.forEach(n => {
            n.source_message = `From Zoom meeting: ${meeting.topic || 'Untitled'}`;
          });
          await savePlanningNotes(notes);
          notesExtracted += notes.length;
        }
      }

      newlyProcessed++;
      processedIds.add(meetingId);
    }

    console.log(`Zoom sync: processed ${newlyProcessed} meetings, ${matched} matched, ${notesExtracted} notes extracted`);
    res.json({
      processed: newlyProcessed,
      matched,
      notesExtracted,
      message: `Synced ${newlyProcessed} meeting transcripts. ${matched} matched to clients. Extracted ${notesExtracted} planning notes.`
    });

  } catch (error) {
    console.error('Zoom sync error:', error);
    res.status(500).json({ error: 'Failed to sync Zoom: ' + error.message });
  }
});

// Disconnect Zoom
app.post('/api/zoom/disconnect', async (req, res) => {
  try {
    await supabase.from('zoom_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ============ UNCERTAIN QUESTIONS (Admin) ============

// Get all uncertain questions (optionally filter by wedding)
app.get('/api/uncertain-questions', async (req, res) => {
  try {
    const { weddingId, unansweredOnly } = req.query;

    let query = supabase
      .from('uncertain_questions')
      .select(`
        *,
        weddings(couple_names),
        profiles(name, email)
      `)
      .order('created_at', { ascending: false });

    if (weddingId) {
      query = query.eq('wedding_id', weddingId);
    }

    if (unansweredOnly === 'true') {
      query = query.is('admin_answer', null);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ questions: data || [] });
  } catch (error) {
    console.error('Get uncertain questions error:', error);
    res.status(500).json({ error: 'Failed to get questions' });
  }
});

// Get count of unanswered questions
app.get('/api/uncertain-questions/count', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('uncertain_questions')
      .select('*', { count: 'exact', head: true })
      .is('admin_answer', null);

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (error) {
    console.error('Count error:', error);
    res.status(500).json({ error: 'Failed to count questions' });
  }
});

// Answer a question and optionally add to knowledge base
app.post('/api/uncertain-questions/:id/answer', async (req, res) => {
  try {
    const { id } = req.params;
    const { answer, addToKnowledgeBase, kbCategory, kbSubcategory, kbTitle } = req.body;

    if (!answer) {
      return res.status(400).json({ error: 'Answer is required' });
    }

    // Update the question with the answer
    const { data: question, error: updateError } = await supabase
      .from('uncertain_questions')
      .update({
        admin_answer: answer,
        answered_at: new Date().toISOString(),
        answered_by: 'admin',
        added_to_kb: addToKnowledgeBase || false,
        kb_category: kbCategory || null,
        kb_subcategory: kbSubcategory || null
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // If requested, add to knowledge base
    if (addToKnowledgeBase && kbCategory) {
      const { error: kbError } = await supabase
        .from('knowledge_base')
        .insert({
          title: kbTitle || question.question.substring(0, 100),
          category: kbCategory,
          subcategory: kbSubcategory || 'General',
          content: answer
        });

      if (kbError) {
        console.error('KB insert error:', kbError);
      } else {
        console.log('Answer added to knowledge base');
      }
    }

    res.json({ question, success: true });
  } catch (error) {
    console.error('Answer question error:', error);
    res.status(500).json({ error: 'Failed to save answer' });
  }
});

// Delete an uncertain question
app.delete('/api/uncertain-questions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('uncertain_questions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// ============ VENDOR CHECKLIST ============

// Vendor types for reference
const VENDOR_TYPES = [
  'Photographer', 'Videographer', 'Caterer', 'Florist', 'DJ', 'Band',
  'Officiant', 'Cake/Dessert', 'Hair', 'Makeup', 'Coordinator', 'Rentals', 'Transportation'
];

// Get all vendors for a wedding
app.get('/api/vendors/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { data, error } = await supabase
      .from('vendor_checklist')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ vendors: data || [], vendorTypes: VENDOR_TYPES });
  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({ error: 'Failed to get vendors' });
  }
});

// Create or update vendor
app.post('/api/vendors', async (req, res) => {
  try {
    const { id, weddingId, vendorType, vendorName, vendorContact, notes, isBooked } = req.body;

    if (!weddingId || !vendorType) {
      return res.status(400).json({ error: 'Wedding ID and vendor type required' });
    }

    if (id) {
      // Update existing
      const { data, error } = await supabase
        .from('vendor_checklist')
        .update({
          vendor_type: vendorType,
          vendor_name: vendorName || null,
          vendor_contact: vendorContact || null,
          notes: notes || null,
          is_booked: isBooked || false
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ vendor: data });
    } else {
      // Create new
      const { data, error } = await supabase
        .from('vendor_checklist')
        .insert({
          wedding_id: weddingId,
          vendor_type: vendorType,
          vendor_name: vendorName || null,
          vendor_contact: vendorContact || null,
          notes: notes || null,
          is_booked: isBooked || false
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ vendor: data });
    }
  } catch (error) {
    console.error('Save vendor error:', error);
    res.status(500).json({ error: 'Failed to save vendor' });
  }
});

// Delete vendor
app.delete('/api/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('vendor_checklist')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

// Upload vendor contract
app.post('/api/vendors/:id/contract', upload.single('contract'), async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get the vendor to find wedding_id
    const { data: vendor } = await supabase
      .from('vendor_checklist')
      .select('wedding_id, vendor_type')
      .eq('id', id)
      .single();

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Upload to Supabase Storage
    const fileName = `${vendor.wedding_id}/${id}_${Date.now()}_${file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('vendor-contracts')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file' });
    }

    // Generate signed URL (expires in 1 year)
    const { data: signedUrlData, error: signedError } = await supabaseAdmin.storage
      .from('vendor-contracts')
      .createSignedUrl(fileName, 31536000); // 1 year in seconds

    if (signedError) {
      console.error('Signed URL error:', signedError);
      return res.status(500).json({ error: 'Failed to generate URL' });
    }

    // Update vendor record
    const { data, error } = await supabase
      .from('vendor_checklist')
      .update({
        contract_uploaded: true,
        contract_url: signedUrlData.signedUrl,
        contract_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Also extract planning notes from the contract (async, don't block response)
    (async () => {
      try {
        const base64Data = file.buffer.toString('base64');
        const isPdf = file.mimetype === 'application/pdf';

        // Extract full text and save to contracts table
        const textResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          messages: [{
            role: 'user',
            content: isPdf ? [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
              { type: 'text', text: 'Extract ALL text from this document exactly as it appears. Return only the text.' }
            ] : [
              { type: 'image', source: { type: 'base64', media_type: file.mimetype, data: base64Data } },
              { type: 'text', text: 'Extract ALL text from this image exactly as it appears. Return only the text.' }
            ]
          }]
        });

        await supabase.from('contracts').insert({
          wedding_id: vendor.wedding_id,
          filename: file.originalname,
          file_type: file.mimetype,
          extracted_text: textResponse.content[0].text
        });

        // Extract planning notes
        const extractionPrompt = `Extract key planning details from this vendor contract as a JSON array. For each item include:
- category: one of "vendor", "vendor_contact", "timeline", "cost", "note"
- content: brief description

Focus on: vendor name, contact info (phone/email), costs, payment schedules, dates, deadlines, special requirements.
Return ONLY a valid JSON array like: [{"category": "vendor", "content": "Photographer: Jane Smith"}]`;

        const notesResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: isPdf ? [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
              { type: 'text', text: extractionPrompt }
            ] : [
              { type: 'image', source: { type: 'base64', media_type: file.mimetype, data: base64Data } },
              { type: 'text', text: extractionPrompt }
            ]
          }]
        });

        const notesText = notesResponse.content[0].text;
        const jsonMatch = notesText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const extractedNotes = JSON.parse(jsonMatch[0]);
          if (extractedNotes.length > 0) {
            const notesToSave = extractedNotes.map(note => ({
              wedding_id: vendor.wedding_id,
              category: note.category || 'note',
              content: note.content,
              source_message: `Extracted from ${vendor.vendor_type} contract: ${file.originalname}`,
              status: 'pending'
            }));
            await supabase.from('planning_notes').insert(notesToSave);
            console.log(`Extracted ${notesToSave.length} planning notes from vendor contract upload`);
          }
        }
      } catch (extractErr) {
        console.error('Error extracting notes from vendor contract:', extractErr);
      }
    })();

    res.json({ vendor: data });
  } catch (error) {
    console.error('Contract upload error:', error);
    res.status(500).json({ error: 'Failed to upload contract' });
  }
});

// Remove vendor contract
app.delete('/api/vendors/:id/contract', async (req, res) => {
  try {
    const { id } = req.params;

    // Get current contract URL to delete from storage
    const { data: vendor } = await supabase
      .from('vendor_checklist')
      .select('contract_url')
      .eq('id', id)
      .single();

    if (vendor?.contract_url) {
      // Extract path from URL and delete from storage
      const urlParts = vendor.contract_url.split('/vendor-contracts/');
      if (urlParts[1]) {
        await supabaseAdmin.storage.from('vendor-contracts').remove([urlParts[1]]);
      }
    }

    // Update vendor record
    const { data, error } = await supabase
      .from('vendor_checklist')
      .update({
        contract_uploaded: false,
        contract_url: null,
        contract_date: null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ vendor: data });
  } catch (error) {
    console.error('Remove contract error:', error);
    res.status(500).json({ error: 'Failed to remove contract' });
  }
});

// ============ INSPO GALLERY ============

const MAX_INSPO_IMAGES = 20;

// Get inspo gallery for a wedding
app.get('/api/inspo/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { data, error } = await supabase
      .from('inspo_gallery')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    res.json({ images: data || [], maxImages: MAX_INSPO_IMAGES });
  } catch (error) {
    console.error('Get inspo error:', error);
    res.status(500).json({ error: 'Failed to get inspiration images' });
  }
});

// Upload inspo image
app.post('/api/inspo', upload.single('image'), async (req, res) => {
  try {
    const { weddingId, caption, uploadedBy } = req.body;
    const file = req.file;

    if (!file || !weddingId) {
      return res.status(400).json({ error: 'File and wedding ID required' });
    }

    // Check count limit
    const { count } = await supabase
      .from('inspo_gallery')
      .select('*', { count: 'exact', head: true })
      .eq('wedding_id', weddingId);

    if (count >= MAX_INSPO_IMAGES) {
      return res.status(400).json({ error: `Maximum ${MAX_INSPO_IMAGES} images allowed` });
    }

    // Upload to storage
    const fileName = `${weddingId}/${Date.now()}_${file.originalname}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('inspo-gallery')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype
      });

    if (uploadError) throw uploadError;

    // Generate signed URL (expires in 1 year)
    const { data: signedUrlData, error: signedError } = await supabaseAdmin.storage
      .from('inspo-gallery')
      .createSignedUrl(fileName, 31536000);

    if (signedError) throw signedError;

    // If no caption provided, generate one with AI
    let finalCaption = caption;
    const base64Data = file.buffer.toString('base64');

    if (!caption) {
      try {
        const captionResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 50,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: file.mimetype, data: base64Data } },
              { type: 'text', text: 'Describe this wedding inspiration image in 5-10 words for a gallery caption. Be specific about colors, style, or elements shown.' }
            ]
          }]
        });
        finalCaption = captionResponse.content[0].text;
      } catch (captionErr) {
        console.error('Caption generation error:', captionErr);
      }
    }

    // Create record
    const { data, error } = await supabase
      .from('inspo_gallery')
      .insert({
        wedding_id: weddingId,
        image_url: signedUrlData.signedUrl,
        caption: finalCaption || null,
        uploaded_by: uploadedBy || null,
        display_order: count || 0
      })
      .select()
      .single();

    if (error) throw error;

    // Extract planning notes from the image (async, don't block response)
    (async () => {
      try {
        const notesResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: file.mimetype, data: base64Data } },
              { type: 'text', text: `Analyze this wedding inspiration image and extract any planning-relevant details as a JSON array. Look for:
- Color palette/scheme
- Decor style (rustic, modern, bohemian, etc.)
- Specific elements (flowers, centerpieces, lighting, etc.)
- Theme ideas

For each detail found, create an object with:
- category: one of "colors", "decor", "note"
- content: brief description

Return ONLY a valid JSON array. If no planning details are visible, return [].
Example: [{"category": "colors", "content": "Color palette: dusty rose, sage green, cream"}, {"category": "decor", "content": "Style: rustic bohemian with greenery garlands"}]` }
            ]
          }]
        });

        const notesText = notesResponse.content[0].text;
        const jsonMatch = notesText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const extractedNotes = JSON.parse(jsonMatch[0]);
          if (extractedNotes.length > 0) {
            const notesToSave = extractedNotes.map(note => ({
              wedding_id: weddingId,
              category: note.category || 'decor',
              content: note.content,
              source_message: `From inspiration image: ${finalCaption || file.originalname}`,
              status: 'pending'
            }));
            await supabase.from('planning_notes').insert(notesToSave);
            console.log(`Extracted ${notesToSave.length} planning notes from inspo image`);
          }
        }
      } catch (notesErr) {
        console.error('Error extracting notes from inspo image:', notesErr);
      }
    })();

    res.json({ image: data });
  } catch (error) {
    console.error('Upload inspo error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Update inspo caption/order
app.put('/api/inspo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, displayOrder } = req.body;

    const updates = {};
    if (caption !== undefined) updates.caption = caption;
    if (displayOrder !== undefined) updates.display_order = displayOrder;

    const { data, error } = await supabase
      .from('inspo_gallery')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ image: data });
  } catch (error) {
    console.error('Update inspo error:', error);
    res.status(500).json({ error: 'Failed to update image' });
  }
});

// Delete inspo image
app.delete('/api/inspo/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get image URL to delete from storage
    const { data: image } = await supabase
      .from('inspo_gallery')
      .select('image_url')
      .eq('id', id)
      .single();

    if (image?.image_url) {
      const urlParts = image.image_url.split('/inspo-gallery/');
      if (urlParts[1]) {
        await supabaseAdmin.storage.from('inspo-gallery').remove([urlParts[1]]);
      }
    }

    const { error } = await supabase
      .from('inspo_gallery')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Delete inspo error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// ============ COUPLE PHOTO ============

// Get couple photo
app.get('/api/couple-photo/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { data, error } = await supabase
      .from('couple_photos')
      .select('*')
      .eq('wedding_id', weddingId)
      .single();

    // Not finding a photo is okay
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ photo: data || null });
  } catch (error) {
    console.error('Get couple photo error:', error);
    res.status(500).json({ error: 'Failed to get photo' });
  }
});

// Upload/replace couple photo
app.post('/api/couple-photo', upload.single('photo'), async (req, res) => {
  try {
    const { weddingId, uploadedBy } = req.body;
    const file = req.file;

    if (!file || !weddingId) {
      return res.status(400).json({ error: 'File and wedding ID required' });
    }

    // Check if photo already exists
    const { data: existing } = await supabase
      .from('couple_photos')
      .select('id, image_url')
      .eq('wedding_id', weddingId)
      .single();

    // Delete old image from storage if exists
    if (existing?.image_url) {
      const urlParts = existing.image_url.split('/couple-photos/');
      if (urlParts[1]) {
        await supabaseAdmin.storage.from('couple-photos').remove([urlParts[1]]);
      }
    }

    // Upload new image
    const fileName = `${weddingId}/${Date.now()}_${file.originalname}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('couple-photos')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype
      });

    if (uploadError) throw uploadError;

    // Generate signed URL (expires in 1 year)
    const { data: signedUrlData, error: signedError } = await supabaseAdmin.storage
      .from('couple-photos')
      .createSignedUrl(fileName, 31536000);

    if (signedError) throw signedError;

    let data;
    if (existing) {
      // Update existing
      const { data: updated, error } = await supabase
        .from('couple_photos')
        .update({
          image_url: signedUrlData.signedUrl,
          uploaded_by: uploadedBy || null
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      data = updated;
    } else {
      // Create new
      const { data: created, error } = await supabase
        .from('couple_photos')
        .insert({
          wedding_id: weddingId,
          image_url: signedUrlData.signedUrl,
          uploaded_by: uploadedBy || null
        })
        .select()
        .single();

      if (error) throw error;
      data = created;
    }

    res.json({ photo: data });
  } catch (error) {
    console.error('Upload couple photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Delete couple photo
app.delete('/api/couple-photo/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    // Get photo to delete from storage
    const { data: photo } = await supabase
      .from('couple_photos')
      .select('image_url')
      .eq('wedding_id', weddingId)
      .single();

    if (photo?.image_url) {
      const urlParts = photo.image_url.split('/couple-photos/');
      if (urlParts[1]) {
        await supabaseAdmin.storage.from('couple-photos').remove([urlParts[1]]);
      }
    }

    const { error } = await supabase
      .from('couple_photos')
      .delete()
      .eq('wedding_id', weddingId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Delete couple photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// ============ PLANNING CHECKLIST ============

// Default checklist tasks
const DEFAULT_CHECKLIST_TASKS = [
  { task_text: 'Book venue', category: 'Venue', display_order: 1 },
  { task_text: 'Schedule venue walkthrough', category: 'Venue', display_order: 2 },
  { task_text: 'Book photographer', category: 'Vendors', display_order: 3 },
  { task_text: 'Book videographer', category: 'Vendors', display_order: 4 },
  { task_text: 'Book caterer', category: 'Vendors', display_order: 5 },
  { task_text: 'Book florist', category: 'Vendors', display_order: 6 },
  { task_text: 'Book DJ or band', category: 'Vendors', display_order: 7 },
  { task_text: 'Book officiant', category: 'Vendors', display_order: 8 },
  { task_text: 'Book hair stylist', category: 'Attire & Beauty', display_order: 9 },
  { task_text: 'Book makeup artist', category: 'Attire & Beauty', display_order: 10 },
  { task_text: 'Order wedding dress/attire', category: 'Attire & Beauty', display_order: 11 },
  { task_text: 'Order wedding rings', category: 'Attire & Beauty', display_order: 12 },
  { task_text: 'Choose ceremony music', category: 'Timeline', display_order: 13 },
  { task_text: 'Create day-of timeline', category: 'Timeline', display_order: 14 },
  { task_text: 'Finalize seating chart', category: 'Guests', display_order: 15 },
  { task_text: 'Send invitations', category: 'Guests', display_order: 16 },
  { task_text: 'Collect RSVPs', category: 'Guests', display_order: 17 },
  { task_text: 'Plan rehearsal dinner', category: 'Timeline', display_order: 18 },
  { task_text: 'Book transportation', category: 'Vendors', display_order: 19 },
  { task_text: 'Order cake/desserts', category: 'Vendors', display_order: 20 },
  { task_text: 'Choose table linens', category: 'Decor', display_order: 21 },
  { task_text: 'Select centerpieces', category: 'Decor', display_order: 22 },
  { task_text: 'Plan ceremony decor', category: 'Decor', display_order: 23 },
  { task_text: 'Get marriage license', category: 'Other', display_order: 24 },
  { task_text: 'Write vows', category: 'Other', display_order: 25 },
];

// Get checklist for a wedding
app.get('/api/checklist/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { data, error } = await supabase
      .from('planning_checklist')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    res.json({ tasks: data || [] });
  } catch (error) {
    console.error('Get checklist error:', error);
    res.status(500).json({ error: 'Failed to get checklist' });
  }
});

// Initialize default checklist for a wedding
app.post('/api/checklist/initialize/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    // Check if already initialized
    const { count } = await supabase
      .from('planning_checklist')
      .select('*', { count: 'exact', head: true })
      .eq('wedding_id', weddingId);

    if (count > 0) {
      return res.json({ message: 'Checklist already initialized', initialized: false });
    }

    // Create default tasks
    const tasks = DEFAULT_CHECKLIST_TASKS.map(task => ({
      ...task,
      wedding_id: weddingId,
      is_custom: false
    }));

    const { data, error } = await supabase
      .from('planning_checklist')
      .insert(tasks)
      .select();

    if (error) throw error;
    res.json({ tasks: data, initialized: true });
  } catch (error) {
    console.error('Initialize checklist error:', error);
    res.status(500).json({ error: 'Failed to initialize checklist' });
  }
});

// Add custom task
app.post('/api/checklist', async (req, res) => {
  try {
    const { weddingId, taskText, category, dueDate } = req.body;

    if (!weddingId || !taskText) {
      return res.status(400).json({ error: 'Wedding ID and task text required' });
    }

    // Get max display order
    const { data: maxOrder } = await supabase
      .from('planning_checklist')
      .select('display_order')
      .eq('wedding_id', weddingId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from('planning_checklist')
      .insert({
        wedding_id: weddingId,
        task_text: taskText,
        category: category || 'Other',
        due_date: dueDate || null,
        is_custom: true,
        display_order: (maxOrder?.display_order || 0) + 1
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ task: data });
  } catch (error) {
    console.error('Add task error:', error);
    res.status(500).json({ error: 'Failed to add task' });
  }
});

// Update task (toggle complete, edit text, etc.)
app.put('/api/checklist/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isCompleted, completedBy, completedVia, taskText, category, dueDate } = req.body;

    const updates = {};

    if (isCompleted !== undefined) {
      updates.is_completed = isCompleted;
      if (isCompleted) {
        updates.completed_at = new Date().toISOString();
        if (completedBy) updates.completed_by = completedBy;
        if (completedVia) updates.completed_via = completedVia;
      } else {
        updates.completed_at = null;
        updates.completed_by = null;
        updates.completed_via = null;
      }
    }

    if (taskText !== undefined) updates.task_text = taskText;
    if (category !== undefined) updates.category = category;
    if (dueDate !== undefined) updates.due_date = dueDate;

    const { data, error } = await supabase
      .from('planning_checklist')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ task: data });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task (only custom tasks)
app.delete('/api/checklist/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow deleting custom tasks
    const { data: task } = await supabase
      .from('planning_checklist')
      .select('is_custom')
      .eq('id', id)
      .single();

    if (!task?.is_custom) {
      return res.status(400).json({ error: 'Cannot delete default tasks' });
    }

    const { error } = await supabase
      .from('planning_checklist')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ============ SAGE CHECKLIST AUTO-DETECTION ============

// Find matching checklist task for a completion phrase
async function findMatchingChecklistTask(weddingId, completionPhrase) {
  const { data: tasks } = await supabase
    .from('planning_checklist')
    .select('id, task_text, is_completed')
    .eq('wedding_id', weddingId)
    .eq('is_completed', false);

  if (!tasks || tasks.length === 0) return null;

  const phrase = completionPhrase.toLowerCase();

  // Common mappings
  const mappings = {
    'photographer': ['book photographer', 'photographer'],
    'videographer': ['book videographer', 'videographer'],
    'caterer': ['book caterer', 'caterer', 'catering'],
    'florist': ['book florist', 'florist', 'flowers'],
    'dj': ['book dj', 'dj', 'music'],
    'band': ['book dj or band', 'band', 'music'],
    'officiant': ['book officiant', 'officiant'],
    'hair': ['book hair', 'hair stylist', 'hair'],
    'makeup': ['book makeup', 'makeup artist', 'makeup'],
    'cake': ['order cake', 'cake', 'dessert'],
    'invitations': ['send invitations', 'invitations', 'invites'],
    'dress': ['order wedding dress', 'dress', 'gown'],
    'rings': ['order wedding rings', 'rings'],
    'transportation': ['book transportation', 'transportation', 'shuttle'],
    'license': ['get marriage license', 'marriage license', 'license'],
    'vows': ['write vows', 'vows'],
    'seating': ['finalize seating', 'seating chart', 'seating'],
    'timeline': ['create day-of timeline', 'timeline'],
    'rehearsal': ['plan rehearsal dinner', 'rehearsal dinner', 'rehearsal'],
  };

  // Find best match
  for (const [key, phrases] of Object.entries(mappings)) {
    if (phrase.includes(key)) {
      const matchedTask = tasks.find(t =>
        phrases.some(p => t.task_text.toLowerCase().includes(p))
      );
      if (matchedTask) return matchedTask;
    }
  }

  // Fuzzy match: check if any task contains words from the phrase
  const words = phrase.split(/\s+/).filter(w => w.length > 3);
  for (const task of tasks) {
    const taskLower = task.task_text.toLowerCase();
    if (words.some(word => taskLower.includes(word))) {
      return task;
    }
  }

  return null;
}

// Mark task complete via Sage
app.post('/api/checklist/sage-complete', async (req, res) => {
  try {
    const { weddingId, taskId, completedBy } = req.body;

    const { data, error } = await supabase
      .from('planning_checklist')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        completed_by: completedBy || null,
        completed_via: 'sage'
      })
      .eq('id', taskId)
      .eq('wedding_id', weddingId)
      .select()
      .single();

    if (error) throw error;
    res.json({ task: data, success: true });
  } catch (error) {
    console.error('Sage complete error:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Check for matching task (used by Sage to offer to mark complete)
app.post('/api/checklist/find-match', async (req, res) => {
  try {
    const { weddingId, phrase } = req.body;

    const task = await findMatchingChecklistTask(weddingId, phrase);
    res.json({ task: task || null });
  } catch (error) {
    console.error('Find match error:', error);
    res.status(500).json({ error: 'Failed to find matching task' });
  }
});

// ============ USAGE STATS (Admin) ============

// Get usage stats for all weddings
app.get('/api/usage/stats', async (req, res) => {
  try {
    // Get usage grouped by wedding
    const { data: usage, error } = await supabase
      .from('usage_logs')
      .select('wedding_id, input_tokens, output_tokens, endpoint, created_at');

    if (error) throw error;

    // Group by wedding and calculate totals
    const weddingStats = {};
    (usage || []).forEach(log => {
      const wid = log.wedding_id || 'unknown';
      if (!weddingStats[wid]) {
        weddingStats[wid] = {
          wedding_id: wid,
          total_input_tokens: 0,
          total_output_tokens: 0,
          total_requests: 0,
          endpoints: {}
        };
      }
      weddingStats[wid].total_input_tokens += log.input_tokens || 0;
      weddingStats[wid].total_output_tokens += log.output_tokens || 0;
      weddingStats[wid].total_requests += 1;
      weddingStats[wid].endpoints[log.endpoint] = (weddingStats[wid].endpoints[log.endpoint] || 0) + 1;
    });

    // Calculate costs
    Object.values(weddingStats).forEach(stats => {
      stats.estimated_cost = calculateCost(stats.total_input_tokens, stats.total_output_tokens);
    });

    res.json({ stats: Object.values(weddingStats) });
  } catch (error) {
    console.error('Usage stats error:', error);
    res.status(500).json({ error: 'Failed to get usage stats' });
  }
});

// Get usage for a specific wedding
app.get('/api/usage/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { data: usage, error } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calculate totals
    let totalInput = 0, totalOutput = 0;
    (usage || []).forEach(log => {
      totalInput += log.input_tokens || 0;
      totalOutput += log.output_tokens || 0;
    });

    res.json({
      logs: usage || [],
      totals: {
        input_tokens: totalInput,
        output_tokens: totalOutput,
        total_requests: (usage || []).length,
        estimated_cost: calculateCost(totalInput, totalOutput)
      }
    });
  } catch (error) {
    console.error('Wedding usage error:', error);
    res.status(500).json({ error: 'Failed to get wedding usage' });
  }
});

// ============ KNOWLEDGE BASE ADMIN ============

// Get all knowledge base entries
app.get('/api/knowledge-base', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('category')
      .order('subcategory');

    if (error) throw error;
    res.json({ entries: data || [] });
  } catch (error) {
    console.error('Get KB error:', error);
    res.status(500).json({ error: 'Failed to get knowledge base' });
  }
});

// Create knowledge base entry
app.post('/api/knowledge-base', async (req, res) => {
  try {
    const { title, category, subcategory, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }

    const { data, error } = await supabase
      .from('knowledge_base')
      .insert({
        title,
        category: category || 'general',
        subcategory: subcategory || null,
        content,
        active: true
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ entry: data });
  } catch (error) {
    console.error('Create KB error:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// Update knowledge base entry
app.put('/api/knowledge-base/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, subcategory, content, active } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (category !== undefined) updates.category = category;
    if (subcategory !== undefined) updates.subcategory = subcategory;
    if (content !== undefined) updates.content = content;
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabase
      .from('knowledge_base')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ entry: data });
  } catch (error) {
    console.error('Update KB error:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// Delete knowledge base entry
app.delete('/api/knowledge-base/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Delete KB error:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// ============ ONBOARDING PROGRESS ============

// Get onboarding progress for a wedding
app.get('/api/onboarding/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    // Get or create onboarding record
    let { data, error } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('wedding_id', weddingId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Not found, create it
      const { data: newData, error: insertError } = await supabase
        .from('onboarding_progress')
        .insert({ wedding_id: weddingId })
        .select()
        .single();

      if (insertError) throw insertError;
      data = newData;
    } else if (error) {
      throw error;
    }

    // Also check actual progress from related tables
    const [couplePhoto, messages, vendors, inspo, checklist] = await Promise.all([
      supabase.from('couple_photos').select('id').eq('wedding_id', weddingId).single(),
      supabase.from('messages').select('id').eq('wedding_id', weddingId).limit(1),
      supabase.from('vendor_checklist').select('id').eq('wedding_id', weddingId).limit(1),
      supabase.from('inspo_gallery').select('id').eq('wedding_id', weddingId).limit(1),
      supabase.from('planning_checklist').select('id').eq('wedding_id', weddingId).eq('is_completed', true).limit(1)
    ]);

    // Update progress based on actual data
    const actualProgress = {
      couple_photo_uploaded: !!couplePhoto.data,
      first_message_sent: !!(messages.data && messages.data.length > 0),
      vendor_added: !!(vendors.data && vendors.data.length > 0),
      inspo_uploaded: !!(inspo.data && inspo.data.length > 0),
      checklist_item_completed: !!(checklist.data && checklist.data.length > 0)
    };

    // Merge with stored progress (stored progress tracks dismissal)
    const progress = {
      ...data,
      ...actualProgress
    };

    res.json({ progress });
  } catch (error) {
    console.error('Get onboarding error:', error);
    res.status(500).json({ error: 'Failed to get onboarding progress' });
  }
});

// Update onboarding progress (mainly for dismissal)
app.put('/api/onboarding/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;
    const { onboarding_dismissed } = req.body;

    const { data, error } = await supabase
      .from('onboarding_progress')
      .upsert({
        wedding_id: weddingId,
        onboarding_dismissed: onboarding_dismissed || false,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ progress: data });
  } catch (error) {
    console.error('Update onboarding error:', error);
    res.status(500).json({ error: 'Failed to update onboarding' });
  }
});

// ============ CALENDLY INTEGRATION ============

// Get upcoming Calendly events
app.get('/api/calendly/events', async (req, res) => {
  try {
    const token = process.env.CALENDLY_API_TOKEN;
    if (!token) {
      return res.status(400).json({ error: 'Calendly API token not configured' });
    }

    // First, get the current user to get their URI
    const userResponse = await fetch('https://api.calendly.com/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch Calendly user');
    }

    const userData = await userResponse.json();
    const userUri = userData.resource.uri;

    // Get scheduled events (upcoming only)
    const now = new Date().toISOString();
    const eventsResponse = await fetch(
      `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(userUri)}&min_start_time=${now}&status=active&count=50`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!eventsResponse.ok) {
      throw new Error('Failed to fetch Calendly events');
    }

    const eventsData = await eventsResponse.json();

    // For each event, get invitee details
    const eventsWithInvitees = await Promise.all(
      eventsData.collection.map(async (event) => {
        try {
          const inviteesResponse = await fetch(
            `${event.uri}/invitees`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (inviteesResponse.ok) {
            const inviteesData = await inviteesResponse.json();
            return {
              ...event,
              invitees: inviteesData.collection
            };
          }
        } catch (err) {
          console.error('Error fetching invitees:', err);
        }
        return { ...event, invitees: [] };
      })
    );

    res.json({ events: eventsWithInvitees });
  } catch (error) {
    console.error('Calendly API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single event details
app.get('/api/calendly/events/:eventUuid', async (req, res) => {
  try {
    const token = process.env.CALENDLY_API_TOKEN;
    if (!token) {
      return res.status(400).json({ error: 'Calendly API token not configured' });
    }

    const { eventUuid } = req.params;

    const eventResponse = await fetch(
      `https://api.calendly.com/scheduled_events/${eventUuid}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!eventResponse.ok) {
      throw new Error('Failed to fetch event details');
    }

    const eventData = await eventResponse.json();
    res.json(eventData);
  } catch (error) {
    console.error('Calendly event fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ DIRECT MESSAGING ============

// Get messages for a wedding
app.get('/api/messages/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ messages: data });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a new message
app.post('/api/messages', async (req, res) => {
  try {
    const { weddingId, senderId, senderType, content } = req.body;

    if (!weddingId || !content || !senderType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('direct_messages')
      .insert({
        wedding_id: weddingId,
        sender_id: senderId || null,
        sender_type: senderType,
        content: content.trim()
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ message: data });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark messages as read
app.put('/api/messages/read/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;
    const { senderType } = req.body; // Mark messages FROM this sender type as read

    const { data, error } = await supabase
      .from('direct_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('wedding_id', weddingId)
      .eq('sender_type', senderType)
      .eq('is_read', false)
      .select();

    if (error) throw error;
    res.json({ updated: data?.length || 0 });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Get unread count for a wedding (client view - counts admin messages)
app.get('/api/messages/unread/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { count, error } = await supabase
      .from('direct_messages')
      .select('*', { count: 'exact', head: true })
      .eq('wedding_id', weddingId)
      .eq('sender_type', 'admin')
      .eq('is_read', false);

    if (error) throw error;
    res.json({ unread: count || 0 });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Get all unread counts for admin (counts client messages per wedding)
app.get('/api/messages/admin/unread', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('wedding_id')
      .eq('sender_type', 'client')
      .eq('is_read', false);

    if (error) throw error;

    // Count per wedding
    const counts = {};
    data?.forEach(msg => {
      counts[msg.wedding_id] = (counts[msg.wedding_id] || 0) + 1;
    });

    const total = data?.length || 0;
    res.json({ total, byWedding: counts });
  } catch (error) {
    console.error('Admin unread error:', error);
    res.status(500).json({ error: 'Failed to get unread counts' });
  }
});

// Get all conversations for admin (latest message per wedding)
app.get('/api/messages/admin/conversations', async (req, res) => {
  try {
    // Get all messages grouped by wedding, with latest first
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by wedding and get latest + unread count
    const conversations = {};
    data?.forEach(msg => {
      if (!conversations[msg.wedding_id]) {
        conversations[msg.wedding_id] = {
          wedding_id: msg.wedding_id,
          latest_message: msg,
          unread_count: 0
        };
      }
      if (msg.sender_type === 'client' && !msg.is_read) {
        conversations[msg.wedding_id].unread_count++;
      }
    });

    res.json({ conversations: Object.values(conversations) });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// ============ PLANNING TOOLS ============

// Get wedding timeline
app.get('/api/timeline/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { data, error } = await supabase
      .from('wedding_timeline')
      .select('*')
      .eq('wedding_id', weddingId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ timeline: data || null });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// Save wedding timeline
app.post('/api/timeline', async (req, res) => {
  try {
    const { weddingId, timelineData, ceremonyStart, receptionStart, receptionEnd, notes } = req.body;

    const { data, error } = await supabase
      .from('wedding_timeline')
      .upsert({
        wedding_id: weddingId,
        timeline_data: timelineData || {},
        ceremony_start: ceremonyStart,
        reception_start: receptionStart,
        reception_end: receptionEnd,
        notes,
        updated_at: new Date().toISOString()
      }, { onConflict: 'wedding_id' })
      .select()
      .single();

    if (error) throw error;
    res.json({ timeline: data });
  } catch (error) {
    console.error('Save timeline error:', error);
    res.status(500).json({ error: 'Failed to save timeline' });
  }
});

// Get wedding table setup
app.get('/api/tables/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { data, error } = await supabase
      .from('wedding_tables')
      .select('*')
      .eq('wedding_id', weddingId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ tables: data || null });
  } catch (error) {
    console.error('Get tables error:', error);
    res.status(500).json({ error: 'Failed to fetch table setup' });
  }
});

// Save wedding table setup
app.post('/api/tables', async (req, res) => {
  try {
    const {
      weddingId, guestCount, tableShape, guestsPerTable,
      headTable, headTableSize, sweetheartTable,
      cocktailTables, kidsTable, kidsCount,
      layoutNotes, linenColor, napkinColor,
      tableNumbersStyle, centerpieceNotes, extraTables
    } = req.body;

    const { data, error } = await supabase
      .from('wedding_tables')
      .upsert({
        wedding_id: weddingId,
        guest_count: guestCount,
        table_shape: tableShape,
        guests_per_table: guestsPerTable,
        head_table: headTable,
        head_table_size: headTableSize,
        sweetheart_table: sweetheartTable,
        cocktail_tables: cocktailTables,
        kids_table: kidsTable,
        kids_count: kidsCount,
        layout_notes: layoutNotes,
        linen_color: linenColor,
        napkin_color: napkinColor,
        table_numbers_style: tableNumbersStyle,
        centerpiece_notes: centerpieceNotes,
        extra_tables: extraTables || {},
        updated_at: new Date().toISOString()
      }, { onConflict: 'wedding_id' })
      .select()
      .single();

    if (error) throw error;
    res.json({ tables: data });
  } catch (error) {
    console.error('Save tables error:', error);
    res.status(500).json({ error: 'Failed to save table setup' });
  }
});

// Get staffing estimate
app.get('/api/staffing/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { data, error } = await supabase
      .from('wedding_staffing')
      .select('*')
      .eq('wedding_id', weddingId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ staffing: data || null });
  } catch (error) {
    console.error('Get staffing error:', error);
    res.status(500).json({ error: 'Failed to fetch staffing estimate' });
  }
});

// Save staffing estimate
app.post('/api/staffing', async (req, res) => {
  try {
    const {
      weddingId,
      answers,
      fridayBartenders,
      fridayExtraHands,
      fridayTotal,
      saturdayBartenders,
      saturdayExtraHands,
      saturdayTotal,
      totalStaff,
      totalCost
    } = req.body;

    const { data, error } = await supabase
      .from('wedding_staffing')
      .upsert({
        wedding_id: weddingId,
        answers: answers || {},
        friday_bartenders: fridayBartenders || 0,
        friday_extra_hands: fridayExtraHands || 0,
        friday_total: fridayTotal || 0,
        saturday_bartenders: saturdayBartenders || 0,
        saturday_extra_hands: saturdayExtraHands || 0,
        saturday_total: saturdayTotal || 0,
        total_staff: totalStaff || 0,
        total_cost: totalCost || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'wedding_id' })
      .select()
      .single();

    if (error) throw error;
    res.json({ staffing: data });
  } catch (error) {
    console.error('Save staffing error:', error);
    res.status(500).json({ error: 'Failed to save staffing estimate' });
  }
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Sage backend running on port ${PORT}`);
});

// Keep the server running
server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  server.close();
  process.exit(0);
});
