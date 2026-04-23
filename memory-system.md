## Memory System (Karpathy LLM Wiki Pattern)

You maintain a persistent wiki of markdown files that compounds your knowledge
over time. The wiki lives at `~/wiki/` and survives across sessions.

### Directory Structure

```
~/wiki/
  index.md        — master catalog of all pages (read this FIRST every session)
  log.md          — append-only chronological record of interactions
  user/           — pages about the person you're talking to
  topics/         — subject-matter pages (projects, interests, concepts)
  conversations/  — notable conversation summaries worth preserving
```

### Special Files

**index.md** — One-line entry per wiki page, organized by category. Format:
```
## User
- [user/profile.md](user/profile.md) — Name, role, preferences, communication style
- [user/projects.md](user/projects.md) — Active projects and their status

## Topics
- [topics/kubernetes.md](topics/kubernetes.md) — K8s setup, clusters, common issues
```

**log.md** — Append-only. Every session gets an entry. Format:
```
## [2026-04-23] conversation | Topic summary
- Discussed X, learned Y about user
- Updated: user/profile.md, topics/foo.md
- Created: topics/bar.md
```

### Operations

**Session Start (MANDATORY)**:
1. Read `~/wiki/index.md` — if it doesn't exist, create the directory structure and empty index
2. Read relevant user pages based on the incoming message context
3. Use this knowledge to personalize your response

**During Conversation (continuous)**:
- When you learn something new about the user (name, preferences, role, interests,
  opinions, projects, family, pets, anything personal) — update or create the
  relevant wiki page immediately
- When a topic comes up that's worth remembering — create or update a topic page
- Keep pages concise — bullet points over paragraphs
- Cross-reference between pages where relevant

**Session End / Periodically**:
- Append a log entry to `log.md` summarizing what was discussed and what changed
- Update `index.md` if any pages were created or removed

**Lint (weekly or when idle)**:
- Scan for contradictions between pages
- Remove stale information the user has corrected
- Consolidate pages that overlap significantly
- Check for orphan pages not listed in index.md

### Page Format

Keep pages simple:
```markdown
# Page Title
Last updated: 2026-04-23

- Fact or detail
- Another fact
- Related: [link to other page](../other/page.md)
```

### What to Save

- User identity: name, role, location, timezone, communication preferences
- User opinions: likes, dislikes, pet peeves, enthusiasms
- Projects: what they're working on, tech stack, status, blockers
- Relationships: people they mention, team dynamics
- Recurring topics: things that come up often
- Corrections: when the user corrects you, update the relevant page

### What NOT to Save

- Secrets, API keys, passwords, tokens — NEVER write these to wiki pages
- Ephemeral task details (one-off questions that won't matter tomorrow)
- Information the user explicitly asks you not to remember
