/* =========================================================
   VaultofCodes — Career Portal logic
   Fetches opportunities from a published Google Sheet (CSV),
   falls back to a bundled JSON sample, then renders a
   searchable, filterable, paginated listing with a details
   modal and full loading / error / empty states.
   ========================================================= */

(function () {
  const CFG = window.CAREER_CONFIG || {};
  const els = {};
  let RAW = [];          // all rows as fetched, normalised
  let CURRENT_TAB = 'all';
  let CURRENT_PAGE = 1;
  let sortMode = 'newest';
  const filters = { department: '', mode: '', location: '' };
  let searchTerm = '';
  let dataSource = 'sheet'; // 'sheet' | 'fallback'

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheEls();
    bindStaticEvents();
    loadData();
  }

  function cacheEls() {
    els.grid = document.getElementById('listing-grid');
    els.skeleton = document.getElementById('skeleton-grid');
    els.stateBlock = document.getElementById('state-block');
    els.resultsMeta = document.getElementById('results-meta');
    els.resultsCount = document.getElementById('results-count');
    els.pagination = document.getElementById('pagination');
    els.searchInput = document.getElementById('search-input');
    els.tabRow = document.getElementById('tab-row');
    els.deptSelect = document.getElementById('filter-department');
    els.modeSelect = document.getElementById('filter-mode');
    els.locSelect = document.getElementById('filter-location');
    els.sortSelect = document.getElementById('sort-select');
    els.clearBtn = document.getElementById('clear-filters');
    els.filterToggle = document.getElementById('filter-toggle-btn');
    els.filtersRow = document.getElementById('filters-row');
    els.modalOverlay = document.getElementById('modal-overlay');
    els.modalBody = document.getElementById('modal-body');
    els.toast = document.getElementById('toast');
    els.statTotal = document.getElementById('stat-total');
    els.statJobs = document.getElementById('stat-jobs');
    els.statIntern = document.getElementById('stat-internships');
  }

  function bindStaticEvents() {
    els.searchInput.addEventListener('input', debounce((e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      CURRENT_PAGE = 1;
      render();
    }, 220));

    els.tabRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      [...els.tabRow.children].forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      CURRENT_TAB = btn.dataset.tab;
      CURRENT_PAGE = 1;
      render();
    });

    [els.deptSelect, els.modeSelect, els.locSelect].forEach(sel => {
      sel.addEventListener('change', () => {
        filters.department = els.deptSelect.value;
        filters.mode = els.modeSelect.value;
        filters.location = els.locSelect.value;
        CURRENT_PAGE = 1;
        render();
      });
    });

    els.sortSelect.addEventListener('change', () => {
      sortMode = els.sortSelect.value;
      render();
    });

    els.clearBtn.addEventListener('click', () => {
      searchTerm = '';
      els.searchInput.value = '';
      filters.department = filters.mode = filters.location = '';
      els.deptSelect.value = els.modeSelect.value = els.locSelect.value = '';
      CURRENT_TAB = 'all';
      [...els.tabRow.children].forEach(c => c.classList.toggle('active', c.dataset.tab === 'all'));
      CURRENT_PAGE = 1;
      render();
    });

    if (els.filterToggle) {
      els.filterToggle.addEventListener('click', () => {
        els.filtersRow.classList.toggle('collapsed');
      });
    }

    els.modalOverlay.addEventListener('click', (e) => {
      if (e.target === els.modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  /* ---------------- Data loading ---------------- */

  function loadData() {
    setState('loading');

    const sheetUrl = (CFG.SHEET_CSV_URL || '').trim();
    if (!sheetUrl) {
      // No sheet configured yet — use bundled sample so the demo works out of the box
      dataSource = 'fallback';
      fetchJsonFallback();
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CFG.FETCH_TIMEOUT_MS || 8000);

    fetch(sheetUrl, { signal: controller.signal })
      .then(res => {
        clearTimeout(timer);
        if (!res.ok) throw new Error('Sheet responded with ' + res.status);
        return res.text();
      })
      .then(csvText => {
        const parsed = parseCsv(csvText);
        if (!parsed.length) throw new Error('Sheet returned no rows');
        RAW = parsed.map(normaliseRow).filter(Boolean);
        dataSource = 'sheet';
        afterLoad();
      })
      .catch(() => {
        // Sheet unreachable, unpublished, or malformed — fall back gracefully
        dataSource = 'fallback';
        fetchJsonFallback();
      });
  }

  function fetchJsonFallback() {
    fetch(CFG.FALLBACK_JSON_URL || 'data/opportunities.json')
      .then(res => {
        if (!res.ok) throw new Error('Fallback dataset unavailable');
        return res.json();
      })
      .then(rows => {
        RAW = rows.map(normaliseRow).filter(Boolean);
        afterLoad();
      })
      .catch(() => setState('error'));
  }

  function afterLoad() {
    if (!RAW.length) { setState('empty'); return; }
    populateFilterOptions();
    setState('ready');
    render();
  }

  /* ---------------- CSV parsing (lightweight, no dependency) ---------------- */

  function parseCsv(text) {
    // Handles quoted fields, commas inside quotes, and escaped quotes ("")
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], next = text[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') { /* skip */ }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];

    const headers = rows[0].map(h => h.trim());
    return rows.slice(1)
      .filter(r => r.some(cell => cell && cell.trim() !== ''))
      .map(r => {
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = (r[idx] || '').trim(); });
        return obj;
      });
  }

  /* ---------------- Normalisation ---------------- */

  function pick(obj, keys) {
    for (const k of keys) {
      const found = Object.keys(obj).find(o => o.toLowerCase().replace(/[\s_]/g, '') === k);
      if (found && obj[found] !== undefined && obj[found] !== '') return obj[found];
    }
    return '';
  }

  function normaliseRow(row) {
    const title = pick(row, ['title', 'position', 'positiontitle']);
    if (!title) return null;
    return {
      id: pick(row, ['id']) || slugify(title) + '-' + Math.random().toString(36).slice(2, 7),
      title,
      type: pick(row, ['type', 'opportunitytype']) || 'Job',
      department: pick(row, ['department']) || 'General',
      location: pick(row, ['location']) || 'Not specified',
      mode: pick(row, ['mode', 'workmode']) || 'Not specified',
      experience: pick(row, ['experience']) || 'Not specified',
      duration: pick(row, ['duration']) || 'Not specified',
      skills: pick(row, ['skills', 'skillsrequired']) || '',
      description: pick(row, ['description', 'shortdescription']) || '',
      deadline: pick(row, ['deadline', 'applicationdeadline']) || '',
      applyLink: pick(row, ['applylink', 'applyurl', 'link']) || '#',
      status: (pick(row, ['status']) || 'Active'),
      postedDate: pick(row, ['posteddate', 'dateposted']) || '',
    };
  }

  function slugify(s) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  /* ---------------- Filter options ---------------- */

  function populateFilterOptions() {
    const active = RAW.filter(r => (r.status || '').toLowerCase() === 'active');
    fillSelect(els.deptSelect, unique(active.map(r => r.department)), 'Department');
    fillSelect(els.modeSelect, unique(active.map(r => r.mode)), 'Work mode');
    fillSelect(els.locSelect, unique(active.map(r => r.location)), 'Location');

    const jobs = active.filter(r => r.type.toLowerCase() === 'job').length;
    const interns = active.filter(r => r.type.toLowerCase() === 'internship').length;
    if (els.statTotal) els.statTotal.textContent = active.length;
    if (els.statJobs) els.statJobs.textContent = jobs;
    if (els.statIntern) els.statIntern.textContent = interns;

    const allTab = els.tabRow.querySelector('[data-tab="all"] .count');
    const jobTab = els.tabRow.querySelector('[data-tab="job"] .count');
    const internTab = els.tabRow.querySelector('[data-tab="internship"] .count');
    if (allTab) allTab.textContent = active.length;
    if (jobTab) jobTab.textContent = jobs;
    if (internTab) internTab.textContent = interns;
  }

  function unique(arr) { return [...new Set(arr.filter(Boolean))].sort(); }

  function fillSelect(sel, values, label) {
    sel.innerHTML = `<option value="">${label}: All</option>` +
      values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  }

  /* ---------------- Filtering / sorting / rendering ---------------- */

  function getFiltered() {
    let rows = RAW.filter(r => (r.status || '').toLowerCase() === 'active');

    if (CURRENT_TAB !== 'all') {
      rows = rows.filter(r => r.type.toLowerCase() === CURRENT_TAB);
    }
    if (filters.department) rows = rows.filter(r => r.department === filters.department);
    if (filters.mode) rows = rows.filter(r => r.mode === filters.mode);
    if (filters.location) rows = rows.filter(r => r.location === filters.location);

    if (searchTerm) {
      rows = rows.filter(r =>
        r.title.toLowerCase().includes(searchTerm) ||
        r.skills.toLowerCase().includes(searchTerm) ||
        r.department.toLowerCase().includes(searchTerm)
      );
    }

    rows = rows.slice().sort((a, b) => {
      if (sortMode === 'deadline') {
        return new Date(a.deadline || '2999-01-01') - new Date(b.deadline || '2999-01-01');
      }
      // newest first by postedDate, falling back to title
      return new Date(b.postedDate || 0) - new Date(a.postedDate || 0);
    });

    return rows;
  }

  function render() {
    if (!RAW.length) return;
    const filtered = getFiltered();

    els.resultsMeta.style.display = 'flex';
    els.resultsCount.innerHTML = `<strong>${filtered.length}</strong> opportunit${filtered.length === 1 ? 'y' : 'ies'} found`;

    if (!filtered.length) {
      els.grid.innerHTML = '';
      els.pagination.innerHTML = '';
      setState('empty-filtered');
      return;
    }
    setState('ready');

    const pageSize = CFG.PAGE_SIZE || 6;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    CURRENT_PAGE = Math.min(CURRENT_PAGE, totalPages);
    const start = (CURRENT_PAGE - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    els.grid.innerHTML = pageItems.map(cardHtml).join('');
    els.grid.querySelectorAll('.opp-card').forEach(card => {
      card.addEventListener('click', () => openModal(card.dataset.id));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(card.dataset.id); }
      });
    });

    renderPagination(totalPages);
  }

  function isNew(r) {
    if (!r.postedDate) return false;
    const days = (Date.now() - new Date(r.postedDate).getTime()) / 86400000;
    return days >= 0 && days <= (CFG.NEW_BADGE_DAYS || 7);
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const diff = (new Date(dateStr).getTime() - Date.now()) / 86400000;
    return Math.ceil(diff);
  }

  function cardHtml(r) {
    const skills = (r.skills || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 4);
    const dLeft = daysUntil(r.deadline);
    const urgent = dLeft !== null && dLeft <= 5;
    return `
      <article class="opp-card reveal in-view" tabindex="0" role="button" aria-label="View details for ${escapeHtml(r.title)}" data-id="${escapeHtml(r.id)}">
        <div class="opp-top">
          <span class="opp-type-badge ${r.type.toLowerCase() === 'internship' ? 'internship' : 'job'}">${escapeHtml(r.type)}</span>
          ${isNew(r) ? '<span class="badge-new">New</span>' : ''}
        </div>
        <div>
          <h3 class="opp-title">${escapeHtml(r.title)}</h3>
          <div class="opp-dept">${escapeHtml(r.department)}</div>
        </div>
        <div class="opp-meta-row">
          <span class="meta-chip">${iconPin()} ${escapeHtml(r.location)}</span>
          <span class="meta-chip">${iconMode()} ${escapeHtml(r.mode)}</span>
          <span class="meta-chip">${iconClock()} ${escapeHtml(r.duration)}</span>
        </div>
        <p class="opp-desc">${escapeHtml(truncate(r.description, 110))}</p>
        <div class="opp-skills">${skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}</div>
        <div class="opp-bottom">
          <span class="deadline-tag ${urgent ? 'urgent' : ''}">Apply by <strong>${formatDate(r.deadline)}</strong></span>
          <span class="btn btn-ghost btn-sm">View details</span>
        </div>
      </article>`;
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) { els.pagination.innerHTML = ''; return; }
    let html = `<button class="page-btn" data-page="${CURRENT_PAGE - 1}" ${CURRENT_PAGE === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>`;
    for (let p = 1; p <= totalPages; p++) {
      html += `<button class="page-btn ${p === CURRENT_PAGE ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
    html += `<button class="page-btn" data-page="${CURRENT_PAGE + 1}" ${CURRENT_PAGE === totalPages ? 'disabled' : ''} aria-label="Next page">›</button>`;
    els.pagination.innerHTML = html;
    els.pagination.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = Number(btn.dataset.page);
        if (!p || btn.disabled) return;
        CURRENT_PAGE = p;
        render();
        document.getElementById('control-bar').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ---------------- States ---------------- */

  function setState(state) {
    els.skeleton.style.display = state === 'loading' ? 'grid' : 'none';
    els.grid.style.display = state === 'ready' ? 'grid' : 'none';
    els.stateBlock.style.display = 'none';
    els.pagination.style.display = state === 'ready' ? 'flex' : 'none';
    els.resultsMeta.style.display = state === 'ready' ? 'flex' : 'none';

    if (state === 'error') {
      els.stateBlock.style.display = 'block';
      els.stateBlock.className = 'state-block error';
      els.stateBlock.innerHTML = stateMarkup(
        iconAlert(),
        "We're unable to load current opportunities",
        'Please check your connection and try again in a moment.',
        true
      );
      bindRetry();
    } else if (state === 'empty') {
      els.stateBlock.style.display = 'block';
      els.stateBlock.className = 'state-block';
      els.stateBlock.innerHTML = stateMarkup(
        iconInbox(),
        'No opportunities are currently available',
        'Please check back soon — new roles and internships are posted regularly.',
        false
      );
    } else if (state === 'empty-filtered') {
      els.stateBlock.style.display = 'block';
      els.stateBlock.className = 'state-block';
      els.stateBlock.innerHTML = stateMarkup(
        iconSearch(),
        'No matching opportunities',
        'Try a different search term or clear your filters.',
        false,
        true
      );
      const clearBtn = els.stateBlock.querySelector('[data-clear]');
      if (clearBtn) clearBtn.addEventListener('click', () => els.clearBtn.click());
    }
  }

  function bindRetry() {
    const btn = els.stateBlock.querySelector('[data-retry]');
    if (btn) btn.addEventListener('click', loadData);
  }

  function stateMarkup(icon, title, desc, retry, clear) {
    return `
      <div class="state-icon">${icon}</div>
      <h3>${title}</h3>
      <p>${desc}</p>
      ${retry ? '<button class="btn btn-primary" data-retry>Try again</button>' : ''}
      ${clear ? '<button class="btn btn-ghost" data-clear>Clear filters</button>' : ''}
    `;
  }

  /* ---------------- Modal ---------------- */

  function openModal(id) {
    const r = RAW.find(x => x.id === id);
    if (!r) return;
    const skills = (r.skills || '').split(',').map(s => s.trim()).filter(Boolean);
    els.modalBody.innerHTML = `
      <div class="modal-head">
        <span class="opp-type-badge ${r.type.toLowerCase() === 'internship' ? 'internship' : 'job'}">${escapeHtml(r.type)}</span>
        <h2 style="margin-top:14px;">${escapeHtml(r.title)}</h2>
        <div class="opp-dept">${escapeHtml(r.department)}</div>
      </div>
      <div class="modal-meta-grid">
        <div><span>Location</span><strong>${escapeHtml(r.location)}</strong></div>
        <div><span>Work mode</span><strong>${escapeHtml(r.mode)}</strong></div>
        <div><span>Experience</span><strong>${escapeHtml(r.experience)}</strong></div>
        <div><span>Duration</span><strong>${escapeHtml(r.duration)}</strong></div>
        <div><span>Apply by</span><strong>${formatDate(r.deadline)}</strong></div>
        <div><span>Status</span><strong>${escapeHtml(r.status)}</strong></div>
      </div>
      <div class="modal-section">
        <h4>About this role</h4>
        <p style="margin:0;">${escapeHtml(r.description || 'No description provided.')}</p>
      </div>
      ${skills.length ? `
      <div class="modal-section">
        <h4>Skills required</h4>
        <div class="opp-skills">${skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}</div>
      </div>` : ''}
      <div class="modal-actions">
        <a class="btn btn-accent btn-block" href="${escapeAttr(r.applyLink)}" target="_blank" rel="noopener noreferrer">Apply now</a>
        <button class="btn btn-ghost" data-bookmark="${escapeAttr(r.id)}">${isBookmarked(r.id) ? '★ Saved' : '☆ Save'}</button>
      </div>
      <div class="share-row">
        <button class="icon-btn" data-copy title="Copy link">${iconLink()}</button>
        <a class="icon-btn" href="mailto:?subject=${encodeURIComponent(r.title + ' at VaultofCodes')}&body=${encodeURIComponent('Check this out: ' + r.applyLink)}" title="Share by email">${iconMail()}</a>
      </div>
    `;
    els.modalOverlay.classList.add('open');
    els.modalOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const bookmarkBtn = els.modalBody.querySelector('[data-bookmark]');
    bookmarkBtn.addEventListener('click', () => {
      toggleBookmark(r.id);
      bookmarkBtn.textContent = isBookmarked(r.id) ? '★ Saved' : '☆ Save';
      showToast(isBookmarked(r.id) ? 'Opportunity saved' : 'Removed from saved');
    });
    const copyBtn = els.modalBody.querySelector('[data-copy]');
    copyBtn.addEventListener('click', () => {
      const url = window.location.href.split('#')[0] + '#' + r.id;
      navigator.clipboard?.writeText(url).then(() => showToast('Link copied to clipboard'));
    });
  }

  function closeModal() {
    els.modalOverlay.classList.remove('open');
    els.modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  window.closeCareerModal = closeModal;

  function isBookmarked(id) {
    try { return JSON.parse(localStorage.getItem('voc_bookmarks') || '[]').includes(id); }
    catch { return false; }
  }
  function toggleBookmark(id) {
    try {
      const list = JSON.parse(localStorage.getItem('voc_bookmarks') || '[]');
      const idx = list.indexOf(id);
      if (idx > -1) list.splice(idx, 1); else list.push(id);
      localStorage.setItem('voc_bookmarks', JSON.stringify(list));
    } catch { /* storage unavailable — ignore */ }
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  /* ---------------- Helpers ---------------- */

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }
  function truncate(s, n) { return (s || '').length > n ? s.slice(0, n).trim() + '…' : (s || ''); }
  function formatDate(d) {
    if (!d) return 'Rolling';
    const date = new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  /* Inline icon helpers (no external icon font needed) */
  function iconPin() { return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z"/><circle cx="12" cy="9" r="2.5"/></svg>'; }
  function iconMode() { return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 20h8M12 16v4"/></svg>'; }
  function iconClock() { return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>'; }
  function iconAlert() { return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>'; }
  function iconInbox() { return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>'; }
  function iconSearch() { return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'; }
  function iconLink() { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/></svg>'; }
  function iconMail() { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>'; }
})();
