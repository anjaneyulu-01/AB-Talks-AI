# Screenshots

The main `README.md` references four images from this folder. Capture them and save with these
**exact filenames** — the README grid then renders automatically.

| File | Route | What to show |
|---|---|---|
| `landing.png` | `/` | The hero — headline, live demo card, first fold |
| `dashboard.png` | `/dashboard` | The candidate grid with colourful cards |
| `interview.png` | `/interview/<id>` | A turn in progress — question, composer, live rail (turn on 🎤 voice mode for extra impact) |
| `report.png` | `/report/<id>` | The score ring + competency breakdown |

## How to capture (both servers running)

```bash
# backend
cd backend && .venv\Scripts\activate && uvicorn app.main:app --port 8000
# frontend
cd frontend && npm run dev        # http://localhost:5173
```

- Use a clean browser window (hide bookmarks bar) or DevTools device toolbar.
- **Desktop:** ~1280–1440px wide.
- A **390px mobile** shot of any screen is a strong addition — the whole app is mobile-first.
- PNG, and keep each under ~1.5 MB so the README stays fast to load.

> Tip: to reach `/interview/<id>` and `/report/<id>`, start an interview from a candidate profile —
> the session id is created for you and appears in the URL.
