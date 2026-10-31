# Engineering Knowledge Explorer — implementation and review

This change adds a bounded retrieval-and-generation pilot alongside the existing Data Explorer and three physics models. It is stacked on PR #14 (`engineering-knowledge-library-2026`); do not merge this branch into that feature branch as a substitute for reviewing #14. Review/merge #14 first, then retarget this PR to main and review its incremental diff. No production deployment or main merge was performed for this work.

## Architecture verified on 2026-10-31

- Main: `beecc802b7ca54dbfef438b186c1153ecb125ca8`, merged PR #13. PR #14 remains open, Draft and mergeable at `bb04370ae237076165042c7af83a53ec81ca5120`.
- GitHub Pages serves static HTML/JS. `assets/race/ai-lab.js` parses CSVs, selects laps, and computes normalized-distance speed/delta locally. `ai-backend/analysis.py` independently recomputes numerical summaries. Its numerical implementation is unchanged. Vercel auto-detects `ai-backend/index.py`; it now imports the same app from `api/index.py` as local/tests, removing the previous duplicate implementation. The root health-navigation route is preserved.
- Vercel project `mingtao-ai-backend` uses FastAPI/Python. Production alias `mingtao-ai-backend.vercel.app` resolved to deployment `dpl_FvmxNJkex9jAdQHMZHDMD61caD79`, READY, Git metadata points to the same main SHA. The source-file-tree API does not expose Git-deployment trees; deployed file bytes were not independently compared. Verify project root directory is `ai-backend` at deployment review.
- Environment **metadata only** confirmed `OPENAI_API_KEY` and `LAB_ACCESS_TOKEN` in production and preview. Secret values were never requested or read. No Redis quota settings were present. Deployment protection metadata has Vercel authentication enabled except custom domains; no protection setting was changed.

## Retrieval and generation

1. Browser fetches a public, small JSON corpus. Keyword ranking uses question words, answer words and English/Chinese aliases. It retrieves at most four entries; it is lexical retrieval, not embeddings, general web search or exhaustive multilingual semantic search. No search query is sent to analytics or placed in the URL.
2. Inspect the original note, type of basis, limitation, public reference link, matching words and review date. Matching does not establish that a source proves a user-specific claim.
3. Only an explicit Generate action sends `{question}` to `/api/knowledge/ask`. The server validates an 8 KB body and 1–1000 character question, rejects extra fields, and repeats retrieval from its own corpus. No-match responses bypass paid API calls.
4. The backend reserves quota, then sends the question and up to four curated notes to OpenAI. No web tools, arbitrary URL fetches, embeddings, raw course files, telemetry or client-provided source context are used by this endpoint.
5. Structured output separates explanation paragraphs with entry IDs, inference, and unknowns. Both server and browser reject missing or unrecognized citation IDs. Sources are rendered from curated metadata, never model-provided URLs. All output is text, not HTML.
6. An edited question cancels/invalidate pending results; duplicate generation is blocked. Server reservations are not refunded on cancellation or provider failure, so repeated failures cannot circumvent the count cap. No automatic retries.

Citation validation is structural: it does **not** prove entailment or eliminate hallucinations. Prompt injection resistance and factual quality still need live model evaluation. Source organizations and RWTH have not endorsed these notes. The Full Report is not copied into the corpus.

## Corpus decisions

`ai-backend/knowledge.json` is canonical. `python scripts/sync-knowledge.py` produces the identical public copy; `--check` detects drift.

- 15 motorsport entries from PR #13, plus 16 automotive candidates from PR #14.
- 30 searchable entries. `auto-e2-1`, the LFP/nickel comparison, is **excluded from retrieval** pending a direct supporting reference; its inherited NHTSA overview does not substantiate the comparison. The static PR #14 page is not silently rewritten by this PR and still needs that review correction before merge.
- Circular-motion/energy/power references were checked on public OpenStax pages; load-transfer references on NASA Speed News; road-load references on National Academies chapter 7; propulsion on DOE/AFDC; road-tire, cold-weather and EV operational guidance on NHTSA; general cell-failure mechanisms in the public ORNL report.
- ORNL's correct title is *Lithium-Ion UPS Battery Research and Commentary*, March 2023. It concerns stationary UPS systems: note limits explicitly prevent inferring EV certification or pack compliance. This corrects the new corpus metadata, not the static page in PR #14.
- Original experimental-method notes are labelled project-authored rather than externally verified. Friction-circle/racing-line applications are labelled simplified models. Tire temperature wording was narrowed to what road-tire guidance supports.
- No private RWTH slides, teaching PDFs, images, copied worked examples or scraped source text were added. Links to public references are navigation links; no source downloads are redistributed.

## Public AI rollout — not yet activated

The visitor token field has been removed in this branch. The production frontend/backend are unchanged until reviewed merges/deployments. Default backend behavior remains private pilot for compatibility, so a new frontend deployed before public quota configuration will show an unavailable message. Never put a real API key or shared token into browser code.

For a preview deployment first, configure the following **server-side** values using approved secret entry:

| Setting | Value / purpose |
| --- | --- |
| `OPENAI_API_KEY` | Reuse existing secret; never export to browser or this document |
| `OPENAI_MODEL` | `gpt-5.4-mini` or omit; public mode rejects any other model pending cost review |
| `UPSTASH_REDIS_REST_URL` | HTTPS Redis REST endpoint supporting atomic EVAL |
| `UPSTASH_REDIS_REST_TOKEN` | Server-side quota credential |
| `LAB_QUOTA_SALT` | Independent random secret, at least 32 characters |
| `LAB_PUBLIC_AI` | `true` only after quota service and billing review |
| `LAB_QUOTA_NAMESPACE` | Stable shared namespace, default `engineering-v1`; changing it resets counters |
| `LAB_AI_TOTAL_LIMIT` | Default **300 cumulative requests**, never expires automatically |
| `LAB_AI_DAILY_LIMIT` | Default **100 requests/day**, UTC |
| `LAB_AI_IP_DAILY_LIMIT` | Default **10 per client IP/day** |
| `LAB_AI_IP_MINUTE_LIMIT` | Default **2 per client IP/minute**, fixed windows |

The two paid endpoints share all four counters. A single atomic Lua script checks then reserves them before contacting OpenAI; a test executes the Lua logic and concurrent reservations using fakeredis's Lua engine. No process-memory fallback. Missing configuration, malformed identity, Redis timeout, denial or error fails closed. CORS is not authentication. Requests from any source consume the same caps. Shared school/campus NATs may share the per-IP allowance. Fixed minute windows permit a small boundary burst; cumulative and daily counters remain enforced.

Quota keys contain a daily HMAC pseudonym of the edge-provided IP, never the raw IP. Per-IP keys expire after the window with a short grace period; only aggregate cumulative counts persist. Vercel's `x-vercel-forwarded-for` is trusted only when `VERCEL=1`, with strict IP parsing; no client-selected `x-forwarded-for` fallback. Verify this header in the actual preview deployment before enabling public mode. Infrastructure may retain operational access logs independently.

Each call permits up to 1200 output tokens. Telemetry summaries are limited to 24,000 JSON characters; telemetry file labels become `Lap 1`, `Lap 2`, etc. before going to OpenAI, matching frontend legend order. The knowledge corpus bounds context to four notes. Failed requests conservatively consume a reservation. The count caps are **not a precise dollar budget**; model prices, input tokenization and usage elsewhere also matter. Do not reset aggregate counters without reviewing actual spend.

The OpenAI account billing settings were **not** inspected or modified. Before public rollout, the owner should verify automatic recharge is off and enable an appropriate project **hard spend limit**, with headroom below the desired $10 allowance. A spend alert alone does not stop requests. Enforcement and prepaid cutoff can be delayed, so neither guarantees exactly zero overage. See [OpenAI spend limits](https://developers.openai.com/api/docs/guides/spend-limits) and [prepaid billing](https://help.openai.com/en/articles/8264644-setting-up-and-managing-prepaid-api-billing).

No new database account, subscription, production flag or credential was created. Selecting/connecting a durable quota service and confirming billing controls are the remaining operational steps; there is no silent paid-service provisioning. After both are verified, exercise the real preview end-to-end (including limit exhaustion), review a small bilingual factual/adversarial question set, and only then approve production rollout. Keep local knowledge search available when allowance is exhausted.

## Privacy

No application persistence of questions, answers or files, no generation/search analytics, no browser token storage. Question text necessarily reaches OpenAI when Generate is pressed; do not enter confidential information. `store=false` is used but is not zero-retention assurance. No secrets are printed, copied to local env files or included in the PR. API responses use `Cache-Control: no-store`.

## Verification commands and limitations

Install `ai-backend/requirements-dev.txt` in an isolated Python environment, then:

```sh
python -m unittest discover -s ai-backend/tests -v
node tests/analytics.test.cjs
node tests/knowledge-search.test.cjs
python scripts/sync-knowledge.py --check
node --check assets/race/knowledge-explorer.js
node --check assets/race/knowledge-search.js
git diff --check
```

For the local browser QA build: `python scripts/build-explorer-preview.py` then `sites-preview start <checkout>`. `.openai/` and `preview-build/` are local-only; never commit or publish the generated QA fixture pages. `qa-explorer.html` visibly labels simulated generation and supports `scenario=quota`, `scenario=forged`, and `scenario=slow`. `qa-mobile.html` uses 390px and 768px frames in a real Chrome browser; these test responsive CSS, not physical-phone hardware or touch behavior.

The first Vercel preview health request revealed that the two old entrypoints diverged: it returned the legacy response despite a successful build. The entrypoints were unified and an identity/health/cache-header regression test added before the final deployment verification.

Tests cover retrieval relevance/no-match/Chinese aliases, 30/30 exact-card top-one retrieval, corpus parity, quarantined entries, malformed requests, missing quota configuration, quota exhaustion/failure, safe model selection, structured citation rejection, mocked generation, filename omission, shared telemetry authorization, and atomic/concurrent count enforcement. Existing numerical and analytics privacy tests are retained. Browser QA completed in real Chrome: desktop English search, selected Chinese keyword search, out-of-domain no-match, clearly simulated generation with three labelled sections and safe HTML-as-text rendering, forged citation rejection, exhausted allowance fallback, and delayed response invalidation after editing. Phone-width frame measurement: viewport/content widths both 375px (390px frame minus scrollbar), single 331px result column, no horizontal overflow. A 768px frame was visually inspected. These are responsive browser checks, not a physical-phone test.

The original Buttonwillow demo loaded all three laps and rendered speed/delta charts and the unchanged 7.401s improvement (2:38.624 to 2:31.223). Seventeen Python tests and both Node test scripts passed. Syntax checks, corpus parity and diff whitespace checks passed. Live paid OpenAI calls and a real hosted Redis service are not claimed as tested.
