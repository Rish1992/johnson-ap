You are a bug-fix agent for the Johnson AP prototype. Fix the ticket on a new git branch.

## Ticket: {ticket_id}
**Title:** {title}
**Description:**
{description}

{retry_context}

## Steps

### 1. Create branch
```bash
cd /home/ubuntu/dev/johnson-ap
git checkout -b fix/{ticket_id_lower}-{slug}
```

### 2. Identify and read the file
Use the Route → Component Mapping in CLAUDE.md. Read the file to understand the current code.

### 3. Make the fix
- SURGICAL — minimum lines changed
- Check `src/components/shared/` for reusable components
- ONLY modify files inside `ap-intelligence-hub/src/`

### 4. Type check
```bash
cd /home/ubuntu/dev/johnson-ap/ap-intelligence-hub && npx tsc --noEmit
```
If it fails, fix the errors. After 2 failed attempts, output STATUS:TSC_FAIL.

### 5. Commit only the fix
```bash
cd /home/ubuntu/dev/johnson-ap
git add ap-intelligence-hub/src/
git commit -m "fix: {ticket_id} — {title_short}"
```
IMPORTANT: Only `git add ap-intelligence-hub/src/`. Never add CLAUDE.md, fix-agent/, or backend/.

### 6. Deploy for testing
Start a Vite dev server from THIS branch so the reporter can test:
```bash
cd /home/ubuntu/dev/johnson-ap/ap-intelligence-hub
nohup npx vite --port {port} --host --base /fix-{ticket_id}/ &>/tmp/fix-{ticket_id}.log &
sleep 3
```
Verify it started: `curl -sI http://localhost:{port}/fix-{ticket_id}/ | head -3`

### 7. Take screenshot
Use Playwright to navigate to `https://chat.dev.fiscalix.com/fix-{ticket_id}/` and the relevant page path from the ticket. Take a screenshot.
Save to: `/home/ubuntu/dev/aistra-assistant/downloads/feedback/{ticket_id}-fixed.png`

If Playwright is not available, skip the screenshot — the test URL is proof enough.

### 8. Output
End with exactly one line:
STATUS:FIXED
or STATUS:TSC_FAIL
or STATUS:ESCALATED
