# /wiki-search — Search Your Wiki

Search your persistent wiki for relevant knowledge using multi-signal retrieval.

## Input

$ARGUMENTS — The query to search for.

## Process

### Step 1: Scan Index
Read `/bot/wiki/index.md` and identify pages whose titles or descriptions match the query terms.

### Step 2: Direct Search
Search wiki pages for the query terms:
```
grep -rl "<query terms>" /bot/wiki/pages/ 2>/dev/null
```

### Step 3: Multi-Signal Ranking
For each candidate page, score by:
1. **Title match** (3x weight) — query term appears in the page title
2. **Content match** (2x weight) — query term appears in page body
3. **Cross-references** (1.5x weight) — page is linked from another matching page
4. **Shared source** (1.5x weight) — page was generated from the same source as a matching page
5. **Recency** (1x weight) — more recently updated pages rank higher

### Step 4: Retrieve and Summarize
Read the top 3-5 pages. Present a synthesis of the relevant knowledge, citing which wiki pages the information comes from.

## Output

For each relevant page found:
- Page name and path
- Key relevant content (quoted or summarized)
- Cross-references to explore further

If nothing is found, say so and suggest what information might fill the gap.
