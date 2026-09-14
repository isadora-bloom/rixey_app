/**
 * The icon for a section, the same one on both sides of the portal.
 *
 * The menus used to point at /icons/*.svg, and there were about a dozen files
 * for forty sections, so Bar Planner and Staffing Guide shared a picture, as
 * did Bedroom Assignments and Direct Messages. Anyone scanning the sidebar for
 * a shape rather than reading every label was being told the wrong thing.
 *
 * The registry names a lucide icon per section. This maps the name to the
 * component. The map is written out rather than looked up dynamically so the
 * bundler only ships the icons actually used.
 */
import {
  Activity,
  Armchair,
  BarChart3,
  Bed,
  BookUser,
  Briefcase,
  Bus,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Camera,
  CircleHelp,
  ClipboardList,
  Contact,
  Download,
  FileText,
  FileUp,
  Flower2,
  Footprints,
  Gauge,
  Globe,
  HandHeart,
  Heart,
  HeartPulse,
  Images,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  Link,
  ListChecks,
  MailCheck,
  Map,
  MessageCircle,
  MessagesSquare,
  NotebookPen,
  Package,
  PartyPopper,
  RefreshCw,
  Scissors,
  ScrollText,
  ShoppingBag,
  Sparkles,
  StickyNote,
  Users,
  UserCog,
  Utensils,
  Wallet,
  Wine,
} from 'lucide-react'
import { sectionByKey } from '../../../shared/sections.js'

const ICONS = {
  Activity,
  Armchair,
  BarChart3,
  Bed,
  BookUser,
  Briefcase,
  Bus,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Camera,
  CircleHelp,
  ClipboardList,
  Contact,
  Download,
  FileText,
  FileUp,
  Flower2,
  Footprints,
  Gauge,
  Globe,
  HandHeart,
  Heart,
  HeartPulse,
  Images,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  Link,
  ListChecks,
  MailCheck,
  Map,
  MessageCircle,
  MessagesSquare,
  NotebookPen,
  Package,
  PartyPopper,
  RefreshCw,
  Scissors,
  ScrollText,
  ShoppingBag,
  Sparkles,
  StickyNote,
  Users,
  UserCog,
  Utensils,
  Wallet,
  Wine,
}

/**
 * Give it either a section key or an icon name. An unknown one draws nothing
 * rather than a broken image, which is what the old <img src> did when a file
 * had been renamed.
 */
export default function SectionIcon({ sectionKey, name, className = 'w-5 h-5 flex-shrink-0' }) {
  const iconName = name || sectionByKey(sectionKey)?.icon
  const Icon = iconName ? ICONS[iconName] : null
  if (!Icon) return null
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />
}

export { ICONS }
