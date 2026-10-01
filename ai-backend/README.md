# Motorsport AI Lab — private pilot

Python performs calculations; OpenAI interprets only numeric summaries. No database or raw-file persistence. Do not publicly enable AI without shared durable request quotas and a global cost cutoff; OpenAI project budget alerts should not be assumed to be hard spending caps.

Deploy this directory as a separate Vercel Python project (or copy it to a dedicated backend repository). Configure OPENAI_API_KEY, OPENAI_MODEL and a strong LAB_ACCESS_TOKEN in Vercel environment variables. Never commit actual secrets. Set the frontend endpoint constant to the deployed HTTPS origin, then test /api/health and the complete pipeline. The pilot token is entered manually and is not embedded in JavaScript. CORS is not authentication.

Local run: install requirements; run `uvicorn api.index:app --port 8000` from this directory. `python -m unittest discover -s tests` runs numerical tests. Live AI is deliberately untested until account credentials are configured.

The browser extracts seven channels from selected beacon-delimited laps to keep requests below Vercel's 4.5 MB payload cap. Individual frontend files are limited to 20 MB. Maximum six selected laps, 12,000 samples per lap, 3.5 MB backend payload. Larger payloads must select fewer laps. First/last session segments are excluded, but middle segments can still include traffic, yellow flags or pit visits: inspect selections. Normalized-distance delta is approximate spatial alignment, not GPS-path registration. Gear is logger-calculated; no throttle or brake-pressure channels are available. Ten sectors are equal-distance bins, not identified corners.

API: POST /api/analyze {laps:[{label,duration,samples}]} returns numerical traces and ten sector deltas. Sample fields: time s, distance m, speed km/h, RPM, lateral g, longitudinal g, calculated gear. POST /api/ask accepts the same laps plus question, recomputes results, and requires Bearer pilot token. Responses requests use store=false, but this does not imply zero provider retention. No raw filenames or driver metadata are intentionally forwarded, though lap labels are included.
