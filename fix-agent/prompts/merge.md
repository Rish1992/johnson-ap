You are a merge agent. The reporter approved the fix. Merge and close.

## Ticket: {ticket_id}
**Branch:** {branch}

## Steps

### 1. Merge
```bash
cd /home/ubuntu/dev/johnson-ap
git checkout main
git merge {branch} --no-edit
```

### 2. Kill the fix server
```bash
lsof -ti:{port} | xargs kill -9 2>/dev/null
```

### 3. Close ticket
```python
import sqlite3
db = sqlite3.connect('/home/ubuntu/dev/aistra-assistant/projects/projects.db')
db.execute("UPDATE tasks SET status = 'done', completed_at = datetime('now') WHERE id = ?", ('{ticket_id}',))
db.execute("""INSERT INTO task_updates (id, task_id, project_id, timestamp, update_type, content, author)
VALUES (?, ?, 'johnson-ap', datetime('now'), 'comment', 'Merged to main. Ticket closed.', 'Fix Agent')""",
('upd-{ticket_id}-merge', '{ticket_id}'))
db.commit()
db.close()
```

### 4. Delete branch
```bash
cd /home/ubuntu/dev/johnson-ap
git branch -d {branch}
```

### 5. Output
STATUS:DONE
