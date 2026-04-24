# /wiki-ingest — Manually Ingest a Document into Wiki

Ingest a document or text into your persistent wiki using two-step knowledge extraction.

## Input

$ARGUMENTS — A file path to ingest, or if empty, ingest the most recently shared document in the conversation.

## Process

### Step 1: Check Cache
1. Calculate SHA256 of the source file: `sha256sum <file> | cut -d' ' -f1`
2. Read `/bot/wiki/sources.json` — if hash exists, report "Already ingested" and stop
3. Read `/bot/wiki/purpose.md` to scope extraction

### Step 2: Analyze
Read the document and extract:
- **Entities**: people, projects, organizations, technologies, locations
- **Concepts**: definitions, methodologies, patterns
- **Relationships**: who works on what, what depends on what, who reports to whom
- **Facts**: dates, numbers, decisions, statuses
- **Contradictions**: anything that conflicts with existing wiki pages

List all extractions before proceeding.

### Step 3: Generate Wiki Pages
For each significant entity or concept:
1. Check if a wiki page already exists — update it if so, create if not
2. Write the page in Obsidian-compatible format with `[[cross references]]`
3. Include a `Source:` line tracing back to the original document
4. Keep pages concise ��� bullets over paragraphs

### Step 4: Update Metadata
1. Add entry to `/bot/wiki/sources.json` with filename, SHA256, date, and pages created
2. Update `/bot/wiki/index.md` with any new pages
3. Append to `/bot/wiki/log.md`

## Output

Report what was extracted:
- Number of entities/concepts found
- Pages created or updated (with names)
- Any contradictions with existing knowledge
- Knowledge gaps identified (referenced entities with no existing page)
