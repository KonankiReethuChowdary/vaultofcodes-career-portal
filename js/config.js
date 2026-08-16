/* =========================================================
   VaultofCodes — Career Portal configuration
   =========================================================
   HOW TO CONNECT YOUR OWN GOOGLE SHEET
   -------------------------------------------------------
   1. Build your sheet with these column headers in row 1
      (see /sheet-template.csv for a ready-made copy):

      Title | Type | Department | Location | Mode | Duration |
      Experience | Skills | Description | Deadline | ApplyLink | Status

   2. In Google Sheets: File -> Share -> Publish to web
      -> choose the specific sheet/tab -> Comma-separated
      values (.csv) -> Publish.

   3. Copy the generated URL (it looks like
      https://docs.google.com/spreadsheets/d/e/xxxxx/pub?output=csv)
      and paste it below as SHEET_CSV_URL.

   This method needs no API key and never exposes credentials
   in the frontend, satisfying the "no sensitive credentials
   in frontend code" requirement. See README.md for the two
   documented alternatives (Google Sheets API with a backend
   proxy, and Google Apps Script Web App).
   ========================================================= */

window.CAREER_CONFIG = {
  // Paste your published Google Sheet CSV URL here.
  // Leave empty ('') to use the bundled sample dataset in data/opportunities.json
  SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQUUAJGinPgv13kbT6h6FfxxjjXoXfQyI2W1uJKUpUaO0Nyh-HO5zAAD_3awlVOJo7PTJT7Aw_M1O3e/pub?output=csv',

  // Fallback dataset used when SHEET_CSV_URL is empty, or the sheet
  // fetch fails (network error, sheet unpublished, etc). This keeps the
  // demo fully functional out of the box.
  FALLBACK_JSON_URL: 'data/opportunities.json',

  // Cards newer than this many days show a "Recently added" badge.
  // Requires a PostedDate column; safely ignored if absent.
  NEW_BADGE_DAYS: 7,

  // Opportunities per page
  PAGE_SIZE: 6,

  // Network timeout for the sheet fetch, in ms, before falling back
  FETCH_TIMEOUT_MS: 8000,
};
