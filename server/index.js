import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import multer from 'multer';
import { google } from 'googleapis';
import { Resend } from 'resend';
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

    await supabaseAdmin.from('usage_logs').insert({
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

// ============ ACTIVITY TRACKING ============

// Log client activity and update wedding last_activity
async function logActivity(weddingId, userId, activityType, details = '') {
  try {
    const now = new Date().toISOString();

    // Insert activity log
    await supabaseAdmin.from('activity_log').insert({
      wedding_id: weddingId,
      user_id: userId,
      activity_type: activityType,
      details: details,
      created_at: now
    });

    // Update wedding's last_activity timestamp
    await supabaseAdmin
      .from('weddings')
      .update({
        last_activity: now,
        last_activity_type: activityType
      })
      .eq('id', weddingId);

    console.log(`Activity logged: ${activityType} for wedding ${weddingId}`);
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

// ============ EMAIL SETUP ============

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendNotificationEmail(to, subject, bodyText, recipientType = 'admin') {
  if (!resend || !to) {
    console.log('[Email] Skipping (not configured or no recipient):', subject);
    return false;
  }
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const linkUrl = recipientType === 'client' ? `${frontendUrl}/` : `${frontendUrl}/admin`;
    const linkLabel = recipientType === 'client' ? 'Open your portal' : 'View in Admin';
    const fromName = process.env.EMAIL_FROM_NAME || 'Rixey Manor';
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'notifications@rixeymanor.com';
    const { error } = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to,
      subject,
      html: `
        <div style="font-family: Georgia, serif; max-width: 580px; margin: 0 auto; padding: 30px 20px; color: #3d3d3d; background: #fefbf7;">
          <div style="padding-bottom: 16px; margin-bottom: 24px; border-bottom: 2px solid #7C9070;">
            <span style="font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #7C9070;">Rixey Manor Planning Portal</span>
          </div>
          <p style="font-size: 16px; line-height: 1.7; margin: 0 0 24px;">${bodyText}</p>
          <a href="${linkUrl}" style="display: inline-block; background: #5C6B4F; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">${linkLabel} →</a>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e8e0d5;">
            <p style="font-size: 12px; color: #999; margin: 0;">Rapidan, VA · rixeymanor.com</p>
          </div>
        </div>
      `,
    });
    if (error) throw error;
    console.log('[Email] Sent:', subject, '→', to);
    return true;
  } catch (err) {
    console.error('[Email] Failed:', err.message);
    return false;
  }
}

// ============ NOTIFICATIONS ============

const ACTIVITY_LABELS = {
  timeline_updated:   'updated their wedding timeline',
  tables_updated:     'updated their table layout',
  floor_plan_needed:  'saved table setup — floor plan needed',
  staffing_updated:   'updated their staffing plan',
  vendor_added:       'added a new vendor',
  vendor_updated:     'updated a vendor',
  contract_uploaded:  'uploaded a vendor contract',
  checklist_completed:'completed a checklist item',
  inspo_uploaded:     'added inspiration photos',
};

async function createNotification(weddingId, recipientType, type, title, body, emailTo = null) {
  try {
    // Rate-limit: deduplicate client_activity notifications within 5 minutes per wedding
    if (type === 'client_activity') {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recent } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('wedding_id', weddingId)
        .eq('recipient_type', recipientType)
        .eq('type', 'client_activity')
        .gte('created_at', fiveMinAgo)
        .limit(1);
      if (recent?.length > 0) return;
    }

    const { data: notif, error } = await supabaseAdmin
      .from('notifications')
      .insert({ wedding_id: weddingId, recipient_type: recipientType, type, title, body })
      .select('id')
      .single();

    if (error) {
      console.error('[Notifications] Insert failed:', error.message);
      return;
    }

    if (emailTo && notif) {
      const sent = await sendNotificationEmail(emailTo, title, body || title, recipientType);
      if (sent) {
        await supabaseAdmin.from('notifications').update({ email_sent: true }).eq('id', notif.id);
      }
    }
  } catch (err) {
    console.error('[Notifications] Error:', err.message);
  }
}

// Notify admin when a client does a planning activity (rate-limited, no email)
async function notifyAdminOfActivity(weddingId, activityType, details) {
  try {
    const { data: wedding } = await supabaseAdmin
      .from('weddings')
      .select('couple_names')
      .eq('id', weddingId)
      .single();
    const couple = wedding?.couple_names || 'A couple';
    const label = ACTIVITY_LABELS[activityType] || activityType.replace(/_/g, ' ');
    await createNotification(
      weddingId, 'admin', 'client_activity',
      `${couple} ${label}`,
      details || '',
      null
    );
  } catch (err) {
    console.error('[Notifications] notifyAdminOfActivity error:', err.message);
  }
}

// Escalation keyword detection
const ESCALATION_KEYWORDS = [
  'stressed', 'stress', 'anxious', 'worried', 'frustrated', 'frustrating',
  'overwhelmed', 'urgent', 'problem', 'issue', 'wrong', 'mistake',
  'angry', 'upset', 'confused', 'lost', 'panic', 'emergency', 'asap',
  'deadline', 'behind', 'cancel', 'disaster', 'terrible', 'awful'
];

function hasEscalation(text) {
  const lower = text.toLowerCase();
  return ESCALATION_KEYWORDS.some(kw => lower.includes(kw));
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
- You are NOT a human and you are NOT a physical coordinator. You cannot be present on the wedding day, whisk anyone away, or do anything in person. Never say "me or Grace" or "I or Isadora" or refer to yourself as part of the on-site team. For anything that requires a real person, refer to **the Rixey Manor team** — only use specific names (Isadora or Grace) when it's genuinely helpful to do so.

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
- Bed linens and towels
- Scissors, lighters, emergency kit (pain relievers, sewing kit, etc.)
- Full borrow catalog of décor items at no charge — arbors, candelabras, votive holders,
  hurricane vases, cake stands, card boxes, table numbers, signs, bud vases, cheesecloth
  runners, silk florals, basket displays, vintage doors, champagne buckets, and much more.
  When someone asks about borrowing items or what decor is available, the full catalog with
  photos will be injected into your context automatically — use it to give specific answers
  and show images of the actual items.
- RIXEY PICKS: A curated set of coordinator-recommended products couples can buy online
  (disposable glassware, plates, cutlery, napkins, candles, guest books, fans, confetti,
  glow sticks, send-off ideas, welcome bags, wedding favors, cake stands, dessert displays,
  and more). Each pick is tagged Best Save, Best Splurge, Best Practical, Best Custom, or
  Best Seasonal. When someone asks what to buy, where to find something, or wants a
  product recommendation, the relevant picks with direct purchase links will be injected
  into your context automatically. Always include the affiliate link as a clickable markdown
  link when recommending a pick. Note that these are affiliate links that support Rixey Manor.

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
Be honest. Don't make things up. Point them to the right resource or suggest they reach out to the Rixey Manor team directly.

**When challenged on something you said:**
Do NOT defend your previous statement. Check your knowledge base and context first. If you find a source, cite it and correct yourself gracefully. If you can't find a source, immediately say you're not confident and direct them to confirm with the Rixey team. A graceful correction is always better than doubling down.

## FACTUAL ACCURACY — CITE YOUR SOURCES

When you state a fact about what Rixey Manor does or does not provide, include the source. This applies to: what's included, what couples need to bring, policies, pricing, staffing rates, alcohol quantities, or anything operational.

**Format:** After stating the fact, add a brief source attribution, e.g.:
- "...and we have all bar tools and garnishes on hand. *(from the Alcohol & Bar Setup guide)*"
- "...ice is something you need to bring — about 60–80 lbs per 100 guests. *(Alcohol & Bar Setup guide)*"
- "...bartenders are $350/person/day. *(2026 staffing rates)*"

If you cannot point to a specific source in your knowledge base or context, do not state the fact as certain. Instead say: "I believe X, but I'd confirm that directly with the Rixey team."

Never invent a source, quote, or guide reference. Only cite something if the actual content is in the context provided to you.

## BOUNDARIES

**Don't:**
- Give legal, tax, or contract advice ("Check with your lawyer on that one")
- Guarantee vendor availability or pricing
- Make promises on behalf of Rixey Manor ("I'd double-check that with the Rixey Manor team")
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
  const { data, error } = await supabaseAdmin
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

// Strip VTT timestamps/headers to plain conversation text
function parseVttToText(vtt) {
  return vtt
    .split('\n')
    .filter(line => {
      if (!line.trim()) return false;
      if (line.trim() === 'WEBVTT') return false;
      if (/^\d+$/.test(line.trim())) return false; // sequence numbers
      if (/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*/.test(line)) return false; // timestamps
      return true;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Rixey Manor business context for AI extraction
const RIXEY_EXTRACTION_CONTEXT = `
Rixey Manor is a wedding venue in Rapidan, VA (rural Piedmont, ~1.5 hrs from DC).
It is an all-inclusive venue: couples bring their own caterer and alcohol, Rixey provides the space, staffing, and many included décor items.
The coordinator's job is not just logistics — it's making couples feel genuinely cared for. That means noticing when something is hard, stressful, or emotionally loaded, not just what decisions have been made.

LOGISTICS TO CAPTURE:
- Ceremony location: outdoor (lawn, under oak tree), ballroom, or rooftop
- Guest count (affects staffing, table layout, bar quantities)
- Bar setup: beer & wine only vs full bar; satellite bar on patio or not; real glassware vs plastic
- Catering: caterer name, food truck, or DIY; buffet vs seated dinner
- DIETARY RESTRICTIONS AND ALLERGIES — always critical, must be flagged prominently
- Linen choices (Rixey includes ivory; upgrades cost extra)
- Whether couple is using the on-site bedrooms
- Shuttle / transportation for guests
- Rehearsal dinner plans
- Day-of timeline: ceremony time, cocktail hour, dinner, first dance, cake cutting, send-off
- Photographer, videographer, florist, DJ/band, officiant, hair & makeup
- Any unusual requests, DIY elements, or things Rixey staff need to accommodate

EMOTIONAL & PERSONAL SIGNALS TO CAPTURE — this is just as important as logistics:
- Stress or anxiety (budget pressure, overwhelmed by planning, family conflict, timeline fears)
- Grief or loss (deceased parent or loved one they want honoured, difficult anniversary, health issues)
- Family tension (divorced parents who can't be in the same room, estranged relatives, drama risk)
- Relationship dynamics (one partner more engaged in planning, cold feet mentions, external pressure)
- Financial stress (cutting corners, apologising for budget, feeling guilty about spending)
- Excitement or meaning (what the day truly means to them, a deeply personal vision or tradition)
- Vulnerability (first-time event hosts, no wedding party, eloping from large family expectations)
- Health or accessibility needs (mobility, chronic illness, mental health, pregnancy)
- External pressure (in-laws pushing preferences, cultural/religious expectations they're navigating)
- Things they're nervous to ask about or feel embarrassed by
- Anything that suggests they need extra care, reassurance, or a proactive check-in

CATEGORIES TO USE:
- vendor: photographer, videographer, florist, DJ, band, caterer, food truck, officiant, hair, makeup, rentals
- allergy: ANY dietary restriction, allergy, or food intolerance — never skip these
- guest_count: number of guests, estimates, final count
- ceremony: ceremony location, time, style, vows, processional, officiant notes
- reception: reception flow, dinner style, first dance, speeches, cake cutting, send-off
- bar: bar setup, drink choices, glassware, satellite bar, alcohol quantities
- catering: food/caterer details, menu choices, food stations
- decor: florals, centerpieces, arbor, arch, backdrop, linens, candles, lighting, rentals
- colors: color palette, style/aesthetic
- timeline: timing preferences for any part of the day
- accommodations: bedrooms, getting-ready suites, overnight guests
- shuttle: transportation, parking, shuttle service
- family: family dynamics, VIPs, mobility needs, divorced parents, estranged relationships, who needs special handling
- budget: budget constraints, financial stress, cost decisions, upgrades accepted or declined
- stress: couple is overwhelmed, anxious, or under pressure about something specific
- grief: honouring someone who passed, health issues, difficult emotional context
- relationship: partner dynamics, external pressure on the couple, what this day means to them personally
- health: accessibility needs, chronic illness, pregnancy, mental health considerations
- note: important coordinator context that doesn't fit another category
- follow_up: explicit action items or things the venue should proactively address
`;

// Unified AI-powered planning note extractor — used for all sources
async function extractPlanningNotesAI(text, weddingId, source, sourceType = 'message') {
  const cleanText = sourceType === 'transcript' ? parseVttToText(text) : text;
  if (!cleanText || cleanText.length < 20) return [];

  const isTranscript = sourceType === 'transcript' || sourceType === 'email';
  const maxLen = isTranscript ? 30000 : 2000;

  const instruction = isTranscript
    ? `Read this ${sourceType} as a thoughtful wedding coordinator would. Extract every logistics decision AND every emotional signal — stress, grief, family tension, financial worry, what this day means to them. This may be the only written record of the conversation, so be thorough.`
    : `Read this message as a thoughtful wedding coordinator. Capture any logistics decisions AND any emotional signals — worry, stress, something personally significant, or anything that suggests they need extra care.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: isTranscript ? 3000 : 800,
      messages: [{
        role: 'user',
        content: `${RIXEY_EXTRACTION_CONTEXT}

${instruction}

Return a JSON array. Each item: {"category": "<category>", "content": "<concise coordinator note>"}
Write notes the way a caring, experienced coordinator would jot them — specific and human (e.g. "Bride is stressed about her mom and future MIL being in the same room — both have strong personalities", not just "family tension").
Allergies and emotional signals are the highest priority — never skip these.
If nothing noteworthy was said, return [].
Return ONLY the JSON array.

${sourceType === 'transcript' ? 'Transcript' : sourceType === 'email' ? 'Email' : 'Message'}:
${cleanText.substring(0, maxLen)}`
      }]
    });

    const text2 = response.content[0].text.trim();
    const jsonMatch = text2.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const items = JSON.parse(jsonMatch[0]);
    return items
      .filter(item => item.category && item.content && item.content.length > 5)
      .map(item => ({
        wedding_id: weddingId,
        user_id: null,
        category: item.category,
        content: item.content.trim(),
        source_message: source || `Extracted from ${sourceType}`,
        status: 'pending'
      }));
  } catch (err) {
    console.error(`AI extraction error (${sourceType}):`, err.message);
    return [];
  }
}

// Legacy alias used by chat endpoint (short user messages)
async function extractPlanningNotes(message, userId, weddingId) {
  const notes = await extractPlanningNotesAI(message, weddingId, message.substring(0, 200), 'message');
  // Restore userId on notes from chat (userId may be set)
  return notes.map(n => ({ ...n, user_id: userId }));
}

// Save planning notes to database
async function savePlanningNotes(notes) {
  if (notes.length === 0) return;

  try {
    // Use supabaseAdmin to bypass RLS
    const { error } = await supabaseAdmin
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
  const { data, error } = await supabaseAdmin
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
        // Get vendors (use admin to bypass RLS)
        const { data: vendors } = await supabaseAdmin
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
        const { data: inspo } = await supabaseAdmin
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

        // Get recent planning notes (confirmed details from all sources)
        const { data: notes } = await supabaseAdmin
          .from('planning_notes')
          .select('category, content')
          .eq('wedding_id', weddingId)
          .in('status', ['added', 'confirmed', 'pending'])
          .order('created_at', { ascending: false })
          .limit(30);

        if (notes && notes.length > 0) {
          weddingContext += '\nCONFIRMED PLANNING DETAILS:\n';
          notes.forEach(n => {
            weddingContext += `- [${n.category}] ${n.content}\n`;
          });
        }

        // ── New planning form tables ─────────────────────────────────────
        const [
          { data: weddingDetails },
          { data: allergyRows },
          { data: bedroomRows },
          { data: ceremonyRows },
          { data: decorRows },
          { data: makeupRows },
          { data: shuttleRows },
          { data: rehearsalRow }
        ] = await Promise.all([
          supabaseAdmin.from('wedding_details').select('*').eq('wedding_id', weddingId).maybeSingle(),
          supabaseAdmin.from('allergy_registry').select('*').eq('wedding_id', weddingId).order('sort_order'),
          supabaseAdmin.from('bedroom_assignments').select('*').eq('wedding_id', weddingId).order('sort_order'),
          supabaseAdmin.from('ceremony_order').select('*').eq('wedding_id', weddingId).order('sort_order'),
          supabaseAdmin.from('decor_inventory').select('*').eq('wedding_id', weddingId).order('space_name').order('sort_order'),
          supabaseAdmin.from('makeup_schedule').select('*').eq('wedding_id', weddingId).order('sort_order'),
          supabaseAdmin.from('shuttle_schedule').select('*').eq('wedding_id', weddingId).order('sort_order'),
          supabaseAdmin.from('rehearsal_dinner').select('*').eq('wedding_id', weddingId).maybeSingle(),
        ]);

        if (weddingDetails) {
          weddingContext += '\n\nWEDDING DETAILS:\n';
          if (weddingDetails.wedding_colors) weddingContext += `- Colors: ${weddingDetails.wedding_colors}\n`;
          if (weddingDetails.partner1_social) weddingContext += `- Partner 1 social: ${weddingDetails.partner1_social}\n`;
          if (weddingDetails.partner2_social) weddingContext += `- Partner 2 social: ${weddingDetails.partner2_social}\n`;
          if (weddingDetails.ceremony_location) weddingContext += `- Ceremony location: ${weddingDetails.ceremony_location}\n`;
          if (weddingDetails.arbor_choice) weddingContext += `- Arbor choice: ${weddingDetails.arbor_choice}\n`;
          if (weddingDetails.unity_table) weddingContext += `- Unity table: yes\n`;
          if (weddingDetails.ceremony_notes) weddingContext += `- Ceremony notes: ${weddingDetails.ceremony_notes}\n`;
          if (weddingDetails.seating_method) weddingContext += `- Guest seating method: ${weddingDetails.seating_method}\n`;
          const providing = [];
          if (weddingDetails.providing_table_numbers) providing.push('table numbers');
          if (weddingDetails.providing_charger_plates) providing.push('charger plates');
          if (weddingDetails.providing_champagne_glasses) providing.push('champagne glasses');
          if (weddingDetails.providing_cake_cutter) providing.push('cake cutter');
          if (weddingDetails.providing_cake_topper) providing.push('cake topper');
          if (providing.length) weddingContext += `- Couple is providing: ${providing.join(', ')}\n`;
          if (weddingDetails.favors_description) weddingContext += `- Favors/gifts: ${weddingDetails.favors_description}\n`;
          if (weddingDetails.send_off_type) weddingContext += `- Send-off: ${weddingDetails.send_off_type}${weddingDetails.send_off_notes ? ` — ${weddingDetails.send_off_notes}` : ''}\n`;
          if (weddingDetails.dogs_coming) weddingContext += `- Dogs coming: yes${weddingDetails.dogs_description ? ` (${weddingDetails.dogs_description})` : ''}\n`;
          if (weddingDetails.reception_notes) weddingContext += `- Reception notes: ${weddingDetails.reception_notes}\n`;
        }

        if (allergyRows && allergyRows.length > 0) {
          weddingContext += '\n\nALLERGY REGISTRY (share with caterer):\n';
          allergyRows.forEach(a => {
            weddingContext += `- ${a.guest_name}: ${a.allergy} [${a.severity}]`;
            if (a.caterer_alerted) weddingContext += ' — caterer alerted';
            if (a.staying_overnight) weddingContext += ' — overnight guest';
            if (a.notes) weddingContext += ` — ${a.notes}`;
            weddingContext += '\n';
          });
        }

        if (bedroomRows && bedroomRows.some(r => r.guest_friday || r.guest_saturday)) {
          weddingContext += '\n\nBEDROOM ASSIGNMENTS:\n';
          bedroomRows.forEach(r => {
            if (r.guest_friday || r.guest_saturday) {
              weddingContext += `- ${r.room_name}: Friday: ${r.guest_friday || '—'} | Saturday: ${r.guest_saturday || '—'}`;
              if (r.notes) weddingContext += ` (${r.notes})`;
              weddingContext += '\n';
            }
          });
        }

        if (ceremonyRows && ceremonyRows.length > 0) {
          weddingContext += '\n\nCEREMONY ORDER:\n';
          ['processional', 'family_escort', 'recessional'].forEach(section => {
            const entries = ceremonyRows.filter(e => e.section === section);
            if (entries.length === 0) return;
            weddingContext += `${section.replace('_', ' ').toUpperCase()}:\n`;
            entries.forEach(e => {
              weddingContext += `  - ${e.participant_name || '(unnamed)'}`;
              if (e.role) weddingContext += ` [${e.role}]`;
              if (e.side && e.side !== 'center') weddingContext += ` (${e.side.replace('_', "'s ")})`;
              if (e.walk_with) weddingContext += ` — walks with ${e.walk_with}`;
              weddingContext += '\n';
            });
          });
        }

        if (decorRows && decorRows.length > 0) {
          weddingContext += '\n\nDECOR INVENTORY:\n';
          const bySpace = {};
          decorRows.forEach(d => {
            if (!bySpace[d.space_name]) bySpace[d.space_name] = [];
            bySpace[d.space_name].push(d);
          });
          for (const [space, items] of Object.entries(bySpace)) {
            weddingContext += `${space}:\n`;
            items.forEach(d => {
              weddingContext += `  - ${d.item_name}`;
              if (d.source) weddingContext += ` (from: ${d.source})`;
              if (d.leaving_it) weddingContext += ' [leaving at venue]';
              else if (d.goes_home_with) weddingContext += ` [going home with: ${d.goes_home_with}]`;
              weddingContext += '\n';
            });
          }
        }

        if (makeupRows && makeupRows.length > 0) {
          weddingContext += '\n\nHAIR & MAKEUP SCHEDULE:\n';
          makeupRows.forEach(m => {
            weddingContext += `- ${m.participant_name}${m.role ? ` (${m.role})` : ''}`;
            if (m.hair_start_time) weddingContext += ` — hair: ${m.hair_start_time}`;
            if (m.makeup_start_time) weddingContext += ` — makeup: ${m.makeup_start_time}`;
            weddingContext += '\n';
          });
        }

        if (shuttleRows && shuttleRows.length > 0) {
          weddingContext += '\n\nSHUTTLE SCHEDULE:\n';
          shuttleRows.forEach(s => {
            weddingContext += `- ${s.run_label || 'Run'}:`;
            if (s.pickup_location && s.pickup_time) weddingContext += ` pickup ${s.pickup_location} at ${s.pickup_time}`;
            if (s.dropoff_location && s.dropoff_time) weddingContext += ` → drop off at ${s.dropoff_location} at ${s.dropoff_time}`;
            if (s.seat_count) weddingContext += ` (${s.seat_count} seats)`;
            weddingContext += '\n';
          });
        }

        if (rehearsalRow) {
          weddingContext += '\n\nREHEARSAL DINNER:\n';
          if (rehearsalRow.bar_type) weddingContext += `- Bar: ${rehearsalRow.bar_type}\n`;
          if (rehearsalRow.food_type) weddingContext += `- Food: ${rehearsalRow.food_type}${rehearsalRow.food_notes ? ` — ${rehearsalRow.food_notes}` : ''}\n`;
          if (rehearsalRow.location) weddingContext += `- Location: ${rehearsalRow.location}${rehearsalRow.location_notes ? ` — ${rehearsalRow.location_notes}` : ''}\n`;
          if (rehearsalRow.seating_type) weddingContext += `- Seating: ${rehearsalRow.seating_type}\n`;
          if (rehearsalRow.table_layout) weddingContext += `- Tables: ${rehearsalRow.table_layout}\n`;
          if (rehearsalRow.guest_count) weddingContext += `- Guest count: ${rehearsalRow.guest_count}\n`;
          const rentals = [];
          if (rehearsalRow.using_disposables) rentals.push('disposables');
          if (rehearsalRow.renting_china) rentals.push('renting china');
          if (rehearsalRow.renting_flatware) rentals.push('renting flatware');
          if (rentals.length) weddingContext += `- Rentals: ${rentals.join(', ')}\n`;
          if (rehearsalRow.high_chairs_needed) weddingContext += `- High chairs needed: ${rehearsalRow.high_chairs_count || 'yes'}\n`;
          if (rehearsalRow.notes) weddingContext += `- Notes: ${rehearsalRow.notes}\n`;
        }
        // ── Timeline, tables, staffing, checklist, borrow, guest care ────
        const [
          { data: timelineRow },
          { data: tablesRow },
          { data: staffingRow },
          { data: checklistItems },
          { data: borrowSelections },
          { data: guestCareNotes },
        ] = await Promise.all([
          supabaseAdmin.from('wedding_timeline').select('ceremony_start, reception_start, reception_end, notes, timeline_data').eq('wedding_id', weddingId).maybeSingle(),
          supabaseAdmin.from('wedding_tables').select('*').eq('wedding_id', weddingId).maybeSingle(),
          supabaseAdmin.from('wedding_staffing').select('friday_bartenders, friday_extra_hands, friday_total, saturday_bartenders, saturday_extra_hands, saturday_total, total_staff, total_cost').eq('wedding_id', weddingId).maybeSingle(),
          supabaseAdmin.from('planning_checklist').select('task_text, category, is_completed').eq('wedding_id', weddingId).order('category'),
          supabaseAdmin.from('wedding_borrow_selections').select('item_name, category, quantity, notes').eq('wedding_id', weddingId),
          supabaseAdmin.from('wedding_guest_care').select('guest_name, note_type, notes').eq('wedding_id', weddingId),
        ]);

        if (timelineRow) {
          weddingContext += '\n\nWEDDING TIMELINE:\n';
          if (timelineRow.ceremony_start) weddingContext += `- Ceremony starts: ${timelineRow.ceremony_start}\n`;
          if (timelineRow.reception_start) weddingContext += `- Reception starts: ${timelineRow.reception_start}\n`;
          if (timelineRow.reception_end) weddingContext += `- Reception ends: ${timelineRow.reception_end}\n`;
          if (timelineRow.notes) weddingContext += `- Timeline notes: ${timelineRow.notes}\n`;
          const td = timelineRow.timeline_data;
          if (td && typeof td === 'object') {
            const events = Object.entries(td).filter(([, v]) => v?.time || v?.label);
            events.forEach(([key, v]) => {
              if (v?.time) weddingContext += `- ${v.label || key}: ${v.time}${v.notes ? ` — ${v.notes}` : ''}\n`;
            });
          }
        }

        if (tablesRow) {
          weddingContext += '\n\nTABLE LAYOUT:\n';
          if (tablesRow.guest_count) weddingContext += `- Guest count: ${tablesRow.guest_count}\n`;
          if (tablesRow.table_shape) weddingContext += `- Table shape: ${tablesRow.table_shape}\n`;
          if (tablesRow.guests_per_table) weddingContext += `- Guests per table: ${tablesRow.guests_per_table}\n`;
          if (tablesRow.head_table) weddingContext += `- Head table: ${tablesRow.head_table_size || 'yes'}\n`;
          if (tablesRow.sweetheart_table) weddingContext += `- Sweetheart table: yes\n`;
          if (tablesRow.cocktail_tables) weddingContext += `- Cocktail tables: yes\n`;
          if (tablesRow.kids_table) weddingContext += `- Kids table: yes (${tablesRow.kids_count || '?'} kids)\n`;
          if (tablesRow.linen_color) weddingContext += `- Linen color: ${tablesRow.linen_color}\n`;
          if (tablesRow.napkin_color) weddingContext += `- Napkin color: ${tablesRow.napkin_color}\n`;
          if (tablesRow.centerpiece_notes) weddingContext += `- Centrepiece notes: ${tablesRow.centerpiece_notes}\n`;
          if (tablesRow.layout_notes) weddingContext += `- Layout notes: ${tablesRow.layout_notes}\n`;
        }

        if (staffingRow && (staffingRow.total_staff > 0)) {
          weddingContext += '\n\nSTAFFING:\n';
          if (staffingRow.friday_total > 0) weddingContext += `- Friday: ${staffingRow.friday_bartenders} bartender(s), ${staffingRow.friday_extra_hands} extra hand(s)\n`;
          if (staffingRow.saturday_total > 0) weddingContext += `- Saturday: ${staffingRow.saturday_bartenders} bartender(s), ${staffingRow.saturday_extra_hands} extra hand(s)\n`;
          if (staffingRow.total_cost > 0) weddingContext += `- Estimated staff cost: $${staffingRow.total_cost.toLocaleString('en-US')}\n`;
        }

        if (checklistItems && checklistItems.length > 0) {
          const done = checklistItems.filter(t => t.is_completed);
          const pending = checklistItems.filter(t => !t.is_completed);
          weddingContext += `\n\nPLANNING CHECKLIST: ${done.length} done, ${pending.length} still to do\n`;
          if (pending.length > 0) {
            weddingContext += `Pending tasks:\n${pending.slice(0, 15).map(t => `- [${t.category}] ${t.task_text}`).join('\n')}\n`;
          }
        }

        if (borrowSelections && borrowSelections.length > 0) {
          weddingContext += '\n\nBORROWED FROM RIXEY CATALOG:\n';
          borrowSelections.forEach(b => {
            weddingContext += `- ${b.item_name}${b.category ? ` (${b.category})` : ''}${b.quantity && b.quantity > 1 ? ` ×${b.quantity}` : ''}${b.notes ? ` — ${b.notes}` : ''}\n`;
          });
        }

        if (guestCareNotes && guestCareNotes.length > 0) {
          weddingContext += '\n\nGUEST CARE NOTES:\n';
          guestCareNotes.forEach(g => {
            weddingContext += `- ${g.guest_name}: ${g.notes}${g.note_type ? ` [${g.note_type}]` : ''}\n`;
          });
        }
        // ── End additional context ────────────────────────────────────────

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
        const { data: contracts } = await supabaseAdmin
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

    // Inject borrow catalog when the question is about borrowing/decor items
    const borrowKeywords = [
      'borrow', 'borrowing', 'borrow list', 'what do you have', 'what does rixey have',
      'decor list', 'what can i use', 'what can we use', "what's available", 'whats available',
      'votive', 'candelabra', 'arbor', 'arbour', 'card box', 'cake stand', 'table number',
      'bud vase', 'vase', 'sign', 'cheesecloth', 'runner', 'flower girl', 'ring pillow',
      'seating chart', 'hot chocolate machine', 'candle holder', 'hurricane', 'basket',
      'vintage door', 'champagne bucket', 'silk floral', 'fake flower', 'artificial flower',
      'what signs', 'what vases', 'what candles', 'what stands', 'included decor'
    ];
    const lowerMsg = message.toLowerCase();
    const isBorrowQuestion = borrowKeywords.some(kw => lowerMsg.includes(kw));

    if (isBorrowQuestion) {
      try {
        const { data: catalogItems } = await supabaseAdmin
          .from('borrow_catalog')
          .select('item_name, category, description, image_url')
          .order('category')
          .order('item_name');

        if (catalogItems && catalogItems.length > 0) {
          const byCategory = {};
          catalogItems.forEach(item => {
            if (!byCategory[item.category]) byCategory[item.category] = [];
            byCategory[item.category].push(item);
          });

          weddingContext += '\n\nRIXEY MANOR BORROW CATALOG (items available to use at no charge):\n';
          for (const [cat, items] of Object.entries(byCategory)) {
            weddingContext += `\n${cat}:\n`;
            items.forEach(item => {
              weddingContext += `- ${item.item_name}: ${item.description}`;
              if (item.image_url) weddingContext += ` [photo: ${item.image_url}]`;
              weddingContext += '\n';
            });
          }
          weddingContext += '\nWhen listing borrow items, include the image URL as a markdown image or link so the couple can see what the item looks like.\n';
        }
      } catch (borrowErr) {
        console.error('Error fetching borrow catalog:', borrowErr);
      }
    }

    // Inject Rixey Picks when the question is about shopping, buying products, or specific items
    const picksKeywords = [
      // Shopping intent
      'recommend', 'recommendation', 'where to buy', 'where can i buy', 'what should i buy',
      'what should i get', 'where do i get', 'shopping', 'purchase', 'amazon', 'etsy',
      'buy online', 'order online', 'link', 'affordable', 'budget option', 'splurge',
      // Product categories in the catalog
      'disposable', 'plastic cup', 'plastic glass', 'plastic plate', 'plastic flute',
      'champagne flute', 'wine glass', 'wine cup', 'coupe', 'stemless',
      'plates', 'cutlery', 'flatware', 'napkin', 'cups', 'glassware',
      'cake stand', 'cake cutting', 'knife and server', 'knife & server', 'cupcake tower',
      'dessert display', 'dessert tower', 'dessert stand',
      'candle', 'tealight', 'tea light', 'votive', 'mercury glass',
      'guest book', 'guestbook', 'pen', 'marker',
      'fans', 'parasol', 'hand fan', 'paper fan',
      'confetti', 'glow stick', 'led wand', 'foam wand', 'fiber optic',
      'send off', 'sendoff', 'exit idea', 'grand exit', 'sparkle', 'balloon',
      'welcome bag', 'welcome box', 'favor', 'favors', 'gift bag',
      'rixey picks', 'picks', 'coordinator recommends', 'you recommend',
      'what do you suggest', 'suggestions', 'good option', 'good choice',
    ];
    const isPicksQuestion = picksKeywords.some(kw => lowerMsg.includes(kw));

    if (isPicksQuestion) {
      try {
        const { data: picksItems } = await supabaseAdmin
          .from('storefront_items')
          .select('product_type, category, pick_name, pick_type, description, affiliate_link, color_options')
          .eq('is_active', true)
          .order('category')
          .order('product_type')
          .order('pick_name');

        if (picksItems && picksItems.length > 0) {
          const byType = {};
          picksItems.forEach(item => {
            const key = item.product_type;
            if (!byType[key]) byType[key] = [];
            byType[key].push(item);
          });

          weddingContext += '\n\nRIXEY PICKS — Coordinator-curated products with affiliate purchase links:\n';
          weddingContext += '(Always include the link as [Pick Name](URL) in markdown when recommending one of these.)\n';
          for (const [productType, items] of Object.entries(byType)) {
            weddingContext += `\n${productType}:\n`;
            items.forEach(item => {
              weddingContext += `- ${item.pick_name} [${item.pick_type}]: ${item.description}`;
              if (item.color_options) weddingContext += ` Colors: ${item.color_options}.`;
              if (item.affiliate_link) weddingContext += ` → ${item.affiliate_link}`;
              weddingContext += '\n';
            });
          }
          weddingContext += '\nNote: these are affiliate links that support Rixey Manor at no cost to the couple.\n';
        }
      } catch (picksErr) {
        console.error('Error fetching Rixey Picks for Sage:', picksErr);
      }
    }

    // Inject budget context for Sage
    if (weddingId) {
      try {
        const { data: budgetRow } = await supabaseAdmin
          .from('wedding_budget')
          .select('*')
          .eq('wedding_id', weddingId)
          .single();
        if (budgetRow) {
          const cats = budgetRow.categories || {};
          const totalBudget = budgetRow.total_budget || 0;
          const totalCommitted = Object.values(cats).reduce((s, c) => s + (c.committed || 0), 0);
          const nonZero = Object.entries(cats).filter(([, c]) => (c.budgeted || 0) > 0 || (c.committed || 0) > 0);
          if (totalBudget > 0 || totalCommitted > 0 || nonZero.length > 0) {
            weddingContext += `\n\nCOUPLE'S WEDDING BUDGET: Total budget: $${totalBudget.toLocaleString('en-US')} | Total committed: $${totalCommitted.toLocaleString('en-US')}`;
            if (nonZero.length > 0) {
              weddingContext += '\n' + nonZero.map(([, c]) => `${c.label}: $${(c.committed||0).toLocaleString('en-US')} committed / $${(c.budgeted||0).toLocaleString('en-US')} budgeted`).join('\n');
            }
          }
        }
      } catch (budgetErr) {
        // Budget context is non-critical, silently ignore
      }
    }

    // Build messages array with conversation history.
    // Claude API requires: (1) first message must be from user, (2) roles must alternate.
    // The auto-generated opening greeting is an assistant message — if it's still in the
    // history window it causes the API to reject with a validation error (silent 500).
    const rawHistory = conversationHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Drop messages from the front until we hit the first user message
    let trimmedHistory = rawHistory;
    while (trimmedHistory.length > 0 && trimmedHistory[0].role !== 'user') {
      trimmedHistory = trimmedHistory.slice(1);
    }

    // Collapse consecutive same-role messages (keep the later one) so roles strictly alternate
    const dedupedHistory = [];
    for (const msg of trimmedHistory) {
      if (dedupedHistory.length > 0 && dedupedHistory[dedupedHistory.length - 1].role === msg.role) {
        dedupedHistory[dedupedHistory.length - 1] = msg;
      } else {
        dedupedHistory.push(msg);
      }
    }

    const messages = [
      ...dedupedHistory,
      {
        role: 'user',
        content: message
      }
    ];

    // Call Claude — try Sonnet first, fall back to Haiku if overloaded
    const sageCallParams = {
      max_tokens: 1024,
      temperature: 0.3,
      system: `${SAGE_SYSTEM_PROMPT}${profileContext}\n\n---\n\nADDITIONAL RIXEY MANOR KNOWLEDGE BASE:\n\n${knowledge}${weddingContext}\n\n---\n\nIMPORTANT: After your response, on a new line, add a confidence assessment in this exact format:\n[CONFIDENCE: XX]\nWhere XX is a number from 0-100 representing how confident you are in your answer based on the knowledge base and Rixey Manor information available to you. Use 100 for facts you know for certain, lower numbers for things you're less sure about or had to generalize.`,
      messages: messages
    };

    let response;
    try {
      response = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', ...sageCallParams });
    } catch (sonnetErr) {
      const isOverloaded = sonnetErr.status === 529 || sonnetErr.status === 503 || sonnetErr.status === 429;
      if (!isOverloaded) throw sonnetErr;
      console.log(`Sonnet overloaded (${sonnetErr.status}), falling back to Haiku for Sage`);
      response = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', ...sageCallParams });
    }

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

    // If confidence is below 85%, save as uncertain question for admin review
    // and add a note to the response letting the client know
    if (confidence < 85 && weddingId) {
      try {
        await supabaseAdmin.from('uncertain_questions').insert({
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

    // If Sage deferred to the team in its response, flag for admin review even if confidence was high
    const deferralPhrases = [
      'confirm with the', 'confirm directly with', 'check with the rixey', 'check with isadora',
      'check with grace', 'reach out to the rixey', 'contact the rixey team', 'ask the team',
      'double-check with', 'double check with', 'verify with the', 'i\'d confirm that',
      "i'd check that", 'best to confirm', 'best to check', 'i\'m not confident',
      "i'm not certain", 'i believe x', 'not 100% sure', 'not 100% certain'
    ];
    const lowerResponse = assistantMessage.toLowerCase();
    const sageDeferred = deferralPhrases.some(phrase => lowerResponse.includes(phrase));

    if (sageDeferred && weddingId && confidence >= 85) {
      // Only save if not already saved by the low-confidence block above
      try {
        await supabaseAdmin.from('uncertain_questions').insert({
          wedding_id: weddingId,
          user_id: userId,
          question: message,
          sage_response: assistantMessage,
          confidence_level: confidence
        });
        await createNotification(
          weddingId, 'admin', 'sage_uncertain',
          'Sage deferred to the team',
          `A client asked: "${message.substring(0, 120)}${message.length > 120 ? '...' : ''}"`,
          null
        );
        console.log(`Sage deferral detected — flagged for admin review`);
      } catch (err) {
        console.error('Error saving Sage deferral flag:', err);
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
    // Detect Anthropic overload / rate-limit errors so the client can retry
    const isRetryable = error.status === 529 || error.status === 503 || error.status === 429;
    res.status(500).json({
      error: isRetryable
        ? 'Sage is temporarily busy. Please try again shortly.'
        : 'Failed to get response from Sage',
      retryable: isRetryable
    });
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

    // Save the contract to database (use admin to bypass RLS)
    const { data: savedContract, error: contractError } = await supabaseAdmin
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

      const { error: insertError } = await supabaseAdmin
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

// Public Sage preview — no auth required, no wedding context
app.post('/api/sage-preview', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const knowledge = await getRelevantKnowledge(message);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: `${SAGE_SYSTEM_PROMPT}\n\nADDITIONAL RIXEY MANOR KNOWLEDGE BASE:\n\n${knowledge}\n\n---\n\nNOTE: You're chatting with a prospective couple on the Rixey Manor preview page. They haven't created their account yet. Keep replies concise and welcoming. If they ask about their specific wedding details, gently note they'll have a personalised portal once they sign up.`,
      messages: [
        ...conversationHistory,
        { role: 'user', content: message },
      ],
    });

    const reply = response.content[0]?.text || '';
    res.json({ reply });
  } catch (err) {
    console.error('Sage preview error:', err);
    res.status(500).json({ error: 'Failed to get response' });
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
          const { count } = await supabaseAdmin
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

                await supabaseAdmin.from('inspo_gallery').insert({
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

          await supabaseAdmin.from('contracts').insert({
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
          const { data: existingVendor } = await supabaseAdmin
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
                await supabaseAdmin.from('vendor_checklist').insert({
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
                await supabaseAdmin.from('planning_notes').insert(notesToSave);
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

    // Fetch all wedding data in parallel
    const [
      { data: contracts },
      { data: planningNotes },
      { data: weddingDetails },
      { data: allergyRows },
      { data: bedroomRows },
      { data: ceremonyRows },
      { data: decorRows },
      { data: makeupRows },
      { data: shuttleRows },
      { data: rehearsalRow },
      { data: vendors },
      { data: timelineRow },
      { data: tablesRow },
      { data: staffingRow },
      { data: checklistItems },
      { data: borrowSelections },
      { data: guestCareRows },
      { data: internalNotes },
    ] = await Promise.all([
      supabaseAdmin.from('contracts').select('filename, extracted_text').eq('wedding_id', weddingId),
      supabaseAdmin.from('planning_notes').select('category, content, source_message').eq('wedding_id', weddingId),
      supabaseAdmin.from('wedding_details').select('*').eq('wedding_id', weddingId).maybeSingle(),
      supabaseAdmin.from('allergy_registry').select('*').eq('wedding_id', weddingId).order('sort_order'),
      supabaseAdmin.from('bedroom_assignments').select('*').eq('wedding_id', weddingId).order('sort_order'),
      supabaseAdmin.from('ceremony_order').select('*').eq('wedding_id', weddingId).order('sort_order'),
      supabaseAdmin.from('decor_inventory').select('*').eq('wedding_id', weddingId).order('space_name'),
      supabaseAdmin.from('makeup_schedule').select('*').eq('wedding_id', weddingId).order('sort_order'),
      supabaseAdmin.from('shuttle_schedule').select('*').eq('wedding_id', weddingId).order('sort_order'),
      supabaseAdmin.from('rehearsal_dinner').select('*').eq('wedding_id', weddingId).maybeSingle(),
      supabaseAdmin.from('vendor_checklist').select('vendor_type, vendor_name, vendor_contact, is_booked, notes').eq('wedding_id', weddingId),
      supabaseAdmin.from('wedding_timeline').select('ceremony_start, reception_start, reception_end, notes, timeline_data').eq('wedding_id', weddingId).maybeSingle(),
      supabaseAdmin.from('wedding_tables').select('*').eq('wedding_id', weddingId).maybeSingle(),
      supabaseAdmin.from('wedding_staffing').select('friday_bartenders, friday_extra_hands, saturday_bartenders, saturday_extra_hands, total_staff, total_cost').eq('wedding_id', weddingId).maybeSingle(),
      supabaseAdmin.from('planning_checklist').select('task_text, category, is_completed').eq('wedding_id', weddingId).order('category'),
      supabaseAdmin.from('wedding_borrow_selections').select('item_name, category, quantity, notes').eq('wedding_id', weddingId),
      supabaseAdmin.from('wedding_guest_care').select('guest_name, note_type, notes').eq('wedding_id', weddingId),
      supabaseAdmin.from('wedding_internal_notes').select('content, category, created_at').eq('wedding_id', weddingId).order('created_at', { ascending: false }).limit(20),
    ]);

    // Build comprehensive context
    let fullContext = '';

    if (contracts?.length) {
      fullContext += `CONTRACTS:\n${contracts.map(c => `--- ${c.filename} ---\n${c.extracted_text}`).join('\n\n')}\n\n`;
    }
    if (planningNotes?.length) {
      fullContext += `PLANNING NOTES:\n${planningNotes.map(n => `[${n.category.toUpperCase()}] ${n.content}`).join('\n')}\n\n`;
    }
    if (vendors?.length) {
      fullContext += `VENDORS:\n${vendors.map(v => `- ${v.vendor_type}: ${v.vendor_name || 'TBD'}${v.is_booked ? ' (booked)' : ''}${v.vendor_contact ? ` — ${v.vendor_contact}` : ''}${v.notes ? ` — ${v.notes}` : ''}`).join('\n')}\n\n`;
    }
    if (weddingDetails) {
      const d = weddingDetails;
      const lines = [];
      if (d.wedding_colors) lines.push(`Colors: ${d.wedding_colors}`);
      if (d.ceremony_location) lines.push(`Ceremony: ${d.ceremony_location}`);
      if (d.arbor_choice) lines.push(`Arbor: ${d.arbor_choice}`);
      if (d.unity_table) lines.push('Unity table: yes');
      if (d.seating_method) lines.push(`Guest seating: ${d.seating_method}`);
      const providing = [d.providing_table_numbers && 'table numbers', d.providing_charger_plates && 'charger plates', d.providing_champagne_glasses && 'champagne glasses', d.providing_cake_cutter && 'cake cutter', d.providing_cake_topper && 'cake topper'].filter(Boolean);
      if (providing.length) lines.push(`Couple providing: ${providing.join(', ')}`);
      if (d.favors_description) lines.push(`Favors: ${d.favors_description}`);
      if (d.send_off_type) lines.push(`Send-off: ${d.send_off_type}${d.send_off_notes ? ` — ${d.send_off_notes}` : ''}`);
      if (d.dogs_coming) lines.push(`Dogs: ${d.dogs_description || 'yes'}`);
      if (d.ceremony_notes) lines.push(`Ceremony notes: ${d.ceremony_notes}`);
      if (d.reception_notes) lines.push(`Reception notes: ${d.reception_notes}`);
      if (lines.length) fullContext += `WEDDING DETAILS:\n${lines.map(l => `- ${l}`).join('\n')}\n\n`;
    }
    if (allergyRows?.length) {
      fullContext += `ALLERGY REGISTRY:\n${allergyRows.map(a => `- ${a.guest_name}: ${a.allergy} [${a.severity}]${a.caterer_alerted ? ' — caterer alerted' : ''}${a.staying_overnight ? ' — overnight guest' : ''}${a.notes ? ` — ${a.notes}` : ''}`).join('\n')}\n\n`;
    }
    if (ceremonyRows?.length) {
      fullContext += `CEREMONY ORDER:\n${ceremonyRows.map(e => `- ${e.section}: ${e.participant_name || '?'}${e.role ? ` [${e.role}]` : ''}${e.walk_with ? ` with ${e.walk_with}` : ''}`).join('\n')}\n\n`;
    }
    if (decorRows?.length) {
      const bySpace = {};
      decorRows.forEach(d => { if (!bySpace[d.space_name]) bySpace[d.space_name] = []; bySpace[d.space_name].push(d); });
      fullContext += `DECOR INVENTORY:\n${Object.entries(bySpace).map(([s, items]) => `${s}:\n${items.map(d => `  - ${d.item_name}${d.source ? ` (from ${d.source})` : ''}${d.leaving_it ? ' [leaving]' : d.goes_home_with ? ` [→ ${d.goes_home_with}]` : ''}`).join('\n')}`).join('\n')}\n\n`;
    }
    if (makeupRows?.length) {
      fullContext += `HAIR & MAKEUP SCHEDULE:\n${makeupRows.map(m => `- ${m.participant_name}${m.role ? ` (${m.role})` : ''}${m.hair_start_time ? ` hair: ${m.hair_start_time}` : ''}${m.makeup_start_time ? ` makeup: ${m.makeup_start_time}` : ''}`).join('\n')}\n\n`;
    }
    if (shuttleRows?.length) {
      fullContext += `SHUTTLE SCHEDULE:\n${shuttleRows.map(s => `- ${s.run_label || 'Run'}: ${s.pickup_location || ''} ${s.pickup_time || ''} → ${s.dropoff_location || ''} ${s.dropoff_time || ''}${s.seat_count ? ` (${s.seat_count} seats)` : ''}`).join('\n')}\n\n`;
    }
    if (bedroomRows?.some(r => r.guest_friday || r.guest_saturday)) {
      fullContext += `BEDROOM ASSIGNMENTS:\n${bedroomRows.filter(r => r.guest_friday || r.guest_saturday).map(r => `- ${r.room_name}: Fri: ${r.guest_friday || '—'} | Sat: ${r.guest_saturday || '—'}`).join('\n')}\n\n`;
    }
    if (rehearsalRow) {
      const r = rehearsalRow;
      const lines = [];
      if (r.bar_type) lines.push(`Bar: ${r.bar_type}`);
      if (r.food_type) lines.push(`Food: ${r.food_type}${r.food_notes ? ` — ${r.food_notes}` : ''}`);
      if (r.location) lines.push(`Location: ${r.location}`);
      if (r.seating_type) lines.push(`Seating: ${r.seating_type}`);
      if (r.notes) lines.push(`Notes: ${r.notes}`);
      if (lines.length) fullContext += `REHEARSAL DINNER:\n${lines.map(l => `- ${l}`).join('\n')}\n\n`;
    }
    if (timelineRow) {
      const t = timelineRow;
      const lines = [];
      if (t.ceremony_start) lines.push(`Ceremony start: ${t.ceremony_start}`);
      if (t.reception_start) lines.push(`Reception start: ${t.reception_start}`);
      if (t.reception_end) lines.push(`Reception end: ${t.reception_end}`);
      if (t.notes) lines.push(`Notes: ${t.notes}`);
      if (t.timeline_data) {
        try {
          const events = typeof t.timeline_data === 'string' ? JSON.parse(t.timeline_data) : t.timeline_data;
          if (Array.isArray(events) && events.length) {
            lines.push(`Events: ${events.map(e => `${e.time || ''} ${e.label || e.event || ''}`).join(', ')}`);
          }
        } catch {}
      }
      if (lines.length) fullContext += `TIMELINE:\n${lines.map(l => `- ${l}`).join('\n')}\n\n`;
    }
    if (tablesRow) {
      const t = tablesRow;
      const lines = [];
      if (t.guest_table_count) lines.push(`Guest tables: ${t.guest_table_count}`);
      if (t.guest_table_shape) lines.push(`Table shape: ${t.guest_table_shape}`);
      if (t.linen_color) lines.push(`Linen color: ${t.linen_color}`);
      if (t.sweetheart_table) lines.push(`Sweetheart table: yes`);
      if (t.cocktail_table_count) lines.push(`Cocktail tables: ${t.cocktail_table_count}`);
      if (t.notes) lines.push(`Notes: ${t.notes}`);
      if (lines.length) fullContext += `TABLE LAYOUT:\n${lines.map(l => `- ${l}`).join('\n')}\n\n`;
    }
    if (staffingRow) {
      const s = staffingRow;
      const lines = [];
      if (s.friday_bartenders) lines.push(`Friday bartenders: ${s.friday_bartenders}`);
      if (s.friday_extra_hands) lines.push(`Friday extra hands: ${s.friday_extra_hands}`);
      if (s.saturday_bartenders) lines.push(`Saturday bartenders: ${s.saturday_bartenders}`);
      if (s.saturday_extra_hands) lines.push(`Saturday extra hands: ${s.saturday_extra_hands}`);
      if (s.total_staff) lines.push(`Total staff: ${s.total_staff}`);
      if (s.total_cost) lines.push(`Total cost: $${s.total_cost}`);
      if (lines.length) fullContext += `STAFFING:\n${lines.map(l => `- ${l}`).join('\n')}\n\n`;
    }
    if (checklistItems?.length) {
      const completed = checklistItems.filter(t => t.is_completed);
      const pending = checklistItems.filter(t => !t.is_completed);
      if (completed.length) fullContext += `COMPLETED CHECKLIST TASKS:\n${completed.map(t => `- [${t.category}] ${t.task_text}`).join('\n')}\n\n`;
      if (pending.length) fullContext += `PENDING CHECKLIST TASKS:\n${pending.slice(0, 20).map(t => `- [${t.category}] ${t.task_text}`).join('\n')}\n\n`;
    }
    if (borrowSelections?.length) {
      fullContext += `BORROW CATALOG SELECTIONS:\n${borrowSelections.map(b => `- ${b.item_name}${b.category ? ` [${b.category}]` : ''}${b.quantity > 1 ? ` x${b.quantity}` : ''}${b.notes ? ` — ${b.notes}` : ''}`).join('\n')}\n\n`;
    }
    if (guestCareRows?.length) {
      fullContext += `GUEST CARE NOTES:\n${guestCareRows.map(g => `- ${g.guest_name} [${g.note_type}]: ${g.notes}`).join('\n')}\n\n`;
    }
    if (internalNotes?.length) {
      fullContext += `INTERNAL COORDINATOR NOTES:\n${internalNotes.map(n => `- ${n.category ? `[${n.category}] ` : ''}${n.content}`).join('\n')}\n\n`;
    }

    if (!fullContext.trim()) {
      return res.json({ answer: "No planning information has been recorded for this wedding yet." });
    }

    console.log(`Answering admin question with ${Math.round(fullContext.length/1000)}K chars of context for wedding ${weddingId}`);

    // Ask Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are helping a wedding venue coordinator answer questions about a client's wedding. Use the planning information below to answer accurately and specifically. Cite your source (which section the info came from).

If the information is not found, say so clearly.

${fullContext}
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
    const { error: deleteError } = await supabaseAdmin
      .from('gmail_tokens')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) console.log('Delete old tokens:', deleteError.message);

    const { error: insertError } = await supabaseAdmin
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
    const { data: tokens, error: fetchError } = await supabaseAdmin
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
    const { data: tokens } = await supabaseAdmin
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
    // Use supabaseAdmin to bypass RLS
    const { data: weddings } = await supabaseAdmin
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
    const { data: processed } = await supabaseAdmin
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

          // Skip no-reply/automated system senders — not real human communication
          const automatedSenderPatterns = [
            /noreply/i, /no-reply/i, /donotreply/i, /do-not-reply/i,
            /notifications?@/i, /automated@/i, /mailer-daemon/i, /bounce@/i
          ];
          if (automatedSenderPatterns.some(p => p.test(fromEmail))) {
            processedIds.add(msg.id);
            await supabaseAdmin.from('processed_emails').insert({
              gmail_message_id: msg.id,
              wedding_id: emailToWedding[clientEmail],
              from_email: fromEmail,
              subject: subject,
              body_text: '[Automated sender — skipped]'
            }).then(() => {});
            continue;
          }

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
          await supabaseAdmin.from('processed_emails').insert({
            gmail_message_id: msg.id,
            wedding_id: weddingId,
            from_email: fromEmail,
            subject: subject,
            body_text: bodyText.substring(0, 10000)
          });

          // Save full email as a planning note so Sage can search it
          if (weddingId && bodyText) {
            const { error: noteError } = await supabaseAdmin.from('planning_notes').insert({
              wedding_id: weddingId,
              user_id: null,
              category: 'email',
              content: `[Email: ${subject}]\nFrom: ${fromEmail}\n\n${bodyText.substring(0, 5000)}`,
              source_message: `From email on ${dateHeader}`,
              status: 'confirmed'
            });

            if (noteError) {
              console.error('Error saving email to planning_notes:', noteError);
            }

            // AI extraction of planning details from email body
            const notes = await extractPlanningNotesAI(bodyText, weddingId, `Email: "${subject}" (${dateHeader})`, 'email');
            if (notes.length > 0) {
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
    await supabaseAdmin.from('gmail_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ============ QUO (OPENPHONE) INTEGRATION ============

const QUO_API_KEY = process.env.QUO_API_KEY;
const QUO_API_BASE = 'https://api.openphone.com/v1';

// Helper to normalize phone numbers for matching
// Handles formats like: (540) 388-8912, +1 540-388-8912, 5403888912, +15403888912
function normalizePhone(phone) {
  if (!phone) return null;
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  // If starts with 1 and has 11 digits, remove the leading 1 (US country code)
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  // If 10 digits, return as-is
  if (digits.length === 10) {
    return digits;
  }
  // Otherwise return last 10 digits
  return digits.slice(-10);
}

// Check Quo connection status
app.get('/api/quo/status', (req, res) => {
  res.json({ connected: !!QUO_API_KEY });
});

// Clear processed Quo messages (to allow reprocessing)
app.post('/api/quo/clear-processed', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('processed_quo_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;
    res.json({ success: true, message: 'Cleared all processed messages. Run sync again to reprocess.' });
  } catch (error) {
    console.error('Clear processed error:', error);
    res.status(500).json({ error: 'Failed to clear: ' + error.message });
  }
});

// Sync messages from Quo
app.post('/api/quo/sync', async (req, res) => {
  try {
    if (!QUO_API_KEY) {
      return res.status(400).json({ error: 'Quo API key not configured' });
    }

    const { forceReprocess } = req.body || {};

    // If force reprocess, clear the processed table first
    if (forceReprocess) {
      await supabaseAdmin
        .from('processed_quo_messages')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      console.log('Force reprocess: cleared processed_quo_messages');
    }

    // Get all profiles with phone numbers (use admin to bypass RLS)
    const { data: profiles } = await supabaseAdmin
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
    console.log('DEBUG: Found profiles with phones:', profiles.map(p => ({ phone: p.phone, wedding_id: p.wedding_id })));

    for (const profile of profiles) {
      if (profile.phone && profile.wedding_id) {
        const normalized = normalizePhone(profile.phone);
        console.log(`DEBUG: Profile phone "${profile.phone}" normalized to "${normalized}"`);
        if (normalized) {
          phoneToWedding[normalized] = profile.wedding_id;
          phoneToUser[normalized] = profile.id;
        }
      }
    }

    console.log(`Searching Quo for messages from ${Object.keys(phoneToWedding).length} registered phone numbers`);
    console.log('DEBUG: Registered phone lookup:', phoneToWedding);

    // Get already processed message IDs (use admin to bypass RLS)
    const { data: processed } = await supabaseAdmin
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
    console.log('DEBUG: Phone numbers raw response:', JSON.stringify(phoneNumbersData).substring(0, 1000));
    const quoPhoneNumbers = phoneNumbersData.data || phoneNumbersData.phoneNumbers || phoneNumbersData || [];
    console.log('DEBUG: Quo phone numbers:', quoPhoneNumbers.map(p => ({ id: p.id, phoneNumber: p.phoneNumber })));

    // Track debug info
    let totalMessagesFound = 0;
    let planningNotesSaved = 0;
    let planningNotesErrors = [];
    const sampleMessages = [];

    // Convert registered phones to E.164 format for API queries
    const registeredPhonesE164 = Object.keys(phoneToWedding).map(phone => `+1${phone}`);
    console.log('DEBUG: Registered phones in E.164:', registeredPhonesE164);

    // For each Quo phone number AND each registered client, fetch their conversation
    for (const quoPhone of quoPhoneNumbers) {
      const phoneNumberId = quoPhone.id;
      console.log(`DEBUG: Processing Quo phone ${phoneNumberId} (${quoPhone.phoneNumber})`);

      // Query messages for each registered client phone
      for (const clientPhoneE164 of registeredPhonesE164) {
        const normalizedClient = normalizePhone(clientPhoneE164);
        const weddingId = phoneToWedding[normalizedClient];
        const userId = phoneToUser[normalizedClient];

        if (!weddingId) continue;

        // Fetch messages for this specific conversation (Quo API requires participants param)
        const messagesUrl = `${QUO_API_BASE}/messages?phoneNumberId=${phoneNumberId}&participants=${encodeURIComponent(clientPhoneE164)}&maxResults=100`;
        console.log(`DEBUG: Fetching messages from: ${messagesUrl}`);

        const messagesResponse = await fetch(messagesUrl, {
          headers: { 'Authorization': QUO_API_KEY }
        });

        if (!messagesResponse.ok) {
          const errText = await messagesResponse.text();
          console.log(`DEBUG: Messages fetch failed: ${messagesResponse.status} ${errText}`);
          continue;
        }

        const messagesData = await messagesResponse.json();
        console.log(`DEBUG: Messages response for ${clientPhoneE164}:`, JSON.stringify(messagesData).substring(0, 500));
        const messages = messagesData.data || messagesData.messages || messagesData || [];
        totalMessagesFound += messages.length;
        console.log(`DEBUG: Found ${messages.length} messages with ${clientPhoneE164}`);

        // Capture sample for debugging
        if (sampleMessages.length < 3 && messages.length > 0) {
          const sample = messages[0];
          sampleMessages.push({
            id: sample.id,
            from: sample.from,
            to: sample.to,
            direction: sample.direction,
            body: (sample.body || sample.text || sample.content || '').substring(0, 50)
          });
        }

        for (const msg of messages) {
          if (processedIds.has(msg.id)) {
            console.log(`DEBUG: Skipping already processed message ${msg.id}`);
            continue;
          }

          // Log raw message structure for debugging
          console.log(`DEBUG: Raw message structure:`, JSON.stringify(msg).substring(0, 300));

          const messageBody = msg.body || msg.text || msg.content || '';
          const direction = msg.direction || 'inbound';

          console.log(`DEBUG: Message body="${messageBody.substring(0, 50)}", direction=${direction}`);

          // Save to processed messages
          const { error: insertError } = await supabaseAdmin.from('processed_quo_messages').insert({
            quo_message_id: msg.id,
            wedding_id: weddingId,
            phone_number: clientPhoneE164,
            direction: direction,
            body_text: messageBody.substring(0, 5000)
          });

          if (insertError) {
            console.error(`DEBUG: Error saving to processed_quo_messages:`, insertError);
          }

          // Skip outbound auto-reply templates — real personal responses should still be recorded
          const autoReplyPatterns = [
            /^thank you for (reaching out|contacting|calling|your (message|inquiry|interest))/i,
            /^thanks for (reaching out|calling|your (message|inquiry|interest))/i,
            /^we('ve| have) received your/i,
            /^we('ll| will) (get back|be in touch|respond)/i,
            /^this is an automated/i,
            /^you('ve| have) reached rixey manor/i,
            /^hi,? (we('re| are) currently|our team is)/i,
          ];
          const isAutoReply = direction === 'outbound' &&
            autoReplyPatterns.some(p => p.test(messageBody.trim()));

          // Also save message as a planning note so Sage can search it
          if (messageBody && !isAutoReply) {
            const label = direction === 'inbound' ? 'SMS from client' : 'SMS from Rixey';
            const { data: savedNote, error: noteError } = await supabaseAdmin.from('planning_notes').insert({
              wedding_id: weddingId,
              user_id: userId,
              category: 'sms_message',
              content: `[${label}] ${messageBody}`,
              source_message: `From ${direction === 'inbound' ? 'client' : 'Rixey'} text: ${clientPhoneE164}`,
              status: 'confirmed'
            }).select();

            if (noteError) {
              console.error(`DEBUG: Error saving SMS to planning_notes:`, noteError);
              planningNotesErrors.push({ type: 'sms', error: noteError.message || JSON.stringify(noteError) });
            } else {
              planningNotesSaved++;
              console.log(`DEBUG: Saved ${direction} SMS as planning note for wedding ${weddingId}, id: ${savedNote?.[0]?.id}`);
            }
          }

          // AI extraction from inbound SMS messages
          if (direction === 'inbound' && messageBody) {
            const notes = await extractPlanningNotesAI(messageBody, weddingId, `SMS: ${messageBody.substring(0, 120)}`, 'sms');
            if (notes.length > 0) {
              notes.forEach(n => { n.user_id = userId; });
              await savePlanningNotes(notes);
              notesExtracted += notes.length;
            }
          }

          newlyProcessed++;
          processedIds.add(msg.id);
        }
      }
    }

    // Also fetch calls with transcripts - query for each registered client
    let totalCallsFound = 0;
    let callsProcessed = 0;
    for (const quoPhone of quoPhoneNumbers) {
      const phoneNumberId = quoPhone.id;

      // Query calls for each registered client phone
      for (const clientPhoneE164 of registeredPhonesE164) {
        const normalizedClient = normalizePhone(clientPhoneE164);
        const weddingId = phoneToWedding[normalizedClient];
        const userId = phoneToUser[normalizedClient];

        if (!weddingId) continue;

        try {
          // Fetch calls for this specific conversation
          const callsUrl = `${QUO_API_BASE}/calls?phoneNumberId=${phoneNumberId}&participants=${encodeURIComponent(clientPhoneE164)}&maxResults=50`;
          console.log(`DEBUG: Fetching calls from: ${callsUrl}`);

          const callsResponse = await fetch(callsUrl, {
            headers: { 'Authorization': QUO_API_KEY }
          });

          if (!callsResponse.ok) {
            const errText = await callsResponse.text();
            console.log(`DEBUG: Calls fetch failed: ${callsResponse.status} ${errText}`);
            continue;
          }

          const callsData = await callsResponse.json();
          const calls = callsData.data || callsData.calls || callsData || [];
          totalCallsFound += calls.length;
          console.log(`DEBUG: Found ${calls.length} calls with ${clientPhoneE164}`);

          for (const call of calls) {
            const callId = `call_${call.id}`;
            if (processedIds.has(callId)) continue;

            // Get transcript if available
            const transcript = call.transcript || call.transcription || call.voicemail?.transcript || '';
            if (!transcript) continue; // Skip calls without transcripts

            console.log(`DEBUG: Processing call with transcript for wedding ${weddingId}`);
            const direction = call.direction || 'inbound';

            // Save to processed
            const { error: insertError } = await supabaseAdmin.from('processed_quo_messages').insert({
              quo_message_id: callId,
              wedding_id: weddingId,
              phone_number: clientPhoneE164,
              direction: direction,
              body_text: `[CALL TRANSCRIPT] ${transcript.substring(0, 5000)}`
            });

            if (insertError) {
              console.error(`DEBUG: Error saving call to processed_quo_messages:`, insertError);
            }

            // Also save transcript as a planning note so Sage can search it
            const { data: savedCallNote, error: noteError } = await supabaseAdmin.from('planning_notes').insert({
              wedding_id: weddingId,
              user_id: userId,
              category: 'call_transcript',
              content: `[Call Transcript] ${transcript}`,
              source_message: `From ${direction} call with: ${clientPhoneE164}`,
              status: 'confirmed'
            }).select();

            if (noteError) {
              console.error(`DEBUG: Error saving call transcript to planning_notes:`, noteError);
              planningNotesErrors.push({ type: 'call', error: noteError.message || JSON.stringify(noteError) });
            } else {
              planningNotesSaved++;
              console.log(`DEBUG: Saved call transcript as planning note for wedding ${weddingId}`);
            }

            // AI extraction from call transcript
            if (transcript) {
              const notes = await extractPlanningNotesAI(transcript, weddingId, `Phone call transcript`, 'transcript');
              if (notes.length > 0) {
                notes.forEach(n => { n.user_id = userId; });
                await savePlanningNotes(notes);
                notesExtracted += notes.length;
              }
            }

            callsProcessed++;
            processedIds.add(callId);
          }
        } catch (callErr) {
          console.error(`Error fetching calls for ${clientPhoneE164}:`, callErr);
        }
      }
    }

    console.log(`Quo sync: processed ${newlyProcessed} messages + ${callsProcessed} calls, saved ${planningNotesSaved} planning notes, extracted ${notesExtracted} additional notes`);

    // Include detailed debug info in response
    const registeredPhones = Object.keys(phoneToWedding);
    res.json({
      processed: newlyProcessed,
      callsProcessed: callsProcessed,
      planningNotesSaved,
      notesExtracted,
      message: `Synced ${newlyProcessed} messages + ${callsProcessed} call transcripts. Saved ${planningNotesSaved} to planning notes.`,
      debug: {
        profileCount: profiles.length,
        profilesWithWeddingId: profiles.filter(p => p.wedding_id).length,
        registeredPhones: registeredPhones,
        registeredPhonesE164: registeredPhonesE164,
        quoPhoneNumbers: quoPhoneNumbers.map(p => p.phoneNumber || p.phone || p.number || JSON.stringify(p).substring(0, 100)),
        quoPhoneCount: quoPhoneNumbers.length,
        totalMessagesFound: totalMessagesFound,
        totalCallsFound: totalCallsFound,
        alreadyProcessedCount: processedIds.size,
        planningNotesErrors: planningNotesErrors.slice(0, 5),
        sampleMessages: sampleMessages
      }
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
    const { data: notes } = await supabaseAdmin
      .from('planning_notes')
      .select('category, content, source_message, created_at, status')
      .eq('wedding_id', weddingId)
      .order('created_at', { ascending: false });

    // Get contracts
    const { data: contracts } = await supabaseAdmin
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

    if (tokens.error || !tokens.access_token) {
      console.error('Zoom token exchange failed:', JSON.stringify(tokens));
      console.error('redirect_uri used:', ZOOM_REDIRECT_URI);
      console.error('ZOOM_CLIENT_ID set:', !!ZOOM_CLIENT_ID, 'ZOOM_CLIENT_SECRET set:', !!ZOOM_CLIENT_SECRET);
      return res.status(400).json({
        error: tokens.error || 'No access token returned',
        reason: tokens.reason,
        redirect_uri_used: ZOOM_REDIRECT_URI
      });
    }

    console.log('Got Zoom tokens:', { hasAccessToken: !!tokens.access_token, hasRefreshToken: !!tokens.refresh_token });

    // Save tokens
    await supabaseAdmin.from('zoom_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error: insertError } = await supabaseAdmin.from('zoom_tokens').insert({
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
    const { data: tokens } = await supabaseAdmin
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
  const { data: tokens, error: tokenError } = await supabaseAdmin
    .from('zoom_tokens')
    .select('*')
    .limit(1)
    .single();

  if (tokenError) {
    console.error('getZoomAccessToken DB error:', tokenError.message);
    return null;
  }
  if (!tokens) {
    console.log('getZoomAccessToken: no tokens in DB');
    return null;
  }

  const isExpired = tokens.expiry_date && Date.now() > tokens.expiry_date - 300000;
  console.log(`Zoom token found. Expired: ${isExpired}. Expiry: ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'none'}`);

  // Check if token is expired (with 5 min buffer)
  if (isExpired) {
    if (!tokens.refresh_token) {
      console.error('getZoomAccessToken: token expired but no refresh_token stored');
      return tokens.access_token; // try anyway
    }
    console.log('Refreshing Zoom access token...');
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
      console.log('Zoom token refreshed successfully');
      await supabaseAdmin.from('zoom_tokens')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token || tokens.refresh_token,
          expiry_date: Date.now() + (newTokens.expires_in * 1000)
        })
        .eq('id', tokens.id);

      return newTokens.access_token;
    } else {
      console.error('Zoom token refresh failed:', JSON.stringify(newTokens));
      throw new Error(`Zoom token refresh failed: ${newTokens.error || newTokens.reason || 'unknown'}. Please re-connect Zoom in the admin panel.`);
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
    const { data: weddings } = await supabaseAdmin
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
    const { data: processed } = await supabaseAdmin
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
      console.error('Zoom recordings API error:', recordingsResponse.status, errText);
      const hint = recordingsResponse.status === 401
        ? ' Your Zoom access token is invalid or expired — please re-connect Zoom.'
        : recordingsResponse.status === 124
        ? ' Your Zoom account plan may not support cloud recordings.'
        : '';
      return res.status(500).json({ error: `Zoom recordings API returned ${recordingsResponse.status}.${hint}` });
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
      const { error: insertErr } = await supabaseAdmin.from('processed_zoom_meetings').insert({
        zoom_meeting_id: meetingId,
        wedding_id: matchedWeddingId,
        meeting_topic: meeting.topic,
        participant_names: participantNames.join(', '), // TEXT column — must be string
        transcript_text: transcriptText.substring(0, 50000)
      });
      if (insertErr) {
        console.error('Failed to save processed meeting (dedup will not work):', insertErr.message);
      }

      // Save full transcript as a planning note so Sage can search it
      if (matchedWeddingId && transcriptText) {
        const cleanTranscript = parseVttToText(transcriptText);
        const meetingLabel = meeting.topic || 'Untitled';
        const meetingDate = meeting.start_time ? new Date(meeting.start_time).toLocaleDateString() : 'unknown date';

        const { error: noteError } = await supabaseAdmin.from('planning_notes').insert({
          wedding_id: matchedWeddingId,
          user_id: null,
          category: 'zoom_transcript',
          content: `[Zoom Meeting: ${meetingLabel} — ${meetingDate}]\n${cleanTranscript.substring(0, 40000)}`,
          source_message: `Zoom meeting on ${meetingDate}`,
          status: 'confirmed'
        });

        if (noteError) {
          console.error('Error saving Zoom transcript to planning_notes:', noteError);
        }

        // AI-powered extraction of specific planning details
        const source = `Zoom meeting: ${meetingLabel} (${meetingDate})`;
        const notes = await extractPlanningNotesAI(transcriptText, matchedWeddingId, source);
        if (notes.length > 0) {
          await savePlanningNotes(notes);
          notesExtracted += notes.length;
          console.log(`  Extracted ${notes.length} planning notes from "${meetingLabel}"`);
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

// Debug: inspect stored Zoom transcripts
app.get('/api/zoom/transcripts', async (req, res) => {
  try {
    const { data: meetings } = await supabaseAdmin
      .from('processed_zoom_meetings')
      .select('zoom_meeting_id, meeting_topic, wedding_id, created_at, transcript_text')
      .order('created_at', { ascending: false });

    // Also check planning_notes for zoom_transcript entries
    const { data: transcriptNotes } = await supabaseAdmin
      .from('planning_notes')
      .select('id, wedding_id, content, source_message, created_at')
      .eq('category', 'zoom_transcript')
      .order('created_at', { ascending: false });

    const meetings_summary = (meetings || []).map(m => ({
      id: m.zoom_meeting_id,
      topic: m.meeting_topic,
      wedding_id: m.wedding_id,
      created_at: m.created_at,
      transcript_length: m.transcript_text?.length || 0,
      transcript_preview: m.transcript_text?.substring(0, 300) || null,
      parsed_preview: m.transcript_text ? parseVttToText(m.transcript_text).substring(0, 300) : null
    }));

    const notes_summary = (transcriptNotes || []).map(n => ({
      id: n.id,
      wedding_id: n.wedding_id,
      source: n.source_message,
      created_at: n.created_at,
      content_length: n.content?.length || 0,
      content_preview: n.content?.substring(0, 500) || null
    }));

    res.json({
      processed_meetings: { count: meetings_summary.length, data: meetings_summary },
      zoom_transcript_notes: { count: notes_summary.length, data: notes_summary }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Re-extract planning notes from already-processed Zoom transcripts
app.post('/api/zoom/reextract', async (req, res) => {
  try {
    let sources = [];

    // Primary: processed_zoom_meetings table
    const { data: meetings } = await supabaseAdmin
      .from('processed_zoom_meetings')
      .select('*')
      .not('transcript_text', 'is', null)
      .not('wedding_id', 'is', null);

    if (meetings && meetings.length > 0) {
      sources = meetings.map(m => ({
        text: m.transcript_text,
        wedding_id: m.wedding_id,
        label: m.meeting_topic || 'Untitled'
      }));
    }

    // Fallback: zoom_transcript planning notes (used when processed_zoom_meetings is empty)
    if (sources.length === 0) {
      const { data: transcriptNotes } = await supabaseAdmin
        .from('planning_notes')
        .select('*')
        .eq('category', 'zoom_transcript')
        .not('wedding_id', 'is', null);

      if (transcriptNotes && transcriptNotes.length > 0) {
        sources = transcriptNotes.map(n => {
          // Strip the [Zoom Meeting: ...] header line
          const body = n.content.replace(/^\[Zoom Meeting:[^\]]*\]\n?/, '');
          return {
            text: body,
            wedding_id: n.wedding_id,
            label: n.source_message || 'Zoom meeting'
          };
        });
        console.log(`Re-extract: using ${sources.length} zoom_transcript planning notes as source`);
      }
    }

    if (sources.length === 0) {
      return res.json({ message: 'No Zoom transcripts found to re-extract from.' });
    }

    let totalNotes = 0;
    for (const src of sources) {
      const notes = await extractPlanningNotesAI(src.text, src.wedding_id, `Zoom meeting: ${src.label}`, 'transcript');
      if (notes.length > 0) {
        await savePlanningNotes(notes);
        totalNotes += notes.length;
        console.log(`Re-extracted ${notes.length} notes from "${src.label}"`);
      } else {
        console.log(`No notes extracted from "${src.label}" (text length: ${src.text?.length || 0})`);
      }
    }

    res.json({ message: `Re-extracted ${totalNotes} planning notes from ${sources.length} transcript(s).` });
  } catch (error) {
    console.error('Re-extract error:', error);
    res.status(500).json({ error: 'Failed to re-extract: ' + error.message });
  }
});

// Force resync: clear all processed Zoom data so next Sync re-downloads everything fresh
app.post('/api/zoom/clear', async (req, res) => {
  try {
    // Delete all processed meeting records (dedup table)
    const { error: pmErr } = await supabaseAdmin
      .from('processed_zoom_meetings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // Delete all zoom_transcript planning notes (they'll be re-created by next sync)
    const { error: pnErr } = await supabaseAdmin
      .from('planning_notes')
      .delete()
      .eq('category', 'zoom_transcript');

    if (pmErr) console.error('Error clearing processed_zoom_meetings:', pmErr.message);
    if (pnErr) console.error('Error clearing zoom_transcript notes:', pnErr.message);

    res.json({ success: true, message: 'Cleared all processed Zoom transcripts. Click Sync to re-download everything.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear: ' + error.message });
  }
});

// Disconnect Zoom
app.post('/api/zoom/disconnect', async (req, res) => {
  try {
    await supabaseAdmin.from('zoom_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
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
    const { count, error } = await supabaseAdmin
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
    const { data: question, error: updateError } = await supabaseAdmin
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
      const { error: kbError } = await supabaseAdmin
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

    const { error } = await supabaseAdmin
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

    const { data, error } = await supabaseAdmin
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
    const { id, weddingId, userId, vendorType, vendorName, vendorContact, notes, isBooked } = req.body;

    if (!weddingId || !vendorType) {
      return res.status(400).json({ error: 'Wedding ID and vendor type required' });
    }

    if (id) {
      // Update existing
      const { data, error } = await supabaseAdmin
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

      // Log activity
      await logActivity(weddingId, userId, 'vendor_updated', `${vendorType}: ${vendorName || 'TBD'}${isBooked ? ' (booked)' : ''}`);

      res.json({ vendor: data });
    } else {
      // Create new
      const { data, error } = await supabaseAdmin
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

      // Log activity
      await logActivity(weddingId, userId, 'vendor_added', `${vendorType}: ${vendorName || 'TBD'}`);
      notifyAdminOfActivity(weddingId, 'vendor_added', `${vendorType}: ${vendorName || 'TBD'}`);

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

    const { error } = await supabaseAdmin
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
    const { data: vendor } = await supabaseAdmin
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
    const { data, error } = await supabaseAdmin
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

        await supabaseAdmin.from('contracts').insert({
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
            await supabaseAdmin.from('planning_notes').insert(notesToSave);
            console.log(`Extracted ${notesToSave.length} planning notes from vendor contract upload`);
          }
        }
      } catch (extractErr) {
        console.error('Error extracting notes from vendor contract:', extractErr);
      }
    })();

    // Log activity
    await logActivity(vendor.wedding_id, null, 'contract_uploaded', `${vendor.vendor_type} contract: ${file.originalname}`);
    notifyAdminOfActivity(vendor.wedding_id, 'contract_uploaded', `${vendor.vendor_type} contract: ${file.originalname}`);

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
    const { data: vendor } = await supabaseAdmin
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
    const { data, error } = await supabaseAdmin
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

    const { data, error } = await supabaseAdmin
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
    const { count } = await supabaseAdmin
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
    const { data, error } = await supabaseAdmin
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
            await supabaseAdmin.from('planning_notes').insert(notesToSave);
            console.log(`Extracted ${notesToSave.length} planning notes from inspo image`);
          }
        }
      } catch (notesErr) {
        console.error('Error extracting notes from inspo image:', notesErr);
      }
    })();

    // Log activity for inspo upload
    await logActivity(weddingId, uploadedBy, 'inspo_uploaded', finalCaption || 'Inspiration image uploaded');

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

    const { data, error } = await supabaseAdmin
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
    const { data: image } = await supabaseAdmin
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

    const { error } = await supabaseAdmin
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

    const { data, error } = await supabaseAdmin
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
    const { data: existing } = await supabaseAdmin
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
      const { data: updated, error } = await supabaseAdmin
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
      const { data: created, error } = await supabaseAdmin
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
    const { data: photo } = await supabaseAdmin
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

    const { error } = await supabaseAdmin
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
  // Early Planning
  { task_text: 'Set your budget', category: 'Other', display_order: 1 },
  { task_text: 'Complete all alignment worksheets', category: 'Other', display_order: 2 },
  { task_text: 'Draft your guest list', category: 'Guests', display_order: 3 },
  { task_text: 'Select your wedding party', category: 'Other', display_order: 4 },
  { task_text: 'Book photographer', category: 'Vendors', display_order: 5 },
  { task_text: 'Book videographer', category: 'Vendors', display_order: 6 },
  { task_text: 'Book DJ or band', category: 'Vendors', display_order: 7 },
  { task_text: 'Book hair & makeup', category: 'Attire & Beauty', display_order: 8 },
  { task_text: 'Book officiant', category: 'Vendors', display_order: 9 },
  { task_text: 'Hire florist', category: 'Vendors', display_order: 10 },
  { task_text: 'Choose caterer and menu', category: 'Vendors', display_order: 11 },
  { task_text: 'Schedule engagement photos', category: 'Vendors', display_order: 12 },
  { task_text: 'Reserve hotel room block for guests', category: 'Guests', display_order: 13 },
  { task_text: 'Find wedding dress/attire', category: 'Attire & Beauty', display_order: 14 },
  { task_text: 'Schedule alterations appointments', category: 'Attire & Beauty', display_order: 15 },
  { task_text: 'Coordinate wedding party attire', category: 'Attire & Beauty', display_order: 16 },
  { task_text: 'Buy wedding rings', category: 'Attire & Beauty', display_order: 17 },
  // Guest & Communication
  { task_text: 'Send save-the-dates', category: 'Guests', display_order: 18 },
  { task_text: 'Create wedding website', category: 'Guests', display_order: 19 },
  { task_text: 'Design invitations', category: 'Guests', display_order: 20 },
  { task_text: 'Send invitations (2 months before)', category: 'Guests', display_order: 21 },
  { task_text: 'Track RSVPs', category: 'Guests', display_order: 22 },
  { task_text: 'Chase non-responders', category: 'Guests', display_order: 23 },
  { task_text: 'Finalize guest count for caterer', category: 'Guests', display_order: 24 },
  { task_text: 'Create seating chart', category: 'Guests', display_order: 25 },
  // Logistics
  { task_text: 'Arrange transportation/shuttles', category: 'Vendors', display_order: 26 },
  { task_text: 'Plan big rentals (tent, specialty items)', category: 'Decor', display_order: 27 },
  { task_text: 'Arrange smaller rentals and décor', category: 'Decor', display_order: 28 },
  { task_text: 'Plan rehearsal dinner', category: 'Timeline', display_order: 29 },
  { task_text: 'Confirm with all vendors (times, locations)', category: 'Vendors', display_order: 30 },
  { task_text: 'Finalize detailed timeline with Rixey team', category: 'Timeline', display_order: 31 },
  { task_text: 'Final dress fitting', category: 'Attire & Beauty', display_order: 32 },
  { task_text: 'Obtain marriage license (within 60 days of wedding)', category: 'Other', display_order: 33 },
  { task_text: 'Prepare tips and final payment envelopes', category: 'Other', display_order: 34 },
  // Final Week
  { task_text: 'Final vendor confirmations', category: 'Vendors', display_order: 35 },
  { task_text: 'Pack all décor items (labeled by area)', category: 'Decor', display_order: 36 },
  { task_text: 'Prepare day-of emergency kit', category: 'Other', display_order: 37 },
  { task_text: 'Gather ceremony items (rings, license, unity items)', category: 'Other', display_order: 38 },
  { task_text: 'Plan day-of meals for wedding party', category: 'Other', display_order: 39 },
  { task_text: 'Write vows', category: 'Other', display_order: 40 },
  { task_text: 'Get marriage license', category: 'Other', display_order: 41 },
];

// Get checklist for a wedding
app.get('/api/checklist/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { data, error } = await supabaseAdmin
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
    const { count } = await supabaseAdmin
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

    const { data, error } = await supabaseAdmin
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
    const { data: maxOrder } = await supabaseAdmin
      .from('planning_checklist')
      .select('display_order')
      .eq('wedding_id', weddingId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await supabaseAdmin
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

    const { data, error } = await supabaseAdmin
      .from('planning_checklist')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log activity when task is completed
    if (isCompleted && data.wedding_id) {
      await logActivity(data.wedding_id, completedBy, 'checklist_completed', data.task_text);
    }

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
    const { data: task } = await supabaseAdmin
      .from('planning_checklist')
      .select('is_custom')
      .eq('id', id)
      .single();

    if (!task?.is_custom) {
      return res.status(400).json({ error: 'Cannot delete default tasks' });
    }

    const { error } = await supabaseAdmin
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
  const { data: tasks } = await supabaseAdmin
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

    const { data, error } = await supabaseAdmin
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
    const { data: usage, error } = await supabaseAdmin
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

    const { data: usage, error } = await supabaseAdmin
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
    const { data, error } = await supabaseAdmin
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

    const { data, error } = await supabaseAdmin
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

    const { data, error } = await supabaseAdmin
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

    const { error } = await supabaseAdmin
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

// ============ RECOMMENDED VENDORS ============

// Get all recommended vendors (with optional category filter)
app.get('/api/recommended-vendors', async (req, res) => {
  try {
    const { category } = req.query;

    let query = supabaseAdmin
      .from('vendors')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get unique categories for filter dropdown
    const categories = [...new Set((data || []).map(v => v.category))].sort();

    res.json({ vendors: data || [], categories });
  } catch (error) {
    console.error('Get recommended vendors error:', error);
    res.status(500).json({ error: 'Failed to get vendors' });
  }
});

// Get single vendor by ID
app.get('/api/recommended-vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json({ vendor: data });
  } catch (error) {
    console.error('Get vendor error:', error);
    res.status(500).json({ error: 'Failed to get vendor' });
  }
});

// Create new recommended vendor
app.post('/api/recommended-vendors', async (req, res) => {
  try {
    const {
      category, name, notes, contact, website, pricing_info,
      has_multiple_events, is_local, is_budget_friendly,
      serves_indian, serves_chinese
    } = req.body;

    if (!category || !name) {
      return res.status(400).json({ error: 'Category and name are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .insert({
        category,
        name,
        notes: notes || null,
        contact: contact || null,
        website: website || null,
        pricing_info: pricing_info || null,
        has_multiple_events: has_multiple_events || false,
        is_local: is_local || false,
        is_budget_friendly: is_budget_friendly || false,
        serves_indian: serves_indian || false,
        serves_chinese: serves_chinese || false
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ vendor: data });
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

// Update recommended vendor
app.put('/api/recommended-vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // Remove id from updates if present
    delete updates.id;

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ vendor: data });
  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

// Delete recommended vendor
app.delete('/api/recommended-vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('vendors')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

// ── Vendor Portal (token-based, no auth required) ─────────────────────────────

// GET published vendor list for client-facing directory
app.get('/api/vendor-directory', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('vendors')
      .select('id, category, name, bio, photos, website, contact, instagram, facebook, pricing_info, special_offer, special_expiry, availability_note, is_budget_friendly, is_local, has_multiple_events, serves_indian, serves_chinese')
      .eq('is_published', true)
      .order('category').order('name');
    if (error) throw error;
    const categories = [...new Set((data || []).map(v => v.category))].sort();
    res.json({ vendors: data || [], categories });
  } catch (err) {
    console.error('Vendor directory error:', err);
    res.status(500).json({ error: 'Failed to load vendor directory' });
  }
});

// GET vendor by token (vendor self-edit portal)
app.get('/api/vendor-portal/:token', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('vendors')
      .select('id, category, name, bio, photos, website, contact, pricing_info, instagram, facebook, special_offer, special_expiry, availability_note, is_published, last_vendor_update')
      .eq('edit_token', req.params.token)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ vendor: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load vendor' });
  }
});

// PUT update vendor profile via token
app.put('/api/vendor-portal/:token', async (req, res) => {
  try {
    const allowed = ['bio', 'contact', 'website', 'pricing_info', 'instagram', 'facebook', 'special_offer', 'special_expiry', 'availability_note'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f] || null; });
    updates.last_vendor_update = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update(updates)
      .eq('edit_token', req.params.token)
      .select('id, category, name, bio, photos, website, contact, pricing_info, instagram, facebook, special_offer, special_expiry, availability_note, is_published, last_vendor_update')
      .single();
    if (error || !data) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ vendor: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

// POST upload photo via token
app.post('/api/vendor-portal/:token/photos', upload.single('photo'), async (req, res) => {
  try {
    const { data: vendor, error: vErr } = await supabaseAdmin
      .from('vendors')
      .select('id, photos')
      .eq('edit_token', req.params.token)
      .single();
    if (vErr || !vendor) return res.status(404).json({ error: 'Vendor not found' });

    const photos = vendor.photos || [];
    if (photos.length >= 8) return res.status(400).json({ error: 'Maximum 8 photos allowed' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const filename = `${vendor.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from('vendor-photos')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (upErr) throw upErr;

    const { data: urlData } = supabaseAdmin.storage.from('vendor-photos').getPublicUrl(filename);
    const newPhotos = [...photos, urlData.publicUrl];

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update({ photos: newPhotos, last_vendor_update: new Date().toISOString() })
      .eq('id', vendor.id)
      .select('photos')
      .single();
    if (error) throw error;
    res.json({ photos: data.photos });
  } catch (err) {
    console.error('Vendor photo upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// DELETE remove a photo via token
app.delete('/api/vendor-portal/:token/photos', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    const { data: vendor, error: vErr } = await supabaseAdmin
      .from('vendors')
      .select('id, photos')
      .eq('edit_token', req.params.token)
      .single();
    if (vErr || !vendor) return res.status(404).json({ error: 'Vendor not found' });

    // Remove from storage
    const parts = url.split('/vendor-photos/');
    if (parts[1]) {
      await supabaseAdmin.storage.from('vendor-photos').remove([parts[1]]);
    }

    const newPhotos = (vendor.photos || []).filter(p => p !== url);
    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update({ photos: newPhotos })
      .eq('id', vendor.id)
      .select('photos')
      .single();
    if (error) throw error;
    res.json({ photos: data.photos });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove photo' });
  }
});

// PUT toggle publish status (admin)
app.put('/api/recommended-vendors/:id/publish', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update({ is_published: req.body.is_published })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ vendor: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update publish status' });
  }
});

// ============ ONBOARDING PROGRESS ============

// Get onboarding progress for a wedding
app.get('/api/onboarding/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    // Get or create onboarding record
    let { data, error } = await supabaseAdmin
      .from('onboarding_progress')
      .select('*')
      .eq('wedding_id', weddingId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Not found, create it
      const { data: newData, error: insertError } = await supabaseAdmin
        .from('onboarding_progress')
        .insert({ wedding_id: weddingId })
        .select()
        .single();

      if (insertError) throw insertError;
      data = newData;
    } else if (error) {
      throw error;
    }

    // Also check actual progress from related tables (use admin to bypass RLS)
    const [couplePhoto, messages, vendors, inspo, checklist] = await Promise.all([
      supabaseAdmin.from('couple_photos').select('id').eq('wedding_id', weddingId).single(),
      supabaseAdmin.from('messages').select('id').eq('wedding_id', weddingId).limit(1),
      supabaseAdmin.from('vendor_checklist').select('id').eq('wedding_id', weddingId).limit(1),
      supabaseAdmin.from('inspo_gallery').select('id').eq('wedding_id', weddingId).limit(1),
      supabaseAdmin.from('planning_checklist').select('id').eq('wedding_id', weddingId).eq('is_completed', true).limit(1)
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

    const { data, error } = await supabaseAdmin
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

    const { data, error } = await supabaseAdmin
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

    const { data, error } = await supabaseAdmin
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

    // Log activity + create notifications
    if (senderType === 'client') {
      await logActivity(weddingId, senderId, 'message_sent', content.substring(0, 100));
      // Notify admin of new client message
      const { data: wedding } = await supabaseAdmin
        .from('weddings').select('couple_names').eq('id', weddingId).single();
      const couple = wedding?.couple_names || 'A client';
      await createNotification(
        weddingId, 'admin', 'new_message',
        `New message from ${couple}`,
        content.substring(0, 200),
        process.env.ADMIN_EMAIL
      );
      // Escalation check
      if (hasEscalation(content)) {
        await createNotification(
          weddingId, 'admin', 'escalation',
          `${couple} may need attention`,
          content.substring(0, 200),
          process.env.ADMIN_EMAIL
        );
      }
    } else if (senderType === 'admin') {
      // Notify client of new admin message
      const { data: wedding } = await supabaseAdmin
        .from('weddings').select('profiles(email)').eq('id', weddingId).single();
      const clientEmail = wedding?.profiles?.email;
      await createNotification(
        weddingId, 'client', 'new_message',
        'New message from Rixey Manor',
        content.substring(0, 200),
        clientEmail
      );
    }

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

    const { data, error } = await supabaseAdmin
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

    const { count, error } = await supabaseAdmin
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
    const { data, error } = await supabaseAdmin
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
    const { data, error } = await supabaseAdmin
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

// ============ SAGE CHAT MESSAGES (for admin view) ============

// Get admin notifications (bypasses RLS)
// Last 24 hours summary — new signups + recent activity
app.get('/api/admin/last-24h', async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [signups, activity] = await Promise.all([
      supabaseAdmin
        .from('weddings')
        .select('id, couple_names, wedding_date, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('activity_log')
        .select('id, wedding_id, activity_type, details, created_at, weddings(couple_names)')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(60),
    ]);

    res.json({
      signups:  signups.data  || [],
      activity: activity.data || [],
    });
  } catch (err) {
    console.error('Last 24h error:', err);
    res.status(500).json({ error: 'Failed to fetch last 24h data' });
  }
});

app.get('/api/admin/notifications', async (req, res) => {
  try {
    const { data: notifications, error } = await supabaseAdmin
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    // If table doesn't exist, just return empty array
    if (error && error.code === '42P01') {
      return res.json({ notifications: [] });
    }
    if (error) throw error;

    res.json({ notifications: notifications || [] });
  } catch (error) {
    console.error('Get admin notifications error:', error);
    // Return empty array instead of 500 if table doesn't exist
    res.json({ notifications: [] });
  }
});

// Mark admin notification as read (bypasses RLS)
app.put('/api/admin/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('admin_notifications')
      .update({ read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ notification: data });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Create admin notification (bypasses RLS)
app.post('/api/admin/notifications', async (req, res) => {
  try {
    const { type, message, wedding_id, user_id } = req.body;

    const { data, error } = await supabaseAdmin
      .from('admin_notifications')
      .insert({
        type,
        message,
        wedding_id,
        user_id,
        read: false
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ notification: data });
  } catch (error) {
    console.error('Create admin notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Get all weddings with profiles for admin dashboard (bypasses RLS)
app.get('/api/admin/weddings', async (req, res) => {
  try {
    const { data: weddings, error } = await supabaseAdmin
      .from('weddings')
      .select('*, profiles(*)')
      .order('wedding_date', { ascending: true });

    if (error) throw error;

    res.json({ weddings: weddings || [] });
  } catch (error) {
    console.error('Get admin weddings error:', error);
    res.status(500).json({ error: 'Failed to fetch weddings' });
  }
});

// Communication pulse — how active is a couple vs what's expected at their planning stage
// Returns level ('less'|'typical'|'more'), score, expected range, and stage label
function getPulseStage(weddingDate, createdAt) {
  const now = new Date();
  const wedding = new Date(weddingDate);
  const booked = new Date(createdAt);
  const monthsToWedding = (wedding - now) / (1000 * 60 * 60 * 24 * 30.5);
  const weeksPostBooking = (now - booked) / (1000 * 60 * 60 * 24 * 7);
  const justBooked = weeksPostBooking < 8;

  // Base stage from months to wedding
  let stage, min, max;
  if (monthsToWedding >= 12)        { stage = '12+ months out'; min = 0; max = 3; }
  else if (monthsToWedding >= 6)    { stage = '6–12 months out'; min = 1; max = 5; }
  else if (monthsToWedding >= 3)    { stage = '3–6 months out'; min = 2; max = 7; }
  else if (monthsToWedding >= 1)    { stage = '1–3 months out'; min = 4; max = 10; }
  else                              { stage = 'Final stretch'; min = 7; max = 25; }

  // Just-booked window overrides with a more generous range
  if (justBooked) { stage = 'Just booked'; min = 5; max = 20; }

  return { stage, min, max };
}

app.get('/api/communication-pulse/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: wedding, error: wErr } = await supabaseAdmin
      .from('weddings')
      .select('wedding_date, created_at, user_id')
      .eq('id', weddingId)
      .single();

    if (wErr || !wedding) return res.status(404).json({ error: 'Wedding not found' });

    // Count all inbound communication channels in parallel — each query isolated so one bad table doesn't fail all
    const safeCount = async (fn) => { try { const r = await fn(); return r.count || 0; } catch { return 0; } };

    const [emailCt, textCt, zoomCt, sageCt, dmCt, actCt] = await Promise.all([
      safeCount(() => supabaseAdmin.from('processed_emails').select('id', { count: 'exact', head: true }).eq('wedding_id', weddingId).gte('created_at', since)),
      safeCount(() => supabaseAdmin.from('processed_quo_messages').select('id', { count: 'exact', head: true }).eq('wedding_id', weddingId).eq('direction', 'inbound').gte('created_at', since)),
      safeCount(() => supabaseAdmin.from('processed_zoom_meetings').select('id', { count: 'exact', head: true }).eq('wedding_id', weddingId).gte('created_at', since)),
      safeCount(() => supabaseAdmin.from('messages').select('id', { count: 'exact', head: true }).eq('user_id', wedding.user_id).eq('sender', 'user').gte('created_at', since)),
      safeCount(() => supabaseAdmin.from('direct_messages').select('id', { count: 'exact', head: true }).eq('wedding_id', weddingId).eq('sender_type', 'client').gte('created_at', since)),
      safeCount(() => supabaseAdmin.from('activity_log').select('id', { count: 'exact', head: true }).eq('wedding_id', weddingId).gte('created_at', since)),
    ]);

    // Weight: direct comms count full, portal activity counts half
    const score = Math.round(emailCt + textCt + zoomCt + sageCt + dmCt + actCt * 0.5);

    const { stage, min, max } = getPulseStage(wedding.wedding_date, wedding.created_at);
    const level = score < min ? 'less' : score > max ? 'more' : 'typical';

    res.json({
      level,
      score,
      expected: { min, max },
      stage,
      breakdown: {
        emails: emailCt,
        texts: textCt,
        zooms: zoomCt,
        sageChat: sageCt,
        directMessages: dmCt,
        portalActivity: actCt,
      }
    });
  } catch (error) {
    console.error('Communication pulse error:', error);
    res.status(500).json({ error: 'Failed to calculate pulse' });
  }
});

// Batch pulse for all weddings (used by admin list view)
app.get('/api/communication-pulse', async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: weddings, error: wErr } = await supabaseAdmin
      .from('weddings')
      .select('id, wedding_date, created_at, user_id');

    console.log('[Pulse] weddings query:', weddings?.length ?? 'null', wErr?.message ?? 'no error');
    if (!weddings?.length) return res.json({ pulses: {} });

    // Fetch all counts in parallel — each query is individually resilient so one bad table doesn't kill the response
    const safeQ = async (fn) => { try { const r = await fn(); if (r.error) { console.warn('[Pulse] Query error:', r.error.message); } return r.data || []; } catch (e) { console.warn('[Pulse] Query threw:', e.message); return []; } };

    const [emails, texts, zooms, sageMsgs, directMsgs, activity] = await Promise.all([
      safeQ(() => supabaseAdmin.from('processed_emails').select('wedding_id').gte('created_at', since)),
      safeQ(() => supabaseAdmin.from('processed_quo_messages').select('wedding_id').eq('direction', 'inbound').gte('created_at', since)),
      safeQ(() => supabaseAdmin.from('processed_zoom_meetings').select('wedding_id').gte('created_at', since)),
      safeQ(() => supabaseAdmin.from('messages').select('user_id').eq('sender', 'user').gte('created_at', since)),
      safeQ(() => supabaseAdmin.from('direct_messages').select('wedding_id').eq('sender_type', 'client').gte('created_at', since)),
      safeQ(() => supabaseAdmin.from('activity_log').select('wedding_id').gte('created_at', since)),
    ]);

    // Build user_id → wedding_id map
    const userToWedding = {};
    weddings.forEach(w => { if (w.user_id) userToWedding[w.user_id] = w.id; });

    // Count per wedding
    const counts = {};
    weddings.forEach(w => { counts[w.id] = { emails: 0, texts: 0, zooms: 0, sage: 0, dm: 0, activity: 0 }; });
    emails.forEach(r => { if (counts[r.wedding_id]) counts[r.wedding_id].emails++; });
    texts.forEach(r => { if (counts[r.wedding_id]) counts[r.wedding_id].texts++; });
    zooms.forEach(r => { if (counts[r.wedding_id]) counts[r.wedding_id].zooms++; });
    sageMsgs.forEach(r => {
      const wid = userToWedding[r.user_id];
      if (wid && counts[wid]) counts[wid].sage++;
    });
    directMsgs.forEach(r => { if (counts[r.wedding_id]) counts[r.wedding_id].dm++; });
    activity.forEach(r => { if (counts[r.wedding_id]) counts[r.wedding_id].activity++; });

    const pulses = {};
    weddings.forEach(w => {
      const c = counts[w.id];
      const score = Math.round(c.emails + c.texts + c.zooms + c.sage + c.dm + c.activity * 0.5);
      const { stage, min, max } = getPulseStage(w.wedding_date, w.created_at);
      pulses[w.id] = { level: score < min ? 'less' : score > max ? 'more' : 'typical', score, stage };
    });

    console.log('[Pulse] returning pulses for', Object.keys(pulses).length, 'weddings');
    res.json({ pulses });
  } catch (error) {
    console.error('Batch pulse error:', error);
    res.status(500).json({ error: 'Failed to calculate pulses' });
  }
});

// Get all couple photos for admin dashboard (bypasses RLS)
app.get('/api/couple-photos/all', async (req, res) => {
  try {
    const { data: photos, error } = await supabaseAdmin
      .from('couple_photos')
      .select('wedding_id, image_url');

    if (error) throw error;

    res.json({ photos: photos || [] });
  } catch (error) {
    console.error('Get all couple photos error:', error);
    res.status(500).json({ error: 'Failed to fetch couple photos' });
  }
});

// Update wedding links (bypasses RLS)
app.put('/api/weddings/:weddingId/links', async (req, res) => {
  try {
    const { weddingId } = req.params;
    const { honeybook_link, google_sheets_link } = req.body;

    const { data, error } = await supabaseAdmin
      .from('weddings')
      .update({ honeybook_link, google_sheets_link })
      .eq('id', weddingId)
      .select()
      .single();

    if (error) throw error;

    res.json({ wedding: data });
  } catch (error) {
    console.error('Update wedding links error:', error);
    res.status(500).json({ error: 'Failed to update wedding links' });
  }
});

// Toggle wedding archived status (bypasses RLS)
app.put('/api/weddings/:weddingId/archive', async (req, res) => {
  try {
    const { weddingId } = req.params;
    const { archived } = req.body;

    const { data, error } = await supabaseAdmin
      .from('weddings')
      .update({ archived })
      .eq('id', weddingId)
      .select()
      .single();

    if (error) throw error;

    res.json({ wedding: data });
  } catch (error) {
    console.error('Toggle archive error:', error);
    res.status(500).json({ error: 'Failed to toggle archive status' });
  }
});

// Mark escalation as handled (bypasses RLS)
app.put('/api/weddings/:weddingId/escalation', async (req, res) => {
  try {
    const { weddingId } = req.params;
    const { escalation_handled_at } = req.body;

    const { data, error } = await supabaseAdmin
      .from('weddings')
      .update({ escalation_handled_at })
      .eq('id', weddingId)
      .select()
      .single();

    if (error) throw error;

    res.json({ wedding: data });
  } catch (error) {
    console.error('Mark escalation handled error:', error);
    res.status(500).json({ error: 'Failed to mark escalation as handled' });
  }
});

// ============ BORROW SELECTIONS ============

// GET /api/borrow-selections/:weddingId
app.get('/api/borrow-selections/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('wedding_borrow_selections')
      .select('item_id, borrow_catalog(item_name, category, image_url)')
      .eq('wedding_id', weddingId);
    if (error) throw error;
    const selections = (data || []).map(row => ({
      item_id: row.item_id,
      item_name: row.borrow_catalog?.item_name,
      category: row.borrow_catalog?.category,
      image_url: row.borrow_catalog?.image_url,
    }));
    res.json({ selections });
  } catch (error) {
    console.error('Get borrow selections error:', error);
    res.status(500).json({ error: 'Failed to fetch borrow selections' });
  }
});

// POST /api/borrow-selections — toggle selection on/off and update planning note
app.post('/api/borrow-selections', async (req, res) => {
  try {
    const { weddingId, itemId, selected } = req.body;
    if (!weddingId || !itemId) return res.status(400).json({ error: 'weddingId and itemId required' });

    if (selected) {
      const { error } = await supabaseAdmin
        .from('wedding_borrow_selections')
        .upsert({ wedding_id: weddingId, item_id: itemId }, { onConflict: 'wedding_id,item_id' });
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from('wedding_borrow_selections')
        .delete()
        .eq('wedding_id', weddingId)
        .eq('item_id', itemId);
      if (error) throw error;
    }

    // Fetch all currently selected item names for this wedding
    const { data: allSelections } = await supabaseAdmin
      .from('wedding_borrow_selections')
      .select('borrow_catalog(item_name)')
      .eq('wedding_id', weddingId);

    const itemNames = (allSelections || [])
      .map(s => s.borrow_catalog?.item_name)
      .filter(Boolean);

    // Replace existing borrow_selection note with updated list (delete + insert)
    await supabaseAdmin
      .from('planning_notes')
      .delete()
      .eq('wedding_id', weddingId)
      .eq('category', 'borrow_selection');

    if (itemNames.length > 0) {
      await supabaseAdmin
        .from('planning_notes')
        .insert({
          wedding_id: weddingId,
          category: 'borrow_selection',
          content: `Couple wants to borrow: ${itemNames.join(', ')}`,
          status: 'confirmed',
        });
    }

    res.json({ success: true, selectedCount: itemNames.length });
  } catch (error) {
    console.error('Toggle borrow selection error:', error);
    res.status(500).json({ error: 'Failed to update borrow selection' });
  }
});

// POST /api/admin/borrow-catalog — admin adds a new catalog item (with optional image upload)
app.post('/api/admin/borrow-catalog', upload.single('image'), async (req, res) => {
  try {
    const { item_name, category, description } = req.body;
    if (!item_name || !category) return res.status(400).json({ error: 'item_name and category required' });

    let image_url = null;

    // Upload image to Supabase storage if provided
    if (req.file) {
      const ext = req.file.mimetype.split('/')[1] || 'jpg';
      const fileName = `${Date.now()}-${item_name.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('borrow-catalog')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });
      if (uploadError) {
        console.error('Image upload error:', uploadError);
      } else {
        const { data: urlData } = supabaseAdmin.storage
          .from('borrow-catalog')
          .getPublicUrl(fileName);
        image_url = urlData?.publicUrl || null;
      }
    }

    const { data: newItem, error } = await supabaseAdmin
      .from('borrow_catalog')
      .insert({ item_name, category, description: description || null, image_url })
      .select()
      .single();

    if (error) throw error;
    res.json({ item: newItem });
  } catch (error) {
    console.error('Admin add borrow catalog error:', error);
    res.status(500).json({ error: 'Failed to add catalog item' });
  }
});

// Borrow catalog
app.get('/api/borrow-catalog', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('borrow_catalog')
      .select('*')
      .order('category')
      .order('item_name');
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Borrow catalog error:', error);
    res.status(500).json({ error: 'Failed to fetch borrow catalog' });
  }
});

// Get messages for a specific user (for Dashboard)
app.get('/api/sage-messages/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ messages: messages || [] });
  } catch (error) {
    console.error('Get user messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Save a Sage chat message (bypasses RLS)
app.post('/api/sage-messages', async (req, res) => {
  try {
    const { user_id, content, sender } = req.body;

    if (!user_id || !content || !sender) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert([{ user_id, content, sender }])
      .select()
      .single();

    if (error) throw error;

    res.json({ message: data });
  } catch (error) {
    console.error('Save sage message error:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Admin check-in: sends a warm canned message to a couple's Sage chat + notification
app.post('/api/checkin/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    // Get the user_id for this wedding
    const { data: wedding, error: weddingErr } = await supabaseAdmin
      .from('weddings')
      .select('user_id, couple_names')
      .eq('id', weddingId)
      .single();

    if (weddingErr || !wedding) return res.status(404).json({ error: 'Wedding not found' });

    const message = "Hey! It's been a minute since we've checked in — how's planning going? Anything you'd like to update in your portal, or questions you've been sitting on? We're here! 💛";

    // Inject into their Sage chat thread
    const { error: msgErr } = await supabaseAdmin
      .from('messages')
      .insert([{ user_id: wedding.user_id, content: message, sender: 'sage', is_team_note: true }]);

    if (msgErr) throw msgErr;

    // Send a client notification
    await createNotification(
      weddingId, 'client', 'checkin',
      'A note from the Rixey team',
      message,
      null
    );

    console.log(`Check-in sent to ${wedding.couple_names} (${weddingId})`);
    res.json({ success: true });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to send check-in' });
  }
});

// Admin injects a team note into a couple's Sage chat thread
app.post('/api/sage-messages/inject', async (req, res) => {
  try {
    const { user_id, content, addToKb, kbCategory, kbSubcategory } = req.body;
    if (!user_id || !content) {
      return res.status(400).json({ error: 'user_id and content required' });
    }

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert([{ user_id, content, sender: 'sage', is_team_note: true }])
      .select()
      .single();

    if (error) throw error;

    // Optionally save to knowledge base
    if (addToKb && content.trim()) {
      await supabaseAdmin.from('knowledge_base').insert({
        title: content.substring(0, 80),
        content,
        category: kbCategory || 'General',
        subcategory: kbSubcategory || null,
        active: true
      });
    }

    res.json({ message: data });
  } catch (error) {
    console.error('Inject team note error:', error);
    res.status(500).json({ error: 'Failed to inject note' });
  }
});

// Get all Sage chat messages for all weddings (admin view - for escalation detection)
app.get('/api/sage-messages/all', async (req, res) => {
  try {
    // Get all messages using admin client
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ messages: messages || [] });
  } catch (error) {
    console.error('Get all sage messages error:', error);
    res.status(500).json({ error: 'Failed to fetch Sage messages' });
  }
});

// Get Sage chat messages for a wedding (uses supabaseAdmin to bypass RLS)
app.get('/api/sage-messages/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    // First get all profile IDs for this wedding
    const { data: wedding, error: weddingError } = await supabaseAdmin
      .from('weddings')
      .select('profiles(id)')
      .eq('id', weddingId)
      .single();

    if (weddingError) throw weddingError;

    const userIds = wedding?.profiles?.map(p => p.id) || [];

    if (userIds.length === 0) {
      return res.json({ messages: [] });
    }

    // Fetch messages for these users using admin client
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(200);

    if (messagesError) throw messagesError;

    res.json({ messages: messages || [] });
  } catch (error) {
    console.error('Get sage messages error:', error);
    res.status(500).json({ error: 'Failed to fetch Sage messages' });
  }
});

// Get planning notes for a wedding (uses supabaseAdmin to bypass RLS)
app.get('/api/planning-notes/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { data: notes, error } = await supabaseAdmin
      .from('planning_notes')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ notes: notes || [] });
  } catch (error) {
    console.error('Get planning notes error:', error);
    res.status(500).json({ error: 'Failed to fetch planning notes' });
  }
});

// Get activity log for a wedding
app.get('/api/activities/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const { data: activities, error } = await supabaseAdmin
      .from('activity_log')
      .select('*, profiles(name)')
      .eq('wedding_id', weddingId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({ activities: activities || [] });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Update planning note status (uses supabaseAdmin to bypass RLS)
app.put('/api/planning-notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const { status } = req.body;

    const { data, error } = await supabaseAdmin
      .from('planning_notes')
      .update({ status })
      .eq('id', noteId)
      .select()
      .single();

    if (error) throw error;

    res.json({ note: data });
  } catch (error) {
    console.error('Update planning note error:', error);
    res.status(500).json({ error: 'Failed to update planning note' });
  }
});

// ============ PLANNING TOOLS ============

// Get wedding timeline
app.get('/api/timeline/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { data, error } = await supabaseAdmin
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
    const { weddingId, timelineData, ceremonyStart, receptionStart, receptionEnd, notes, userId } = req.body;

    const { data, error } = await supabaseAdmin
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

    // Log activity
    await logActivity(weddingId, userId, 'timeline_updated', `Ceremony: ${ceremonyStart}`);
    notifyAdminOfActivity(weddingId, 'timeline_updated', `Ceremony at ${ceremonyStart}`);

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

    const { data, error } = await supabaseAdmin
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
      weddingId, userId, guestCount, tableShape, guestsPerTable,
      headTable, headTableSize, headTableSided, sweetheartTable,
      cocktailTables, kidsTable, kidsCount,
      layoutNotes, linenColor, napkinColor,
      centerpieceNotes, extraTables,
      linenVenueChoice, runnerStyle,
      chargersOn, checkeredDanceFloor,
      loungeArea, linenNotes
    } = req.body;

    const { data, error } = await supabaseAdmin
      .from('wedding_tables')
      .upsert({
        wedding_id:           weddingId,
        guest_count:          guestCount,
        table_shape:          tableShape,
        guests_per_table:     guestsPerTable,
        head_table:           headTable,
        head_table_size:      headTableSize,      // # people at head table
        head_table_placement: headTableSided,     // 'one' or 'two' (repurposed field)
        sweetheart_table:     sweetheartTable,
        cocktail_tables:      cocktailTables,
        kids_table:           kidsTable,
        kids_count:           kidsCount,
        layout_notes:         layoutNotes,
        linen_color:          linenColor,
        napkin_color:         napkinColor,
        centerpiece_notes:    centerpieceNotes,
        extra_tables:         extraTables || {},
        linen_venue_choice:   linenVenueChoice,
        runner_style:         runnerStyle,
        chair_sash:           chargersOn,         // repurposed for chargers
        dance_floor_size:     checkeredDanceFloor ? 'checkered' : 'none',
        lounge_area:          loungeArea,
        linen_notes:          linenNotes,
        updated_at:           new Date().toISOString()
      }, { onConflict: 'wedding_id' })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logActivity(weddingId, userId, 'tables_updated', `${guestCount} guests, ${tableShape} tables`);
    notifyAdminOfActivity(weddingId, 'tables_updated', `${guestCount} guests, ${tableShape} tables`);

    // Floor plan alert — not rate-limited, always fires on save
    try {
      const { data: wedding } = await supabaseAdmin.from('weddings').select('couple_names').eq('id', weddingId).single();
      const couple = wedding?.couple_names || 'Your couple';
      await createNotification(
        weddingId, 'admin', 'floor_plan_needed',
        `📐 Floor plan needed — ${couple}`,
        `${couple} saved their table setup (${guestCount} guests, ${tableShape} tables). Build their floor plan.`
      );
    } catch (notifErr) {
      console.error('[Tables] Floor plan notification error:', notifErr.message);
    }

    res.json({ tables: data });
  } catch (error) {
    console.error('Save tables error:', error);
    res.status(500).json({ error: 'Failed to save table setup' });
  }
});

// ── Manor Assets (brand downloads) ───────────────────────────────────────────

// List all assets (public)
app.get('/api/manor-assets', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('manor_assets')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Get manor assets error:', err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Upload new asset (admin only — multipart/form-data)
app.post('/api/manor-assets', upload.single('file'), async (req, res) => {
  try {
    const { title, description, sort_order } = req.body;
    const file = req.file;
    if (!file || !title) return res.status(400).json({ error: 'file and title required' });

    const ext          = file.originalname.split('.').pop();
    const storagePath  = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from('manor-assets')
      .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });
    if (upErr) throw upErr;

    const { data: { publicUrl } } = supabaseAdmin.storage.from('manor-assets').getPublicUrl(storagePath);

    const { data, error } = await supabaseAdmin
      .from('manor_assets')
      .insert({
        title,
        description: description || null,
        storage_path: storagePath,
        file_name: file.originalname,
        mime_type: file.mimetype,
        sort_order: Number(sort_order) || 0,
      })
      .select()
      .single();
    if (error) throw error;

    res.json({ ...data, publicUrl });
  } catch (err) {
    console.error('Upload manor asset error:', err);
    res.status(500).json({ error: 'Failed to upload asset' });
  }
});

// Update asset title / description / sort order (admin)
app.put('/api/manor-assets/:id', async (req, res) => {
  try {
    const { title, description, sort_order } = req.body;
    const { data, error } = await supabaseAdmin
      .from('manor_assets')
      .update({ title, description, sort_order })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Update manor asset error:', err);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// Delete asset (admin)
app.delete('/api/manor-assets/:id', async (req, res) => {
  try {
    const { data: asset, error: fetchErr } = await supabaseAdmin
      .from('manor_assets')
      .select('storage_path')
      .eq('id', req.params.id)
      .single();
    if (fetchErr) throw fetchErr;

    // Remove from storage
    await supabaseAdmin.storage.from('manor-assets').remove([asset.storage_path]);

    const { error } = await supabaseAdmin.from('manor_assets').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete manor asset error:', err);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// ── Staffing ──────────────────────────────────────────────────────────────────

// Get staffing estimate
app.get('/api/staffing/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;

    const { data, error } = await supabaseAdmin
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
      userId,
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

    const { data, error } = await supabaseAdmin
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

    // Log activity
    await logActivity(weddingId, userId, 'staffing_updated', `${totalStaff} total staff, $${totalCost} estimated`);
    notifyAdminOfActivity(weddingId, 'staffing_updated', `${totalStaff} total staff, $${totalCost} estimated`);

    res.json({ staffing: data });
  } catch (error) {
    console.error('Save staffing error:', error);
    res.status(500).json({ error: 'Failed to save staffing estimate' });
  }
});

// ============ BUDGET ============

app.get('/api/budget/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('wedding_budget')
      .select('*')
      .eq('wedding_id', weddingId)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({ error: 'No budget found' });
    }
    if (error) throw error;

    res.json({ budget: data });
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({ error: 'Failed to load budget' });
  }
});

app.post('/api/budget', async (req, res) => {
  try {
    const { weddingId, totalBudget, isShared, categories } = req.body;
    if (!weddingId) return res.status(400).json({ error: 'weddingId required' });

    const { data, error } = await supabaseAdmin
      .from('wedding_budget')
      .upsert({
        wedding_id: weddingId,
        total_budget: totalBudget || 0,
        is_shared: isShared || false,
        categories: categories || {},
        updated_at: new Date().toISOString()
      }, { onConflict: 'wedding_id' })
      .select()
      .single();

    if (error) throw error;

    res.json({ budget: data });
  } catch (error) {
    console.error('Save budget error:', error);
    res.status(500).json({ error: 'Failed to save budget' });
  }
});

// ============ GUEST CARE API ============

// Get guest care notes for a wedding
app.get('/api/guest-care/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('wedding_guest_care')
      .select('data, updated_at')
      .eq('wedding_id', req.params.weddingId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data: data?.data || {}, updated_at: data?.updated_at || null });
  } catch (error) {
    console.error('Get guest care error:', error);
    res.status(500).json({ error: 'Failed to fetch guest care notes' });
  }
});

// Save (upsert) guest care notes
app.post('/api/guest-care', async (req, res) => {
  try {
    const { weddingId, data } = req.body;
    if (!weddingId) return res.status(400).json({ error: 'Missing weddingId' });
    const { data: saved, error } = await supabaseAdmin
      .from('wedding_guest_care')
      .upsert(
        { wedding_id: weddingId, data, updated_at: new Date().toISOString() },
        { onConflict: 'wedding_id' }
      )
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data: saved.data });
  } catch (error) {
    console.error('Save guest care error:', error);
    res.status(500).json({ error: 'Failed to save guest care notes' });
  }
});

// ============ INTERNAL NOTES API ============

// Get internal notes for a wedding (admin only)
app.get('/api/internal-notes/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('wedding_internal_notes')
      .select('*')
      .eq('wedding_id', req.params.weddingId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ notes: data || [] });
  } catch (error) {
    console.error('Get internal notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Add an internal note
app.post('/api/internal-notes', async (req, res) => {
  try {
    const { weddingId, content } = req.body;
    if (!weddingId || !content?.trim()) {
      return res.status(400).json({ error: 'Missing weddingId or content' });
    }
    const { data, error } = await supabaseAdmin
      .from('wedding_internal_notes')
      .insert({ wedding_id: weddingId, content: content.trim() })
      .select()
      .single();
    if (error) throw error;
    res.json({ note: data });
  } catch (error) {
    console.error('Add internal note error:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Delete an internal note
app.delete('/api/internal-notes/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('wedding_internal_notes')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Delete internal note error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// ============ NOTIFICATIONS API ============

// Get admin notifications
app.get('/api/notifications/admin', async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('recipient_type', 'admin')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    if (error) throw error;
    const unreadCount = data?.filter(n => !n.is_read).length || 0;
    res.json({ notifications: data || [], unreadCount });
  } catch (error) {
    console.error('Get admin notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get client notifications for a wedding
app.get('/api/notifications/client/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;
    const { limit = 20 } = req.query;
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('wedding_id', weddingId)
      .eq('recipient_type', 'client')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    if (error) throw error;
    const unreadCount = data?.filter(n => !n.is_read).length || 0;
    res.json({ notifications: data || [], unreadCount });
  } catch (error) {
    console.error('Get client notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification(s) as read
app.put('/api/notifications/read', async (req, res) => {
  try {
    const { notificationId, recipientType, weddingId } = req.body;
    let query = supabaseAdmin.from('notifications').update({ is_read: true });
    if (notificationId) {
      query = query.eq('id', notificationId);
    } else if (recipientType === 'admin') {
      query = query.eq('recipient_type', 'admin');
    } else if (recipientType === 'client' && weddingId) {
      query = query.eq('wedding_id', weddingId).eq('recipient_type', 'client');
    } else {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const { error } = await query.eq('is_read', false);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// ─── STOREFRONT / RIXEY PICKS ─────────────────────────────────────────────

// GET /api/storefront — all active items (public)
app.get('/api/storefront', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('storefront_items')
      .select('*')
      .eq('is_active', true)
      .order('product_type')
      .order('sort_order')
      .order('pick_name');
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Storefront error:', error);
    res.status(500).json({ error: 'Failed to fetch storefront items' });
  }
});

// GET /api/storefront/all — all items including inactive (admin)
app.get('/api/storefront/all', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('storefront_items')
      .select('*')
      .order('category')
      .order('product_type')
      .order('pick_name');
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Storefront all error:', error);
    res.status(500).json({ error: 'Failed to fetch storefront items' });
  }
});

// POST /api/storefront — add item
app.post('/api/storefront', async (req, res) => {
  try {
    const { product_type, category, pick_name, pick_type, description, affiliate_link, image_url, color_options, is_active, sort_order } = req.body;
    const { data, error } = await supabaseAdmin
      .from('storefront_items')
      .insert({ product_type, category, pick_name, pick_type, description, affiliate_link, image_url, color_options, is_active: is_active !== false, sort_order: sort_order || 0 })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, item: data });
  } catch (error) {
    console.error('Storefront add error:', error);
    res.status(500).json({ error: 'Failed to add storefront item' });
  }
});

// PUT /api/storefront/:id — update item
app.put('/api/storefront/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { product_type, category, pick_name, pick_type, description, affiliate_link, image_url, color_options, is_active, sort_order } = req.body;
    const { data, error } = await supabaseAdmin
      .from('storefront_items')
      .update({ product_type, category, pick_name, pick_type, description, affiliate_link, image_url, color_options, is_active, sort_order })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, item: data });
  } catch (error) {
    console.error('Storefront update error:', error);
    res.status(500).json({ error: 'Failed to update storefront item' });
  }
});

// DELETE /api/storefront/:id — delete item
app.delete('/api/storefront/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('storefront_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Storefront delete error:', error);
    res.status(500).json({ error: 'Failed to delete storefront item' });
  }
});

// ============ WEDDING PLANNING FORMS ============

// --- Wedding Details (upsert) ---
app.get('/api/wedding-details/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('wedding_details').select('*').eq('wedding_id', req.params.weddingId).maybeSingle();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/wedding-details', async (req, res) => {
  try {
    const { weddingId, ...fields } = req.body;
    const { data, error } = await supabaseAdmin.from('wedding_details')
      .upsert({ wedding_id: weddingId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'wedding_id' })
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Allergy Registry ---
app.get('/api/allergies/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('allergy_registry').select('*').eq('wedding_id', req.params.weddingId).order('sort_order');
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/allergies', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('allergy_registry').insert(req.body).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/allergies/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('allergy_registry').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/allergies/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('allergy_registry').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Bedroom Assignments ---
const RIXEY_ROOMS = [
  { room_name: 'Newlywed Suite', room_description: 'King bed · bathtub & shared shower · makeup salon', sort_order: 0 },
  { room_name: 'Maple Bedroom', room_description: 'King bed · bathtub · most open floor space', sort_order: 1 },
  { room_name: 'Mountain Room', room_description: 'Queen bed · bathtub · quietest room', sort_order: 2 },
  { room_name: 'Garden Room', room_description: 'Queen bed · shared shower · back staircase to kitchen', sort_order: 3 },
  { room_name: 'Cottage — Queen Room', room_description: '1 queen + 2 twin beds · bathtub', sort_order: 4 },
  { room_name: 'Cottage — Twin Room', room_description: '2 twin beds', sort_order: 5 },
  { room_name: 'Cottage — Pullout', room_description: 'Pullout sofa (Cottage living room)', sort_order: 6 },
];
app.get('/api/bedrooms/:weddingId', async (req, res) => {
  try {
    let { data, error } = await supabaseAdmin.from('bedroom_assignments').select('*').eq('wedding_id', req.params.weddingId).order('sort_order');
    if (error) throw error;
    if (!data || data.length === 0) {
      const { data: inserted, error: ie } = await supabaseAdmin.from('bedroom_assignments')
        .insert(RIXEY_ROOMS.map(r => ({ ...r, wedding_id: req.params.weddingId }))).select();
      if (ie) throw ie;
      data = inserted;
    }
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/bedrooms/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('bedroom_assignments').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Ceremony Order ---
app.get('/api/ceremony-order/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('ceremony_order').select('*').eq('wedding_id', req.params.weddingId).order('sort_order');
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/ceremony-order', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('ceremony_order').insert(req.body).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/ceremony-order/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('ceremony_order').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/ceremony-order/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('ceremony_order').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Decor Inventory ---
app.get('/api/decor/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('decor_inventory').select('*').eq('wedding_id', req.params.weddingId).order('space_name').order('sort_order');
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/decor', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('decor_inventory').insert(req.body).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/decor/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('decor_inventory').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/decor/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('decor_inventory').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Makeup Schedule ---
app.get('/api/makeup/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('makeup_schedule').select('*').eq('wedding_id', req.params.weddingId).order('sort_order');
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/makeup', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('makeup_schedule').insert(req.body).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/makeup/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('makeup_schedule').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/makeup/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('makeup_schedule').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Shuttle Schedule ---
app.get('/api/shuttle/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('shuttle_schedule').select('*').eq('wedding_id', req.params.weddingId).order('sort_order');
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/shuttle', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('shuttle_schedule').insert(req.body).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/shuttle/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('shuttle_schedule').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/shuttle/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('shuttle_schedule').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Rehearsal Dinner (upsert) ---
app.get('/api/rehearsal-dinner/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('rehearsal_dinner').select('*').eq('wedding_id', req.params.weddingId).maybeSingle();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/rehearsal-dinner', async (req, res) => {
  try {
    const { weddingId, ...fields } = req.body;
    const { data, error } = await supabaseAdmin.from('rehearsal_dinner')
      .upsert({ wedding_id: weddingId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'wedding_id' })
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Table Layout Canvas ───────────────────────────────────────────────────────

app.get('/api/table-layout/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('table_layouts')
      .select('*')
      .eq('wedding_id', req.params.weddingId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ layout: data || null });
  } catch (err) {
    console.error('Get table layout error:', err);
    res.status(500).json({ error: 'Failed to get layout' });
  }
});

app.post('/api/table-layout', async (req, res) => {
  try {
    const { weddingId, elements, name } = req.body;
    if (!weddingId) return res.status(400).json({ error: 'weddingId required' });
    const { data, error } = await supabaseAdmin
      .from('table_layouts')
      .upsert({
        wedding_id: weddingId,
        name: name || 'Reception Layout',
        elements: elements || [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'wedding_id' })
      .select().single();
    if (error) throw error;
    res.json({ layout: data });
  } catch (err) {
    console.error('Save table layout error:', err);
    res.status(500).json({ error: 'Failed to save layout' });
  }
});

// ─── Guest Management ──────────────────────────────────────────────────────────

// GET all guests for a wedding
app.get('/api/guests/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('wedding_guests')
      .select('*')
      .eq('wedding_id', req.params.weddingId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ guests: data || [] });
  } catch (err) {
    console.error('Get guests error:', err);
    res.status(500).json({ error: 'Failed to get guests' });
  }
});

// GET guest settings (tags, meal options, plated flag)
app.get('/api/guest-settings/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;
    const [tagsRes, mealsRes, weddingRes] = await Promise.all([
      supabaseAdmin.from('guest_tag_options').select('*').eq('wedding_id', weddingId).order('display_order'),
      supabaseAdmin.from('guest_meal_options').select('*').eq('wedding_id', weddingId).order('display_order'),
      supabaseAdmin.from('weddings').select('plated_meal').eq('id', weddingId).single(),
    ]);
    res.json({
      tagOptions: tagsRes.data || [],
      mealOptions: mealsRes.data || [],
      platedMeal: weddingRes.data?.plated_meal || false,
    });
  } catch (err) {
    console.error('Get guest settings error:', err);
    res.status(500).json({ error: 'Failed to get guest settings' });
  }
});

// PUT update plated_meal setting
app.put('/api/guest-settings/:weddingId', async (req, res) => {
  try {
    const { platedMeal } = req.body;
    const { error } = await supabaseAdmin
      .from('weddings')
      .update({ plated_meal: platedMeal })
      .eq('id', req.params.weddingId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('Update guest settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST create guest
app.post('/api/guests', async (req, res) => {
  try {
    const {
      weddingId, first_name, last_name, rsvp, dietary_restrictions,
      meal_choice, tags, notes, email, phone, address,
      plus_one_name, plus_one_rsvp, plus_one_meal_choice, plus_one_dietary,
      table_assignment,
    } = req.body;
    if (!weddingId || !first_name) return res.status(400).json({ error: 'weddingId and first_name required' });
    const { data, error } = await supabaseAdmin
      .from('wedding_guests')
      .insert({
        wedding_id: weddingId, first_name, last_name, rsvp: rsvp || 'pending',
        dietary_restrictions, meal_choice, tags: tags || [],
        notes, email, phone, address,
        plus_one_name, plus_one_rsvp: plus_one_rsvp || 'pending',
        plus_one_meal_choice, plus_one_dietary,
        table_assignment: table_assignment || null,
        updated_at: new Date().toISOString(),
      })
      .select().single();
    if (error) throw error;
    res.json({ guest: data });
  } catch (err) {
    console.error('Create guest error:', err);
    res.status(500).json({ error: 'Failed to create guest' });
  }
});

// PUT update guest
app.put('/api/guests/:id', async (req, res) => {
  try {
    const {
      first_name, last_name, rsvp, dietary_restrictions,
      meal_choice, tags, notes, email, phone, address,
      plus_one_name, plus_one_rsvp, plus_one_meal_choice, plus_one_dietary,
      table_assignment,
    } = req.body;
    const { data, error } = await supabaseAdmin
      .from('wedding_guests')
      .update({
        first_name, last_name, rsvp, dietary_restrictions,
        meal_choice, tags: tags || [], notes, email, phone, address,
        plus_one_name, plus_one_rsvp, plus_one_meal_choice, plus_one_dietary,
        table_assignment: table_assignment || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ guest: data });
  } catch (err) {
    console.error('Update guest error:', err);
    res.status(500).json({ error: 'Failed to update guest' });
  }
});

// POST bulk import guests from CSV
app.post('/api/guests/bulk', async (req, res) => {
  try {
    const { weddingId, guests } = req.body;
    if (!weddingId || !Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ error: 'weddingId and guests array required' });
    }
    const rows = guests.map(g => ({
      wedding_id: weddingId,
      first_name: g.first_name || g.firstName || '',
      last_name: g.last_name || g.lastName || null,
      email: g.email || null,
      phone: g.phone || null,
      address: g.address || null,
      rsvp: g.rsvp || 'pending',
      dietary_restrictions: g.dietary_restrictions || g.dietary || null,
      tags: [],
      updated_at: new Date().toISOString(),
    })).filter(g => g.first_name.trim());
    const { data, error } = await supabaseAdmin
      .from('wedding_guests')
      .insert(rows)
      .select();
    if (error) throw error;
    res.json({ guests: data, imported: data.length });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Failed to import guests' });
  }
});

// DELETE guest
app.delete('/api/guests/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('wedding_guests').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete guest error:', err);
    res.status(500).json({ error: 'Failed to delete guest' });
  }
});

// POST create tag option
app.post('/api/guest-tags', async (req, res) => {
  try {
    const { weddingId, label, color } = req.body;
    if (!weddingId || !label) return res.status(400).json({ error: 'weddingId and label required' });
    const { data, error } = await supabaseAdmin
      .from('guest_tag_options')
      .insert({ wedding_id: weddingId, label, color: color || '#9CA3AF' })
      .select().single();
    if (error) throw error;
    res.json({ tag: data });
  } catch (err) {
    console.error('Create tag error:', err);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// DELETE tag option
app.delete('/api/guest-tags/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('guest_tag_options').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete tag error:', err);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// POST create meal option
app.post('/api/meal-options', async (req, res) => {
  try {
    const { weddingId, label } = req.body;
    if (!weddingId || !label) return res.status(400).json({ error: 'weddingId and label required' });
    const { data, error } = await supabaseAdmin
      .from('guest_meal_options')
      .insert({ wedding_id: weddingId, label })
      .select().single();
    if (error) throw error;
    res.json({ option: data });
  } catch (err) {
    console.error('Create meal option error:', err);
    res.status(500).json({ error: 'Failed to create meal option' });
  }
});

// DELETE meal option
app.delete('/api/meal-options/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('guest_meal_options').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete meal option error:', err);
    res.status(500).json({ error: 'Failed to delete meal option' });
  }
});

// ============ WORKSHEETS ============

app.get('/api/worksheets/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('weddings')
      .select('worksheet_priorities, worksheet_guest_rules, worksheet_budget_alignment')
      .eq('id', weddingId)
      .single();
    if (error) throw error;
    res.json({ worksheets: data || {} });
  } catch (err) {
    console.error('Get worksheets error:', err);
    res.status(500).json({ error: 'Failed to get worksheets' });
  }
});

app.put('/api/worksheets/:weddingId', async (req, res) => {
  try {
    const { weddingId } = req.params;
    const { section, data: sectionData, notify } = req.body;

    const allowed = ['worksheet_priorities', 'worksheet_guest_rules', 'worksheet_budget_alignment'];
    if (!allowed.includes(section)) return res.status(400).json({ error: 'Invalid section' });

    const { data, error } = await supabaseAdmin
      .from('weddings')
      .update({ [section]: sectionData })
      .eq('id', weddingId)
      .select()
      .single();
    if (error) throw error;

    // If values statement submitted, log activity
    if (notify && sectionData.values_statement_submitted) {
      const statement = sectionData.values?.statement_summary || '';
      await logActivity(weddingId, null, 'values_statement_submitted',
        `Submitted their Wedding Values Statement: "${statement.substring(0, 150)}"`);
    }

    res.json({ success: true, wedding: data });
  } catch (err) {
    console.error('Save worksheet error:', err);
    res.status(500).json({ error: 'Failed to save worksheet' });
  }
});

// ============ BAR PLANNER ============

// Notes
app.get('/api/bar-notes/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('weddings').select('bar_notes').eq('id', req.params.weddingId).single();
    if (error) throw error;
    res.json(data?.bar_notes || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bar-notes/:weddingId', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('weddings').update({ bar_notes: req.body }).eq('id', req.params.weddingId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Shopping list
app.get('/api/bar-shopping/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('bar_shopping_list').select('*').eq('wedding_id', req.params.weddingId).order('category').order('sort_order');
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bar-shopping/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('bar_shopping_list')
      .insert({ ...req.body, wedding_id: req.params.weddingId })
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bar-shopping/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('bar_shopping_list').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bar-shopping/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('bar_shopping_list').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Recipes
// Extract ingredients from a URL using Claude
app.post('/api/bar-recipes/extract-url', async (req, res) => {
  try {
    const { url, name } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    // Fetch the page content
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    const html = await pageRes.text();
    // Strip script/style blocks first (their text content is noise), then tags
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 20000); // take much more — recipe content is rarely at the very start

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Extract the ingredients from this cocktail recipe for "${name}". Return ONLY a JSON array — no other text. Each element: { "name": string, "quantity": number, "unit": string, "per_serving": true, "category": "spirits"|"mixers"|"garnish"|"other" }. If a quantity is ambiguous use a reasonable default for 1 serving.\n\nPage content:\n${text}`,
      }],
    });

    const raw = message.content[0].text.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return res.status(422).json({ error: 'Could not parse ingredients from that page.' });
    res.json({ ingredients: JSON.parse(match[0]) });
  } catch (err) {
    console.error('Recipe URL extract error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Extract ingredients from an uploaded image/PDF using Claude Vision
app.post('/api/bar-recipes/extract-upload', upload.single('file'), async (req, res) => {
  try {
    const { name } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const base64   = file.buffer.toString('base64');
    const isPdf    = file.mimetype === 'application/pdf';
    const mediaType = isPdf ? 'application/pdf' : file.mimetype;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          {
            type: isPdf ? 'document' : 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Extract the ingredients from this cocktail recipe for "${name}". Return ONLY a JSON array — no other text. Each element: { "name": string, "quantity": number, "unit": string, "per_serving": true, "category": "spirits"|"mixers"|"garnish"|"other" }. If a quantity is ambiguous use a reasonable default for 1 serving.`,
          },
        ],
      }],
    });

    const raw = message.content[0].text.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return res.status(422).json({ error: 'Could not parse ingredients from that image.' });
    res.json({ ingredients: JSON.parse(match[0]) });
  } catch (err) {
    console.error('Recipe upload extract error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bar-recipes/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('bar_recipes').select('*').eq('wedding_id', req.params.weddingId).order('created_at');
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bar-recipes/:weddingId', async (req, res) => {
  try {
    const { name, source_type, source_url, ingredients, servings_basis, notes } = req.body;
    const { data, error } = await supabaseAdmin.from('bar_recipes')
      .insert({ wedding_id: req.params.weddingId, name, source_type, source_url, ingredients, servings_basis, notes })
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bar-recipes/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('bar_recipes').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ WEDDING WEBSITE FEATURE ============

// --- Partner names ---
app.put('/api/weddings/:id/partners', async (req, res) => {
  try {
    const { partner1_name, partner2_name } = req.body;
    const { data, error } = await supabaseAdmin
      .from('weddings')
      .update({ partner1_name, partner2_name })
      .eq('id', req.params.id)
      .select('id, partner1_name, partner2_name')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Photo library ---
app.get('/api/wedding-photos/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('wedding_photos')
      .select('*')
      .eq('wedding_id', req.params.weddingId)
      .order('sort_order')
      .order('created_at');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/wedding-photos/:weddingId/upload', upload.single('photo'), async (req, res) => {
  try {
    const { weddingId } = req.params;
    const { tags, caption } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const ext = file.mimetype === 'image/webp' ? 'webp' : file.mimetype === 'image/png' ? 'png' : 'jpg';
    const path = `${weddingId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('wedding-photos')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('wedding-photos')
      .getPublicUrl(path);

    const parsedTags = tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [];

    const { data, error } = await supabaseAdmin
      .from('wedding_photos')
      .insert({ wedding_id: weddingId, url: publicUrl, storage_path: path, tags: parsedTags, caption: caption || null })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/wedding-photos/:photoId', async (req, res) => {
  try {
    const { tags, caption, sort_order } = req.body;
    const updates = {};
    if (tags !== undefined) updates.tags = tags;
    if (caption !== undefined) updates.caption = caption;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    const { data, error } = await supabaseAdmin
      .from('wedding_photos')
      .update(updates)
      .eq('id', req.params.photoId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/wedding-photos/:photoId', async (req, res) => {
  try {
    const { data: photo } = await supabaseAdmin
      .from('wedding_photos')
      .select('storage_path')
      .eq('id', req.params.photoId)
      .single();

    if (photo?.storage_path) {
      await supabaseAdmin.storage.from('wedding-photos').remove([photo.storage_path]);
    }

    const { error } = await supabaseAdmin
      .from('wedding_photos')
      .delete()
      .eq('id', req.params.photoId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Wedding party ---
app.get('/api/wedding-party/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('wedding_party')
      .select('*')
      .eq('wedding_id', req.params.weddingId)
      .order('sort_order')
      .order('created_at');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/wedding-party/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('wedding_party')
      .insert({ ...req.body, wedding_id: req.params.weddingId })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/wedding-party/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('wedding_party')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/wedding-party/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('wedding_party').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Website settings ---
app.get('/api/wedding-website/:weddingId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('wedding_website_settings')
      .select('*')
      .eq('wedding_id', req.params.weddingId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/wedding-website/:weddingId', async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin
      .from('wedding_website_settings')
      .select('id')
      .eq('wedding_id', req.params.weddingId)
      .single();

    const payload = { ...req.body, wedding_id: req.params.weddingId, updated_at: new Date().toISOString() };

    const { data, error } = existing
      ? await supabaseAdmin.from('wedding_website_settings').update(payload).eq('wedding_id', req.params.weddingId).select().single()
      : await supabaseAdmin.from('wedding_website_settings').insert(payload).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Venue settings ────────────────────────────────────────────────────────────
app.get('/api/venue-settings', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('venue_settings')
      .select('*')
      .order('created_at')
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/venue-settings', async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin
      .from('venue_settings')
      .select('id')
      .order('created_at')
      .limit(1)
      .single();

    const payload = { ...req.body, updated_at: new Date().toISOString() };
    delete payload.id;
    delete payload.created_at;

    const { data, error } = existing
      ? await supabaseAdmin.from('venue_settings').update(payload).eq('id', existing.id).select().single()
      : await supabaseAdmin.from('venue_settings').insert(payload).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Public wedding website endpoint ──────────────────────────────────────────
app.get('/api/w/:slug', async (req, res) => {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('wedding_website_settings')
      .select('*')
      .eq('slug', req.params.slug)
      .eq('published', true)
      .single();

    if (error || !settings) return res.status(404).json({ error: 'Wedding website not found' });

    const weddingId = settings.wedding_id;

    const [weddingRes, photosRes, partyRes, shuttleRes, accomRes, detailsRes, venueRes, mealOptionsRes] = await Promise.all([
      supabaseAdmin.from('weddings').select('couple_names,wedding_date,partner1_name,partner2_name,plated_meal').eq('id', weddingId).single(),
      supabaseAdmin.from('wedding_photos').select('*').eq('wedding_id', weddingId).contains('tags', ['website']).order('sort_order'),
      supabaseAdmin.from('wedding_party').select('*').eq('wedding_id', weddingId).eq('include_on_website', true).order('sort_order'),
      supabaseAdmin.from('shuttle_schedule').select('*').eq('wedding_id', weddingId).order('sort_order'),
      supabaseAdmin.from('accommodations').select('*').order('distance'),
      supabaseAdmin.from('wedding_details').select('ceremony_location,send_off_type,wedding_colors').eq('wedding_id', weddingId).single(),
      supabaseAdmin.from('venue_settings').select('*').order('created_at').limit(1).single(),
      supabaseAdmin.from('guest_meal_options').select('id, label').eq('wedding_id', weddingId).order('created_at'),
    ]);

    res.json({
      settings,
      wedding: weddingRes.data || {},
      photos: photosRes.data || [],
      party: partyRes.data || [],
      shuttle: shuttleRes.data || [],
      accommodations: accomRes.data || [],
      wedding_details: detailsRes.data || {},
      venue: venueRes.data || {},
      meal_options: mealOptionsRes.data || [],
    });
  } catch (err) {
    console.error('Public website error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Public RSVP endpoints ─────────────────────────────────────────────────────

// Search guests by name (for the RSVP form on the public website)
app.get('/api/rsvp/:slug/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json([]);

    const { data: settings, error: se } = await supabaseAdmin
      .from('wedding_website_settings')
      .select('wedding_id')
      .eq('slug', req.params.slug)
      .eq('published', true)
      .single();
    if (se || !settings) return res.status(404).json({ error: 'Not found' });

    const { data: guests, error: ge } = await supabaseAdmin
      .from('wedding_guests')
      .select('id, first_name, last_name, rsvp, plus_one_name, plus_one_rsvp')
      .eq('wedding_id', settings.wedding_id)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    if (ge) throw ge;

    const results = (guests || [])
      .filter(g => `${g.first_name} ${g.last_name || ''}`.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8)
      .map(g => ({
        id: g.id,
        name: [g.first_name, g.last_name].filter(Boolean).join(' '),
        rsvp: g.rsvp,
        plus_one_name: g.plus_one_name,
        plus_one_rsvp: g.plus_one_rsvp,
      }));
    res.json(results);
  } catch (err) {
    console.error('RSVP search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Submit RSVP — writes back to wedding_guests
app.post('/api/rsvp/:slug', async (req, res) => {
  try {
    const { guest_id, rsvp, meal_choice, dietary_restrictions, plus_one_rsvp, plus_one_meal_choice, plus_one_dietary } = req.body;
    if (!guest_id || !rsvp) return res.status(400).json({ error: 'guest_id and rsvp required' });

    // Verify guest belongs to this wedding via slug
    const { data: settings, error: se } = await supabaseAdmin
      .from('wedding_website_settings')
      .select('wedding_id')
      .eq('slug', req.params.slug)
      .eq('published', true)
      .single();
    if (se || !settings) return res.status(404).json({ error: 'Not found' });

    const { data: guest, error: ge } = await supabaseAdmin
      .from('wedding_guests')
      .select('id, wedding_id')
      .eq('id', guest_id)
      .eq('wedding_id', settings.wedding_id)
      .single();
    if (ge || !guest) return res.status(404).json({ error: 'Guest not found' });

    const update = {
      rsvp,
      dietary_restrictions: dietary_restrictions || null,
      updated_at: new Date().toISOString(),
    };
    if (meal_choice !== undefined) update.meal_choice = meal_choice;
    if (plus_one_rsvp !== undefined) update.plus_one_rsvp = plus_one_rsvp;
    if (plus_one_meal_choice !== undefined) update.plus_one_meal_choice = plus_one_meal_choice;
    if (plus_one_dietary !== undefined) update.plus_one_dietary = plus_one_dietary;

    const { error: ue } = await supabaseAdmin
      .from('wedding_guests')
      .update(update)
      .eq('id', guest_id);
    if (ue) throw ue;

    res.json({ ok: true });
  } catch (err) {
    console.error('RSVP submit error:', err);
    res.status(500).json({ error: err.message });
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
