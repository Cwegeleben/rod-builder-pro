# Importer Settings UI — Guided Flow

This page (app/routes/app.imports.$templateId.tsx) now follows a clear 4-step flow:

1. Setup target

- Pick the Target. Source URL auto-fills and is read-only.
- Click "Discover series (with preview)" to fetch series seeds and a quick preview sample.

2. Seeds

- Edit the discovered series URLs directly.
- Click "Use Seeds" to update the working set; "Reset to discovered" restores the last discovered set.

3. Preview

- Shows a quick summary of parsed variants and attributes (when available from discovery).
- If the preview fails, a banner shows the error and server debug is expandable.

4. Save & Crawl

- "Save and Crawl" persists Name, Target, and current Seeds then starts the background crawl. Progress appears on the Imports list.

Notes

- No functionality was removed; actions were consolidated to reduce ambiguity.
- The built-in toasts and banners provide immediate feedback.
- Debug details remain at the bottom for troubleshooting.
