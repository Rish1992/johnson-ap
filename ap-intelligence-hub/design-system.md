# Design System — B2B Platform Framework

**Version:** 1.0  
**Purpose:** A complete, opinionated design framework for redesigning a modern B2B SaaS application. Derived from analysis of four reference interfaces spanning order management, asset tracking, POS dashboards, and CRM activity feeds.

---

## 1. Design Philosophy

This system follows three core principles:

**Functional Clarity** — Every visual element earns its place. No decorative chrome. White space is a structural tool, not empty space. The interface should feel like a well-organized workspace: calm, efficient, and instantly scannable.

**Warm Professionalism** — Avoid cold, sterile enterprise aesthetics. Use subtle warmth through rounded corners, gentle shadows, and a color palette that balances authority with approachability. The tone is "trusted colleague," not "corporate machine."

**Progressive Density** — Show summary-level information by default. Let users drill into detail on demand. Top-level views are spacious; detail views are information-dense but still organized.

---

## 2. Layout Architecture

### 2.1 Shell Structure

The application uses a three-zone layout:

```
┌──────────┬─────────────────────────────────┬──────────────┐
│          │                                 │              │
│  Sidebar │        Main Content             │   Context    │
│  (240px) │        (fluid)                  │   Panel      │
│          │                                 │  (320px,     │
│  Fixed   │  Scrollable                     │  optional)   │
│  Left    │  Center                         │  Right       │
│          │                                 │              │
└──────────┴─────────────────────────────────┴──────────────┘
```

- **Sidebar:** Fixed left, 240px wide. Contains logo, navigation, settings. Collapses to 64px icon-only mode on smaller screens.
- **Main Content:** Fluid center column. Minimum 720px. Contains page header, stat cards, filters, and primary data (tables, lists, charts).
- **Context Panel:** Optional right panel, 320px. Used for quick actions (e.g., Quick Sale, detail preview, activity feed). Slides in/out. Not present on all views.

### 2.2 Page Anatomy

Every page follows this vertical structure:

```
┌─────────────────────────────────────────────┐
│  Page Header (title + primary actions)       │  64px
├─────────────────────────────────────────────┤
│  Stat Cards Row (optional)                   │  96px
├─────────────────────────────────────────────┤
│  Filter Bar / Tabs                           │  48px
├─────────────────────────────────────────────┤
│  Primary Content (table / cards / feed)      │  fluid
├─────────────────────────────────────────────┤
│  Pagination / Load More                      │  48px
└─────────────────────────────────────────────┘
```

### 2.3 Spacing Scale

Use an 4px base unit. All spacing is a multiple of 4.

| Token         | Value | Usage                                    |
|---------------|-------|------------------------------------------|
| `space-1`     | 4px   | Tight inline gaps, icon-to-label         |
| `space-2`     | 8px   | Inside compact components (badges, chips)|
| `space-3`     | 12px  | Input padding, cell padding              |
| `space-4`     | 16px  | Card padding, between form fields        |
| `space-5`     | 20px  | Between related sections                 |
| `space-6`     | 24px  | Between card groups, section gaps         |
| `space-8`     | 32px  | Page section gaps                        |
| `space-10`    | 40px  | Major section dividers                   |
| `space-12`    | 48px  | Page-level vertical rhythm               |

### 2.4 Grid System

- 12-column grid within main content area
- Column gap: 24px
- Row gap: 24px
- Stat cards: Equal-width columns (typically 4 across)
- Dashboard widgets: Mix of 6-col and 4-col spans
- Tables: Full-width (12 columns)

---

## 3. Color System

*Extracted from Johnson Health Tech brand identity — bold red primary, high-contrast charcoal/black anchoring, clean white surfaces.*

### 3.1 Core Palette

```css
:root {
  /* ── Neutrals (cool-tinted grays for a clean, professional feel) ── */
  --neutral-0:    #FFFFFF;       /* Page background, card surfaces */
  --neutral-25:   #FAFAFA;       /* Card background alt, sidebar hover */
  --neutral-50:   #F5F5F5;       /* Table header bg, input bg, stripe rows */
  --neutral-100:  #E5E5E5;       /* Borders, dividers */
  --neutral-200:  #D4D4D4;       /* Disabled borders */
  --neutral-300:  #A3A3A3;       /* Placeholder text */
  --neutral-400:  #737373;       /* Secondary text, captions */
  --neutral-500:  #525252;       /* Tertiary text */
  --neutral-700:  #404040;       /* Primary body text */
  --neutral-800:  #262626;       /* Nav text, strong labels */
  --neutral-900:  #171717;       /* Headings, high-emphasis text */

  /* ── Primary (Johnson Red — bold, energetic, authoritative) ── */
  --primary-50:   #FEF2F2;       /* Lightest tint — selected row bg, hover states */
  --primary-100:  #FEE2E2;       /* Light tint — badge backgrounds, highlights */
  --primary-200:  #FECACA;       /* Soft accent — progress bars, focus rings */
  --primary-300:  #F87171;       /* Medium — chart secondary, illustrations */
  --primary-500:  #DC2626;       /* Core brand red — CTAs, active nav, links */
  --primary-600:  #C41E1E;       /* Hover state — button hover, link hover */
  --primary-700:  #B91C1C;       /* Pressed state — button active */
  --primary-800:  #991B1B;       /* Deep red — sidebar accent, emphasis zones */
  --primary-900:  #7F1D1D;       /* Darkest red — sidebar gradient bottom */

  /* ── Sidebar Dark (Charcoal/Black — extracted from Johnson nav bar) ── */
  --sidebar-900:  #1A1A1A;       /* Sidebar primary background */
  --sidebar-800:  #242424;       /* Sidebar card/section bg */
  --sidebar-700:  #2E2E2E;       /* Sidebar hover state */

  /* ── Status Colors ── */
  --status-success:    #22C55E;  /* Completed, paid, active */
  --status-success-bg: #F0FDF4;
  --status-warning:    #F59E0B;  /* Pending, in-progress */
  --status-warning-bg: #FFFBEB;
  --status-error:      #DC2626;  /* Failed, overdue, critical (matches primary for brand cohesion) */
  --status-error-bg:   #FEF2F2;
  --status-info:       #3B82F6;  /* Informational, new */
  --status-info-bg:    #EFF6FF;
  --status-neutral:    #737373;  /* Inactive, archived */
  --status-neutral-bg: #F5F5F5;

  /* ── Accent (for charts, tags, categories) ── */
  --accent-red:     #DC2626;     /* Primary series (brand-aligned) */
  --accent-blue:    #3B82F6;     /* Secondary series */
  --accent-amber:   #F59E0B;     /* Tertiary series */
  --accent-teal:    #14B8A6;     /* Quaternary series */
  --accent-purple:  #8B5CF6;     /* Fifth series */
  --accent-slate:   #64748B;     /* Sixth series */
}
```

### 3.2 Dark Sidebar Theme

The sidebar uses a charcoal/black theme (extracted from the Johnson top navigation bar), creating a strong anchor point and high contrast against the white content area:

```css
.sidebar {
  background: linear-gradient(180deg, var(--sidebar-800) 0%, var(--sidebar-900) 100%);
  color: rgba(255, 255, 255, 0.65);    /* Default nav text */
}
.sidebar .nav-active {
  background: var(--primary-500);       /* Red highlight for active state */
  color: #FFFFFF;
  border-radius: 8px;
}
.sidebar .nav-hover {
  background: var(--sidebar-700);
}
.sidebar .top-bar {
  background: var(--primary-500);       /* Red accent strip at top, mirroring Johnson header */
  height: 4px;
}
```

### 3.3 Color Usage Rules

1. **Never use color alone to convey meaning.** Always pair with an icon or text label.
2. **The primary red is reserved for high-impact elements only:** main CTAs, active navigation, the top accent bar, and critical alerts. Overusing red dilutes its power — most UI chrome should be neutral.
3. **Status badges use the light-background variant** (e.g., green text on green-50 bg), never solid fills. Exception: error/critical badges share the primary red to reinforce brand cohesion.
4. **Charts use the accent palette** in this order: accent-red, accent-blue, accent-amber, accent-teal, accent-purple, accent-slate.
5. **Links and interactive text** use primary-500 (red). Underline only on hover.
6. **Destructive actions** use primary-500 as text or outline on white, since the brand red naturally communicates urgency. In confirmation dialogs, use filled primary-500.
7. **The sidebar is charcoal, not red.** This prevents the interface from feeling overwhelming. Red appears only as the active nav highlight and optional 4px top accent strip.

---

## 4. Typography

### 4.1 Font Stack

```css
:root {
  --font-display: 'DM Sans', sans-serif;       /* Headings, stat numbers, nav */
  --font-body:    'DM Sans', sans-serif;        /* Body text, table content */
  --font-mono:    'JetBrains Mono', monospace;  /* Code, IDs, order numbers */
}
```

**Why DM Sans:** Geometric but warm. Has the professionalism of Inter without the ubiquity. Great at both large display sizes and small table text. Open-source and well-supported.

**Alternative stack:** If targeting a more premium feel, substitute `'Satoshi'` for display and `'General Sans'` for body.

### 4.2 Type Scale

| Token          | Size   | Weight | Line Height | Letter Spacing | Usage                               |
|----------------|--------|--------|-------------|----------------|-------------------------------------|
| `display-lg`   | 32px   | 700    | 1.2         | -0.02em        | Page titles (rarely used)           |
| `display-sm`   | 24px   | 700    | 1.3         | -0.01em        | Section headers, stat numbers       |
| `heading-lg`   | 20px   | 600    | 1.4         | -0.01em        | Card titles, modal titles           |
| `heading-sm`   | 16px   | 600    | 1.5         | 0              | Sub-section headers, widget titles  |
| `body-lg`      | 15px   | 400    | 1.6         | 0              | Primary body text, descriptions     |
| `body-md`      | 14px   | 400    | 1.5         | 0              | Table cells, form labels, nav items |
| `body-sm`      | 13px   | 400    | 1.5         | 0.01em         | Secondary info, timestamps          |
| `caption`      | 12px   | 500    | 1.4         | 0.02em         | Badges, status labels, overlines    |
| `overline`     | 11px   | 600    | 1.3         | 0.08em         | Category labels (uppercase)         |

### 4.3 Typography Rules

1. **Page titles:** `display-sm`, weight 700, color neutral-900. Left-aligned. No uppercase.
2. **Stat card numbers:** `display-sm` or `display-lg`, weight 700. The number is the hero — make it the largest element in the card.
3. **Table headers:** `caption` size, weight 600, color neutral-400, uppercase, letter-spacing 0.05em. This creates a clear but recessive header row.
4. **Table body text:** `body-md`, weight 400, color neutral-700.
5. **Order/ID numbers:** Use `font-mono` in `body-sm`, weight 500, color neutral-500. The monospace differentiates system IDs from human text.
6. **Never bold full sentences.** Bold only key terms, names, or values within a sentence.

---

## 5. Component Library

### 5.1 Sidebar Navigation

```
Structure:
├─ Logo + App Name (top, 64px height)
├─ Workspace Selector (dropdown, optional)
├─ ─────────────────── (divider)
├─ Nav Group: MAIN
│   ├─ Dashboard (icon + label)
│   ├─ Orders (icon + label, expandable)
│   │   ├─ All Orders
│   │   ├─ Returns
│   │   └─ Order Tracking
│   ├─ Sales
│   ├─ Customers
│   └─ Reports
├─ Nav Group: SETTINGS
│   ├─ Marketplace Sync
│   ├─ Payment Gateways
│   └─ Settings (expandable)
├─ ─────────────────── (spacer)
├─ Help Center (bottom-pinned)
└─ Dark Mode Toggle (bottom-pinned)
```

**Specs:**
- Nav item height: 40px
- Icon size: 20px
- Icon-to-label gap: 12px
- Group label: overline style, uppercase, color rgba(255,255,255,0.4)
- Active item: white text, white/15% bg, 8px border-radius, left 3px accent bar (primary-500)
- Hover: white/8% bg
- Nested items: indent 32px from parent, no icon
- Notification badge: 8px red dot or number badge on icon

### 5.2 Stat Cards

Four equal-width cards in a row. Each card:

```
┌──────────────────────────────────┐
│  ● Label Text            [icon]  │  ← overline style, neutral-400
│  1,234                           │  ← display-sm, neutral-900, weight 700
│  ↑ 12.5% from yesterday         │  ← caption, green/red for +/-
└──────────────────────────────────┘
```

**Specs:**
- Background: neutral-0 (white)
- Border: 1px solid neutral-100
- Border-radius: 12px
- Padding: 20px
- Shadow: 0 1px 3px rgba(0,0,0,0.04)
- Status dot: 8px circle, color-coded (blue for total, orange for pending, green for shipped, red for refunded)
- Hover: shadow increases to 0 2px 8px rgba(0,0,0,0.08)

### 5.3 Data Tables

The primary workhorse component. Design for scanability over decoration.

**Table Structure:**
```
┌─ Column Management Bar ──────────────────────────────────────┐
│  [Date Range Picker]  [Show N Rows ▼]  [Manage Columns ⊞]  │
│  [Filter ▽]  [⋮ More]                                       │
└──────────────────────────────────────────────────────────────┘

┌─ Tab Bar ────────────────────────────────────────────────────┐
│  All (240) │ Incomplete │ Overdue │ Ongoing │ Finished       │
└──────────────────────────────────────────────────────────────┘

┌─ Table ──────────────────────────────────────────────────────┐
│ ☐  Order #↕    Customer↕    Date↕    Status↕  Amount↕  ⋯   │ ← Header
├──────────────────────────────────────────────────────────────┤
│ ☐  #ORD1008    👤 Esther    17 Dec   🟡Pending  $10.50  ✎🗑 │ ← Row
│ ☐  #ORD1007    👤 Denise    16 Dec   🟡Pending  $100.50 ✎🗑 │
│ ☑  #ORD1006    👤 Clint     16 Dec   🟢Complete $60.56  ✎🗑 │ ← Selected
└──────────────────────────────────────────────────────────────┘

┌─ Bulk Action Bar (appears on selection) ─────────────────────┐
│  2 Selected    [📋 Duplicate]  [🖨 Print]  [🗑 Delete]  [✕] │
└──────────────────────────────────────────────────────────────┘

┌─ Pagination ─────────────────────────────────────────────────┐
│  Showing 1-9 of 240 entries    ‹ Prev  [1] 2  3  … 12  Next ›│
└──────────────────────────────────────────────────────────────┘
```

**Header Row:**
- Background: neutral-50
- Text: caption style, uppercase, neutral-400
- Sort icon: 12px, neutral-300 (inactive), neutral-700 (active)
- Height: 44px
- Padding: 12px 16px
- Bottom border: 1px solid neutral-100

**Body Rows:**
- Height: 56px
- Padding: 12px 16px
- Border-bottom: 1px solid neutral-100
- Hover: background neutral-25
- Selected: background primary-50, left-border 2px primary-500

**Checkbox:**
- 18px square, border-radius 4px
- Unchecked: border neutral-200
- Checked: background primary-500, white checkmark
- Indeterminate (header, partial selection): primary-500 with dash

**Row Actions:**
- Visible on hover only (except on mobile)
- Icon buttons: 32px touch target, 16px icon
- Edit (pencil), Delete (trash), More (three dots)
- Delete icon: neutral-400 default, status-error on hover

### 5.4 Status Badges

Pill-shaped badges with semantic color coding:

| Status     | Text Color         | Background         | Example   |
|------------|--------------------|--------------------|-----------|
| Completed  | --status-success   | --status-success-bg| ✓ Completed |
| Pending    | --status-warning   | --status-warning-bg| ◷ Pending   |
| Refunded   | --status-error     | --status-error-bg  | ↩ Refunded  |
| Paid       | --primary-700      | --primary-50       | $ Paid      |
| Unpaid     | --status-neutral   | --status-neutral-bg| Unpaid      |
| Overdue    | --status-error     | --status-error-bg  | ! Overdue   |

**Specs:**
- Font: caption size (12px), weight 500
- Padding: 4px 10px
- Border-radius: 9999px (full pill)
- No border (the bg tint is enough)
- Optional leading icon: 12px, same color as text

### 5.5 Buttons

**Hierarchy (use in this priority order):**

| Variant     | Usage                          | Style                                                      |
|-------------|--------------------------------|-------------------------------------------------------------|
| Primary     | One per page section max       | bg: primary-500, text: white, shadow-sm                     |
| Secondary   | Supporting actions             | bg: white, border: neutral-200, text: neutral-700           |
| Ghost       | Tertiary, inline, table actions| bg: transparent, text: neutral-500, hover: neutral-50 bg    |
| Danger      | Destructive (in context)       | bg: white, border: status-error, text: status-error         |
| Danger Fill | Destructive (in confirmation)  | bg: status-error, text: white                               |

**Specs:**
- Height: 40px (default), 36px (compact/table), 48px (prominent)
- Padding: 0 16px (default), 0 12px (compact)
- Border-radius: 8px
- Font: body-md, weight 500
- Icon + label gap: 8px
- Icon size: 16px (default), 14px (compact)
- Transition: all 150ms ease
- Focus ring: 2px offset, primary-200

### 5.6 Filter/Tab Bar

Horizontal tabs for filtering table views:

```
  All     Incomplete     Overdue     Ongoing     Finished
 ─────
```

**Specs:**
- Tab height: 40px
- Font: body-md, weight 500
- Inactive: color neutral-400
- Active: color primary-600, 2px bottom border primary-500
- Hover: color neutral-700
- Gap between tabs: 24px
- Count badge (optional): caption size, neutral-300 bg, neutral-600 text, inline after label

### 5.7 Search & Filter Controls

**Search Bar:**
- Width: 280px (sidebar) / 360px (header)
- Height: 40px
- Border: 1px solid neutral-200
- Border-radius: 8px
- Placeholder: "Search anything…" + ⌘K shortcut badge
- Left icon: magnifying glass, 16px, neutral-300
- Focus: border primary-500, ring 2px primary-100

**Date Range Picker:**
- Displays "Feb 24, 2023 – Mar 15, 2023" format
- Calendar icon right-aligned
- Same border/radius as search
- Dropdown shows dual-month calendar

**Dropdown Select:**
- "Show 8 Rows ▼" style
- Height: 40px
- Border-radius: 8px
- Chevron icon right-aligned

### 5.8 Activity Timeline

A vertical feed showing chronological events (for audit trails, customer journeys, activity logs):

```
  Today
  ──────────────────────────────────────────────────
  🛒  Customer John paid for Order #1234 — $2,500
      2 hours ago

  📋  Customer John filled form on Landing Page
      4 hours ago

  🔗  Customer John clicked link in email "Dec Promo"
      6 hours ago

  Yesterday
  ──────────────────────────────────────────────────
  💬  Customer John replied to Messenger flow
      08/07/2023 14:00
```

**Specs:**
- Vertical line: 2px wide, neutral-100, left-aligned at 20px from container edge
- Event icon: 36px circle, light tinted bg matching event type, centered on the line
- Event text: body-md, neutral-700. Bold: customer names, amounts, campaign names
- Timestamp: body-sm, neutral-400
- Date group header: heading-sm, neutral-900, 32px top margin
- Gap between events: 24px

**Event Type → Icon Mapping:**
| Event Type   | Icon    | Circle BG    |
|--------------|---------|--------------|
| Purchase     | Cart    | primary-50   |
| Form Fill    | Clipboard| accent-purple/10 |
| Email Click  | Link    | accent-cyan/10   |
| Email Open   | Mail    | accent-orange/10 |
| Chat/Message | Message | accent-pink/10   |
| System       | Gear    | neutral-50   |

### 5.9 Charts & Data Visualization

**Line/Area Charts (Sales Overview):**
- Background: white card
- Grid lines: neutral-100, dashed, horizontal only
- Axis labels: caption size, neutral-400
- Primary line: primary-500, 2px stroke
- Secondary line: accent-purple, 2px stroke, dashed
- Area fill: primary-500 at 10% opacity
- Tooltip: dark bg (neutral-900), white text, 8px radius, small shadow

**Top Products / Ranked Lists:**
- Icon: 40px square, 8px radius, light tinted bg
- Primary text: body-md, weight 500, neutral-900 (product name)
- Secondary text: body-sm, neutral-400 (unit count)
- Value: body-md, weight 600, neutral-900 (dollar amount), right-aligned
- Trend indicator: caption size, green ↑ or red ↓ + percentage

### 5.10 Cards (Dashboard Widgets)

Generic card container used for all dashboard modules:

**Specs:**
- Background: neutral-0
- Border: 1px solid neutral-100
- Border-radius: 12px
- Padding: 24px
- Shadow: 0 1px 3px rgba(0,0,0,0.04)
- Header: heading-sm title on the left, action link ("View All") or toggle ("Today | Week") on the right
- Header bottom margin: 16px
- Content area: variable

### 5.11 Quick Sale / Context Panel

Right-side panel for rapid actions:

**Specs:**
- Width: 320px
- Background: neutral-0
- Border-left: 1px solid neutral-100
- Padding: 24px
- Search input at top
- Category chips: pill buttons, 32px height, neutral-50 bg, 8px radius. Active: primary-500 bg, white text
- Cart items: avatar/icon + name + price, quantity stepper (- N +), delete icon
- Subtotal section: divider top, body-md labels, heading-sm values
- CTA button: full-width, 48px height, primary-500, white text, 10px radius

### 5.12 Inventory Alerts / Notification Cards

```
┌──────────────────────────────────────────┐
│  🔴  Organic Coffee Beans                │
│      Critical: 2 units left  [Reorder]   │
├──────────────────────────────────────────┤
│  🟡  Almond Milk                         │
│      Low: 5 units left       [Reorder]   │
└──────────────────────────────────────────┘
```

**Specs:**
- Border-left: 3px solid (red for critical, yellow for low)
- Background: status-error-bg (critical) or status-warning-bg (low)
- Padding: 12px 16px
- Border-radius: 8px
- Reorder button: compact, primary variant
- Gap between alerts: 8px

---

## 6. Interaction Patterns

### 6.1 Bulk Selection

When one or more table rows are selected, a floating action bar appears at the bottom:

- Position: fixed, bottom 24px, centered horizontally
- Background: neutral-900
- Text: white
- Border-radius: 12px
- Shadow: 0 8px 32px rgba(0,0,0,0.2)
- Content: "N Selected" count + action buttons (Duplicate, Print, Delete, Close)
- Animate in: slide up + fade, 200ms ease-out
- Close (✕) deselects all

### 6.2 Pagination

```
Showing 1-9 of 240 entries    ‹ Previous   [1]  2  3  …  12   Next ›
```

- Info text: body-sm, neutral-400, left-aligned
- Page buttons: 36px square, 8px radius
- Active page: primary-500 bg, white text
- Inactive: neutral-0 bg, neutral-700 text
- Hover: neutral-50 bg
- Disabled (prev on page 1): neutral-200 text, no pointer

### 6.3 Table Column Management

"Manage Columns" button opens a popover/drawer:
- Checkbox list of all columns
- Drag to reorder
- Toggle visibility
- "Reset to Default" link at bottom

### 6.4 Empty States

When a table or list has no data:
- Illustration: simple, on-brand line art (64px)
- Heading: heading-sm, neutral-700, "No orders yet"
- Description: body-md, neutral-400, one line max
- CTA: Primary button, "Create First Order"
- Centered in the content area

### 6.5 Loading States

- **Table skeleton:** Animated pulse (neutral-100 → neutral-50) rectangles matching row layout
- **Cards:** Pulse rectangles for number + label
- **Charts:** Pulse rectangle for chart area
- Animation: 1.5s ease-in-out infinite

### 6.6 Toast Notifications

- Position: top-right, 24px from edges
- Width: 360px
- Border-radius: 10px
- Shadow: 0 8px 24px rgba(0,0,0,0.12)
- Left accent border: 4px, color-coded by type
- Auto-dismiss: 5s (success), persistent (error)
- Content: icon + title + description + close button

---

## 7. Responsive Breakpoints

| Breakpoint | Width     | Behavior                                      |
|------------|-----------|-----------------------------------------------|
| Desktop XL | ≥1440px   | Full layout: sidebar + content + context panel |
| Desktop    | 1024–1439 | Sidebar + content. Context panel overlays.     |
| Tablet     | 768–1023  | Collapsed sidebar (icons). Content fills.      |
| Mobile     | <768      | Bottom tab nav. Sidebar becomes drawer.        |

### Responsive Rules:
1. **Stat cards:** 4-across → 2-across (tablet) → stacked (mobile)
2. **Tables:** Horizontal scroll on mobile. Pin first column + last action column.
3. **Context panel:** Becomes full-screen modal on mobile.
4. **Dashboard grid:** 2-column → 1-column on mobile.

---

## 8. Motion & Animation

### 8.1 Timing

| Duration | Usage                                    |
|----------|------------------------------------------|
| 100ms    | Button press, checkbox toggle            |
| 150ms    | Hover states, tooltip show               |
| 200ms    | Menu open, dropdown, tab switch          |
| 300ms    | Modal/drawer open, panel slide           |
| 500ms    | Page transitions, chart animations       |

### 8.2 Easing

- **Default:** `cubic-bezier(0.4, 0, 0.2, 1)` — natural deceleration
- **Enter:** `cubic-bezier(0, 0, 0.2, 1)` — elements entering the screen
- **Exit:** `cubic-bezier(0.4, 0, 1, 1)` — elements leaving the screen
- **Spring:** `cubic-bezier(0.34, 1.56, 0.64, 1)` — playful bounce (use sparingly, e.g., notification badge)

### 8.3 Motion Rules

1. **Sidebar nav transitions:** Active indicator slides vertically, 200ms.
2. **Table row selection:** Background color fades in, 100ms.
3. **Bulk action bar:** Slides up from bottom, 200ms.
4. **Modals:** Fade in + scale from 0.95, 300ms.
5. **Skeleton loading:** Shimmer animation, left-to-right gradient sweep.
6. **Charts:** Lines draw in from left, 500ms, staggered.

---

## 9. Iconography

### 9.1 Icon System

- **Library:** Lucide Icons (consistent with reference designs, open-source, 24px grid)
- **Default size:** 20px (nav), 16px (inline/buttons), 24px (page headers)
- **Stroke width:** 1.5px (default), 2px for emphasis
- **Color:** Inherits text color of parent

### 9.2 Required Icons

| Context              | Icons Needed                                              |
|----------------------|-----------------------------------------------------------|
| Navigation           | LayoutDashboard, ShoppingCart, BarChart3, Users, FileText, Settings, HelpCircle |
| Table Actions        | Pencil, Trash2, MoreHorizontal, Copy, Printer             |
| Status               | CheckCircle, Clock, AlertTriangle, XCircle, ArrowUpRight  |
| Controls             | Search, Filter, ChevronDown, Calendar, Plus, X            |
| Activity Timeline    | ShoppingBag, FileText, Link, Mail, MessageCircle, Zap     |

---

## 10. Shadows & Elevation

| Level    | Value                                  | Usage                              |
|----------|----------------------------------------|------------------------------------|
| `flat`   | none                                   | Inline elements, badges            |
| `sm`     | 0 1px 3px rgba(0,0,0,0.04)           | Cards, inputs (default)            |
| `md`     | 0 4px 12px rgba(0,0,0,0.06)          | Dropdowns, popovers, hover cards   |
| `lg`     | 0 8px 24px rgba(0,0,0,0.1)           | Modals, drawers, toast             |
| `xl`     | 0 16px 48px rgba(0,0,0,0.14)         | Full-screen overlays               |

---

## 11. Border Radius

| Token     | Value | Usage                                     |
|-----------|-------|-------------------------------------------|
| `radius-sm` | 4px  | Checkboxes, small badges                  |
| `radius-md` | 8px  | Buttons, inputs, dropdowns, nav items     |
| `radius-lg` | 12px | Cards, modals, panels                     |
| `radius-xl` | 16px | Feature cards, hero sections              |
| `radius-full`| 9999px | Avatars, status dots, pill badges      |

---

## 12. Form Elements

### 12.1 Text Input
- Height: 40px
- Padding: 0 12px
- Border: 1px solid neutral-200
- Border-radius: 8px
- Font: body-md
- Placeholder: neutral-300
- Focus: border primary-500, box-shadow 0 0 0 3px primary-100
- Error: border status-error, box-shadow 0 0 0 3px status-error-bg
- Label: body-sm, weight 500, neutral-700, 6px bottom margin

### 12.2 Select / Dropdown
- Same as text input visually
- Chevron icon right side
- Dropdown menu: white bg, shadow-md, radius-md, 4px padding
- Option: 36px height, 8px horizontal padding, hover neutral-50

### 12.3 Toggle Switch
- Width: 44px, Height: 24px
- Track off: neutral-200
- Track on: primary-500
- Thumb: white, 20px circle, shadow-sm
- Transition: 150ms

---

## 13. Prompt Template for Bot Usage

When handing this design system to an AI agent to generate screens, use this prompt structure:

```
You are implementing a B2B SaaS application using the following design system.

DESIGN TOKENS:
[paste Section 3 (Colors), Section 4 (Typography), Section 11 (Radius), Section 10 (Shadows)]

COMPONENT SPECS:
[paste relevant component specs from Section 5]

LAYOUT RULES:
[paste Section 2]

PAGE TO BUILD: [describe the page]

REQUIREMENTS:
- Use DM Sans font family
- Dark sidebar (emerald/teal gradient)
- White main content area
- 12-column grid
- Follow the stat cards → filter bar → table → pagination vertical flow
- Use Lucide icons
- All status indicators use pill badges with tinted backgrounds
- Tables must support: checkboxes, sortable headers, row actions (edit/delete/more), hover highlight, bulk selection bar
- Cards use 12px radius, 1px neutral-100 border, subtle shadow

Generate a complete, production-ready [React component / HTML page] for this screen.
```

---

## 14. File Naming & Token Convention

All CSS variables follow this pattern: `--{category}-{modifier}-{variant}`

Examples:
- `--color-primary-500`
- `--space-4`
- `--radius-md`
- `--shadow-sm`
- `--font-body`
- `--text-body-md`

Component class naming follows BEM-light:
- `.card`, `.card-header`, `.card-body`
- `.table`, `.table-header`, `.table-row`, `.table-row--selected`
- `.badge`, `.badge--success`, `.badge--warning`
- `.btn`, `.btn--primary`, `.btn--ghost`, `.btn--danger`
- `.nav-item`, `.nav-item--active`
- `.sidebar`, `.sidebar--collapsed`

---

*This design system is complete and self-contained. Hand any section to a design tool or code-generation AI alongside a page description to produce consistent, cohesive screens across your entire application.*
