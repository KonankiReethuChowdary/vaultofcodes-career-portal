# VaultofCodes — About Us & Career Portal

Two production-quality, static pages for the VaultofCodes website:

- `index.html` — About Us page
- `career.html` — Career Portal (jobs + internships, backed by a Google Sheet)

Built with plain HTML, CSS and JavaScript — no build step, no framework, no
bundler. Open `index.html` in a browser, or serve the folder with any static
file server, and everything works.

## Project structure

```
vaultofcodes/
├── index.html              About Us page
├── career.html              Career Portal
├── sheet-template.csv       Copy-pasteable Google Sheet starter (headers + 2 sample rows)
├── css/
│   ├── styles.css            Shared design tokens, nav, footer, buttons
│   ├── about.css              About page styles
│   └── career.css             Career page styles
├── js/
│   ├── main.js                 Shared behaviour: nav toggle, scroll reveal, terminal type-in
│   ├── config.js                Career Portal configuration (Sheet URL goes here)
│   └── career.js                 Data fetching, search, filters, pagination, modal
└── data/
    └── opportunities.json         Bundled sample dataset (used as a fallback / demo data)
```

## Running it locally

Any static server works, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`.

Opening `index.html` directly via `file://` also works, **except** the
Career page's `fetch()` calls for `data/opportunities.json` may be blocked by
the browser's local file security policy — use a local server for `career.html`.

## Google Sheets integration

The Career page never hard-codes listings. It reads them from a Google Sheet
at runtime, using the **"Publish to web" CSV** method — no API key, no
credentials in the frontend.

### 1. Sheet structure

Create a Google Sheet with these column headers in row 1 (see
`sheet-template.csv` for a ready-made copy you can paste in):

| Column       | Notes                                                        |
|--------------|---------------------------------------------------------------|
| `Title`      | Position title (required)                                     |
| `Type`       | `Job` or `Internship`                                          |
| `Department` | e.g. `Engineering`, `Design`, `Marketing`                       |
| `Location`   | e.g. `Remote`, `Chennai, IN`                                     |
| `Mode`       | `Remote`, `Hybrid`, or `On-site`                                  |
| `Duration`   | e.g. `Full Time`, `2 Months`                                       |
| `Experience` | e.g. `0-1 years`                                                     |
| `Skills`     | Comma-separated, e.g. `HTML, CSS, JavaScript`                        |
| `Description`| Short paragraph shown on the card and in details                      |
| `Deadline`   | `YYYY-MM-DD` (used for sorting and the "urgent" deadline flag)          |
| `ApplyLink`  | URL the Apply button opens                                                |
| `Status`     | `Active` or `Closed` — only `Active` rows appear in the listing            |
| `PostedDate` | Optional, `YYYY-MM-DD` — powers the "New" badge and "Newest first" sort      |

Column matching is **case- and spacing-insensitive**, so `Apply Link`,
`applylink`, and `ApplyLink` all resolve to the same field.

### 2. Publish the sheet

In Google Sheets: **File → Share → Publish to web** → choose the specific
sheet/tab → format **Comma-separated values (.csv)** → **Publish**.

Copy the generated URL. It looks like:

```
https://docs.google.com/spreadsheets/d/e/2PACX-1vQUUAJGinPgv13kbT6h6FfxxjjXoXfQyI2W1uJKUpUaO0Nyh-HO5zAAD_3awlVOJo7PTJT7Aw_M1O3e/pub?output=csv
```

### 3. Point the site at it

Open `js/config.js` and paste the URL:

```js
window.CAREER_CONFIG = {
  SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQUUAJGinPgv13kbT6h6FfxxjjXoXfQyI2W1uJKUpUaO0Nyh-HO5zAAD_3awlVOJo7PTJT7Aw_M1O3e/pub?output=csv',,
  ...
};
```

That's it — add, edit, or remove a row in the sheet and the Career page picks
it up on next load. No frontend code changes needed, satisfying the "dynamic
listings" requirement.

### Alternative implementations (documented, not wired up)

The current build uses the published-CSV method because it needs zero
credentials. Two other secure options, if you'd rather not publish the sheet
publicly:

1. **Google Sheets API + a thin backend proxy** — call
   `spreadsheets.values.get` from a small server (Node/Express, a Cloud
   Function, etc.) that holds the API key server-side, and have `career.js`
   fetch from that proxy endpoint instead of a Google URL. Never call the
   Sheets API with a key directly from the browser.
2. **Google Apps Script Web App** — deploy a script bound to the sheet with
   a `doGet()` that returns JSON, deploy it as a Web App ("Anyone" access),
   and fetch that URL. Same effect as method 1 without provisioning a server.

Either way, swap `SHEET_CSV_URL` for your endpoint and adjust the parsing in
`career.js`'s `loadData()` if your endpoint returns JSON instead of CSV — the
`normaliseRow()` field-matching logic already works for either shape.

### Fallback behaviour

If `SHEET_CSV_URL` is empty, unreachable, or the sheet is unpublished, the
page automatically falls back to `data/opportunities.json` so the demo is
always functional. This also means the site "just works" the moment you
unzip it, before you've connected a real sheet.

## Functionality checklist

- [x] Dynamic listings from Google Sheets (no hard-coded frontend data)
- [x] Active / Closed status filtering (only `Active` rows are listed)
- [x] Search by title, skills, and department
- [x] Filters: opportunity type (tabs), department, work mode, location
- [x] Sort: newest first / deadline soonest
- [x] Opportunity details via modal (title, all metadata, full description, skills)
- [x] Apply button opens the sheet's `ApplyLink` in a new tab
- [x] Empty state ("No opportunities are currently available…")
- [x] No-results-for-filter state, with a "Clear filters" action
- [x] Loading state (skeleton cards)
- [x] Error state ("We're unable to load current opportunities…") with Retry
- [x] Pagination
- [x] "Recently added" badge (based on `PostedDate`)
- [x] Deadline urgency flag (≤ 5 days)
- [x] Bookmark/save an opportunity (stored in the visitor's browser)
- [x] Copy link + email-share from the details modal
- [x] Fully responsive, down to small mobile widths
- [x] Reduced-motion support (`prefers-reduced-motion`) and visible focus states

## Design notes

Direction: **"the syllabus meets the terminal."** Since VaultofCodes teaches
code, the signature element is a typed terminal window in the About hero, and
monospace tags/chips carry metadata on Career cards — a nod to how the
company's own subject matter (code) looks, used functionally rather than as
decoration. Palette is a cool paper background with an indigo/violet primary
accent and warm amber for highlights and CTAs, kept out of the more common
cream/terracotta and near-black/neon templates.

## Browser support

Uses standard `fetch`, `IntersectionObserver`, and CSS custom properties —
all supported in current Chrome, Edge, Firefox, and Safari. No polyfills
included; add them if you need to support older browsers.

## Content note

All company copy, team bios, and figures are placeholder content, as
specified in the assignment brief. Replace with real content before
production deployment.
