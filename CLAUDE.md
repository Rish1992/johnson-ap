# Johnson AP — Agent Context

**Auto-loaded by claude -p sessions in this directory.**

## Project
Johnson Health Tech Australia — AP Invoice Processing Automation prototype.
React 19 + TypeScript + Vite 7 + shadcn/ui + Zustand. 100% mock data, no real backend processing.

## File Structure
```
johnson-ap/
├── ap-intelligence-hub/     # React frontend
│   ├── src/pages/           # Page components
│   ├── src/components/      # Shared + UI components
│   ├── src/mock/            # Mock data (handlers.ts, vendors.ts)
│   ├── src/types/           # TypeScript types
│   ├── src/stores/          # Zustand stores
│   └── src/router/          # Routes
├── backend/                 # FastAPI (port 8090)
└── fix-agent/               # Autonomous fix driver
```

## Route → Component Mapping
| URL | Component |
|-----|-----------|
| `/login` | `src/pages/auth/LoginPage.tsx` |
| `/agent/emails` | `src/pages/agent/EmailReview.tsx` |
| `/agent/validation` | `src/pages/agent/DataValidationQueue.tsx` |
| `/agent/cases` | `src/pages/agent/CaseBrowser.tsx` |
| `/agent/cases/:id/overview` | `src/pages/agent/case-detail/CaseDetailsTab.tsx` |
| `/agent/cases/:id/validation` | `src/pages/agent/case-detail/DataValidationTab.tsx` |
| `/agent/cases/:id/audit` | `src/pages/agent/case-detail/AuditLogTab.tsx` |
| `/approver/queue` | `src/pages/approver/ApproverQueue.tsx` |
| `/approver/cases/:id` | `src/pages/approver/ApproverCaseView.tsx` |
| `/admin/dashboard` | `src/pages/admin/AdminDashboard.tsx` |
| `/admin/masters/*` | `src/pages/admin/MastersHub.tsx` |
| `/admin/users` | `src/pages/admin/UserManagement.tsx` |

## Rules
- **SURGICAL EDITS** — minimum files, minimum lines, reuse existing components
- **Shared components** at `src/components/shared/` — always check before building new
- **Type check:** `cd ap-intelligence-hub && npx tsc --noEmit`
- **Never add new npm dependencies** without explicit approval
- **Only modify files inside `ap-intelligence-hub/src/`** — never touch fix-agent/, CLAUDE.md, or backend/

## Git
- Work on a branch: `fix/T-JXXX-slug`
- Never commit directly to main
- Only `git add ap-intelligence-hub/src/` — never `git add -A`

## Testing
- Dev server (main): `https://chat.dev.fiscalix.com/johnson/` (port 5180)
- Playwright for screenshots
- Login credentials (all password: `password123`):
  - Agent: `sarah.chen@company.com`
  - Approver: `emma.thompson@company.com`
  - Admin: `alex.kumar@company.com`

## talk-to-project
- DB: `/home/ubuntu/dev/aistra-assistant/projects/projects.db`
- Project: `johnson-ap`
- Screenshots: save to `/home/ubuntu/dev/aistra-assistant/downloads/feedback/`
- Screenshot URL: `https://chat.dev.fiscalix.com/feedback-screenshots/{filename}`

## Status Markers (for driver.py parsing)
When running as a fix agent, end your final message with exactly one of:
```
STATUS:FIXABLE
STATUS:NEEDS_CLARITY
STATUS:ESCALATED
STATUS:FIXED
STATUS:TSC_FAIL
STATUS:DONE
```
