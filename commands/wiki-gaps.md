# /wiki-gaps — Detect Knowledge Gaps

Scan your wiki for missing knowledge and broken links.

## Process

### Step 1: Read Wiki State
1. Read `/bot/wiki/index.md` for the full page catalog
2. List all files in `/bot/wiki/pages/` recursively

### Step 2: Find Broken Cross-References
Search all wiki pages for `[[references]]` that point to pages that don't exist:
```
grep -roh '\[\[[^]]*\]\]' /bot/wiki/pages/ 2>/dev/null | sort -u
```
For each reference, check if a corresponding page exists.

### Step 3: Find Orphan Pages
Identify pages that exist but aren't listed in `index.md` or referenced by any other page.

### Step 4: Analyze Mention Frequency
Search `/bot/wiki/log.md` and recent pages for:
- Entities mentioned 3+ times that have no dedicated page
- Topics that come up repeatedly but are under-documented
- People referenced without profile pages

### Step 5: Check Staleness
Flag pages not updated in 30+ days that cover active topics.

## Output

Report organized by priority:

**Missing Pages** (referenced but don't exist):
- [[Page Name]] — referenced by: list of referencing pages

**Under-Documented** (mentioned frequently, sparse or no page):
- Topic/entity — mention count, suggested action

**Orphaned Pages** (exist but unreferenced):
- Page path — consider linking or removing

**Stale Pages** (old content on active topics):
- Page path — last updated date

End with a suggested action: "Want me to create pages for the top gaps?"
