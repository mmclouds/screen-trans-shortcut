// ===== SVG 图标 =====
const Icons = {
  arrowLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  book: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
  edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
  plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  x: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
};

const API_BASE = '/api';
let WORKER_API_KEY = '';

async function init() {
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    WORKER_API_KEY = cfg.apiKey;
  } catch (e) {
    console.warn('无法获取 API Key，写操作不可用');
  }
}

function router() {
  const app = document.getElementById('app');
  const hash = location.hash.slice(1) || '/today';
  setActiveNav(hash);

  if (hash === '/' || hash.startsWith('/today')) {
    renderToday(app, getHashParam('date') || getShanghaiDate());
  } else if (hash.startsWith('/words')) {
    renderWords(app);
  } else if (hash.startsWith('/history')) {
    renderHistory(app);
  } else if (hash.startsWith('/translation/')) {
    const id = hash.split('/translation/')[1].split('?')[0];
    renderDetail(app, id);
  } else {
    location.hash = '#/today';
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('load', () => { init().then(router); });

function setActiveNav(hash) {
  document.querySelectorAll('.top-nav a').forEach(a => a.classList.remove('active'));
  const key = hash.startsWith('/words') ? 'words' : hash.startsWith('/history') || hash.startsWith('/translation') ? 'history' : 'today';
  const link = document.querySelector(`.top-nav a[data-nav="${key}"]`);
  if (link) link.classList.add('active');
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2500);
}

async function api(path, opts = {}) {
  const url = API_BASE + path;
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (WORKER_API_KEY) headers.Authorization = `Bearer ${WORKER_API_KEY}`;
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.remove('hidden');
}
document.getElementById('lightbox').addEventListener('click', function () {
  this.classList.add('hidden');
});

function openModal(title, fields, onSubmit) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3>${title}</h3>
      <form id="modal-form">
        ${fields.map(f => `
          <div class="form-group">
            <label>${f.label}</label>
            ${f.type === 'textarea'
              ? `<textarea class="input" name="${f.name}" ${f.required === false ? '' : 'required'}>${escHtmlAttr(f.value || '')}</textarea>`
              : `<input class="input" type="${f.type || 'text'}" name="${f.name}" value="${escHtmlAttr(f.value || '')}" ${f.required === false ? '' : 'required'}>`}
          </div>
        `).join('')}
        <div class="modal-actions">
          <button type="submit" class="btn btn-primary">Save</button>
          <button type="button" class="btn btn-ghost close-modal">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.close-modal').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('form').addEventListener('submit', async function (e) {
    e.preventDefault();
    await onSubmit(Object.fromEntries(new FormData(this)));
    overlay.remove();
  });
}

async function renderToday(app, date) {
  app.innerHTML = loading();
  try {
    const [summary, translations, dayWords] = await Promise.all([
      api(`/days/${date}/summary`),
      api(`/days/${date}/translations`),
      api(`/days/${date}/words`),
    ]);

    app.innerHTML = `
      <section class="today-header">
        <div>
          <h1 class="page-title">Today</h1>
          <div class="date-switcher">
            <a class="btn btn-ghost btn-sm" href="#/today?date=${shiftDate(date, -1)}">Previous</a>
            <input class="input date-input" type="date" value="${escAttr(date)}">
            <a class="btn btn-ghost btn-sm" href="#/today?date=${shiftDate(date, 1)}">Next</a>
          </div>
        </div>
        <div class="summary-grid">
          <div><strong>${summary.translations}</strong><span>Translations</span></div>
          <div><strong>${summary.vocabulary.pending}</strong><span>Pending words</span></div>
          <div><strong>${summary.vocabulary.accepted}</strong><span>Accepted words</span></div>
          <div><strong>${summary.vocabulary.filtered}</strong><span>Filtered</span></div>
        </div>
      </section>

      <div class="tabs">
        <button class="tab-btn active" data-tab="translations">By translation</button>
        <button class="tab-btn" data-tab="words">By word</button>
      </div>

      <div class="tab-panel active" id="panel-translations">
        ${translations.length ? translations.map(todayTranslationCard).join('') : empty('No translations for this day')}
      </div>
      <div class="tab-panel" id="panel-words">
        ${dayWords.length ? `<div class="day-word-list">${dayWords.map(dayWordCard).join('')}</div>` : empty('No word candidates for this day')}
      </div>
    `;

    app.querySelector('.date-input').addEventListener('change', function () {
      location.hash = `#/today?date=${this.value}`;
    });
    bindTabs(app);
    bindReviewActions(app, () => renderToday(app, date));
  } catch (err) {
    app.innerHTML = errorState(err);
  }
}

function todayTranslationCard(t) {
  const pending = [...t.candidates, ...t.grammar].filter(x => x.status === 'pending').length;
  const filtered = t.candidates.filter(x => x.status === 'filtered');
  const visibleCandidates = t.candidates.filter(x => x.status !== 'filtered');
  return `
    <article class="review-card">
      <div class="review-main">
        <a href="#/translation/${t.id}" class="review-thumb">
          <img src="${escAttr(t.translated_image_url)}" alt="Translated screenshot" loading="lazy">
        </a>
        <div class="review-copy">
          <div class="review-meta">${formatDate(t.created_at)} · ${pending ? `${pending} pending` : 'Processed'}</div>
          <p>${escHtml(t.source_text || '(no text detected)')}</p>
          <small>${escHtml(t.translated_text || '')}</small>
        </div>
      </div>

      <div class="review-section">
        <h3>Vocabulary</h3>
        ${visibleCandidates.length ? visibleCandidates.map(candidateCard).join('') : '<p class="muted">No visible word candidates.</p>'}
        ${filtered.length ? `<details class="filtered-block"><summary>Filtered mastered words (${filtered.length})</summary>${filtered.map(candidateCard).join('')}</details>` : ''}
      </div>

      <div class="review-section">
        <h3>Grammar</h3>
        ${t.grammar.length ? t.grammar.map(grammarReviewCard).join('') : '<p class="muted">No grammar candidates.</p>'}
      </div>
    </article>
  `;
}

function candidateCard(v) {
  return `
    <div class="candidate-card status-${escAttr(v.status)}">
      <div>
        <strong>${escHtml(v.word)}</strong>
        <span class="pill">${escHtml(v.status)}</span>
        ${v.part_of_speech ? `<span class="muted">${escHtml(v.part_of_speech)}</span>` : ''}
        <p>${escHtml(v.meaning)}</p>
        ${v.context ? `<small>${escHtml(v.context)}</small>` : ''}
      </div>
      <div class="candidate-actions">
        ${v.status === 'pending' || v.status === 'filtered' ? `
          <button class="btn btn-primary btn-sm accept-candidate" data-id="${v.id}" data-familiarity="unknown">Unknown</button>
          <button class="btn btn-ghost btn-sm accept-candidate" data-id="${v.id}" data-familiarity="learning">Learning</button>
          <button class="btn btn-ghost btn-sm accept-candidate" data-id="${v.id}" data-familiarity="mastered">Mastered</button>
          <button class="btn btn-ghost btn-sm edit-candidate" data-id="${v.id}" data-word="${escAttr(v.word)}" data-meaning="${escAttr(v.meaning)}" data-pos="${escAttr(v.part_of_speech || '')}" data-context="${escAttr(v.context || '')}">${Icons.edit}</button>
          <button class="btn btn-danger btn-sm reject-candidate" data-id="${v.id}">Reject</button>
        ` : ''}
      </div>
    </div>
  `;
}

function grammarReviewCard(g) {
  return `
    <div class="candidate-card status-${escAttr(g.status || 'accepted')}">
      <div>
        <strong>${escHtml(g.pattern)}</strong>
        <span class="pill">${escHtml(g.status || 'accepted')}</span>
        <p>${escHtml(g.explanation)}</p>
        ${g.example ? `<small>${escHtml(g.example)}</small>` : ''}
      </div>
      ${g.status === 'pending' ? `
        <div class="candidate-actions">
          <button class="btn btn-primary btn-sm accept-grammar" data-id="${g.id}">Accept</button>
          <button class="btn btn-danger btn-sm reject-grammar" data-id="${g.id}">Reject</button>
        </div>
      ` : ''}
    </div>
  `;
}

function dayWordCard(w) {
  return `
    <div class="item-card">
      <div class="item-title">${escHtml(w.word)} <span class="pill">${escHtml(w.status)}</span></div>
      <div class="item-subtitle">${escHtml(w.meaning)}</div>
      <div class="item-meta">${escHtml(w.part_of_speech || '-')} · ${w.occurrence_count} occurrence${w.occurrence_count > 1 ? 's' : ''}</div>
    </div>
  `;
}

function bindReviewActions(root, refresh) {
  root.querySelectorAll('.accept-candidate').forEach(btn => {
    btn.addEventListener('click', async function () {
      await api(`/translation-vocabulary/${this.dataset.id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ familiarity: this.dataset.familiarity }),
      });
      showToast('Word accepted');
      refresh();
    });
  });
  root.querySelectorAll('.reject-candidate').forEach(btn => {
    btn.addEventListener('click', async function () {
      await api(`/translation-vocabulary/${this.dataset.id}/reject`, { method: 'POST' });
      showToast('Word rejected');
      refresh();
    });
  });
  root.querySelectorAll('.edit-candidate').forEach(btn => {
    btn.addEventListener('click', function () {
      editCandidate(this.dataset, refresh);
    });
  });
  root.querySelectorAll('.accept-grammar').forEach(btn => {
    btn.addEventListener('click', async function () {
      await api(`/grammar-notes/${this.dataset.id}/accept`, { method: 'POST' });
      showToast('Grammar accepted');
      refresh();
    });
  });
  root.querySelectorAll('.reject-grammar').forEach(btn => {
    btn.addEventListener('click', async function () {
      await api(`/grammar-notes/${this.dataset.id}/reject`, { method: 'POST' });
      showToast('Grammar rejected');
      refresh();
    });
  });
}

function editCandidate(data, refresh) {
  openModal('Edit Word Candidate', [
    { name: 'word', label: 'Word', value: data.word },
    { name: 'meaning', label: 'Meaning', value: data.meaning },
    { name: 'part_of_speech', label: 'Part of speech', value: data.pos, required: false },
    { name: 'context', label: 'Context', value: data.context, required: false },
  ], async (formData) => {
    await api(`/translation-vocabulary/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify(formData),
    });
    showToast('Candidate updated');
    refresh();
  });
}

async function renderWords(app) {
  app.innerHTML = loading();
  try {
    const params = getHashParams();
    const q = params.get('q') || '';
    const familiarity = params.get('familiarity') || '';
    const sort = params.get('sort') || 'last_seen';
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (familiarity) query.set('familiarity', familiarity);
    if (sort) query.set('sort', sort);
    const words = await api(`/words?${query.toString()}`);

    app.innerHTML = `
      <h1 class="page-title">Words</h1>
      <form class="filters words-filters">
        <input class="input" name="q" placeholder="Search word or meaning" value="${escHtmlAttr(q)}">
        <select class="input" name="familiarity">
          <option value="">All</option>
          <option value="unknown" ${familiarity === 'unknown' ? 'selected' : ''}>Unknown</option>
          <option value="learning" ${familiarity === 'learning' ? 'selected' : ''}>Learning</option>
          <option value="mastered" ${familiarity === 'mastered' ? 'selected' : ''}>Mastered</option>
        </select>
        <select class="input" name="sort">
          <option value="last_seen" ${sort === 'last_seen' ? 'selected' : ''}>Last seen</option>
          <option value="first_seen" ${sort === 'first_seen' ? 'selected' : ''}>First seen</option>
          <option value="occurrence" ${sort === 'occurrence' ? 'selected' : ''}>Occurrences</option>
        </select>
        <button class="btn btn-primary" type="submit">Apply</button>
      </form>
      <div class="word-list">
        ${words.length ? words.map(wordCard).join('') : empty('No words yet')}
      </div>
    `;

    app.querySelector('.words-filters').addEventListener('submit', function (e) {
      e.preventDefault();
      const data = new FormData(this);
      const next = new URLSearchParams();
      for (const [key, value] of data.entries()) {
        if (value) next.set(key, value);
      }
      location.hash = `#/words?${next.toString()}`;
    });

    app.querySelectorAll('.word-familiarity').forEach(select => {
      select.addEventListener('change', async function () {
        await api(`/words/${this.dataset.id}`, {
          method: 'PUT',
          body: JSON.stringify({ familiarity: this.value }),
        });
        showToast('Word updated');
      });
    });
  } catch (err) {
    app.innerHTML = errorState(err);
  }
}

function wordCard(w) {
  return `
    <article class="item-card word-card">
      <div>
        <div class="item-title">${escHtml(w.word)}</div>
        <div class="item-subtitle">${escHtml(w.meaning)}</div>
        <div class="item-meta">${escHtml(w.part_of_speech || '-')} · ${w.occurrence_count} occurrences · last seen ${formatDate(w.last_seen_at)}</div>
      </div>
      <select class="input word-familiarity" data-id="${w.id}">
        <option value="unknown" ${w.familiarity === 'unknown' ? 'selected' : ''}>Unknown</option>
        <option value="learning" ${w.familiarity === 'learning' ? 'selected' : ''}>Learning</option>
        <option value="mastered" ${w.familiarity === 'mastered' ? 'selected' : ''}>Mastered</option>
      </select>
    </article>
  `;
}

async function renderHistory(app) {
  app.innerHTML = loading();
  try {
    const page = parseInt(getHashParam('page') || '1', 10);
    const result = await api(`/translations?page=${page}&limit=20`);

    if (!result.data.length) {
      app.innerHTML = empty('No translations yet', 'Send a translation from your device to get started.');
      return;
    }

    app.innerHTML = `
      <h1 class="page-title">History</h1>
      <div class="translation-list">
        ${result.data.map(t => `
          <a href="#/translation/${t.id}" class="translation-card">
            <img src="${escAttr(t.translated_image_url)}" alt="Translated screenshot" loading="lazy">
            <div class="card-body">
              <div class="source-text">${escHtml(t.source_text || '(no text detected)')}</div>
              <div class="meta">
                <span>${escHtml(t.source_language)} → ${escHtml(t.target_language)}</span>
                <span>${formatDate(t.created_at)}</span>
              </div>
            </div>
          </a>
        `).join('')}
      </div>
      ${renderPagination(result.pagination)}
    `;
  } catch (err) {
    app.innerHTML = errorState(err);
  }
}

function renderPagination(p) {
  if (p.totalPages <= 1) return '';
  const items = [];
  for (let i = 1; i <= p.totalPages; i++) {
    items.push(`<li><a href="#/history?page=${i}" class="${i === p.page ? 'primary' : ''}">${i}</a></li>`);
  }
  return `<nav class="pagination"><ul>${items.join('')}</ul></nav>`;
}

async function renderDetail(app, id) {
  app.innerHTML = loading();
  try {
    const t = await api(`/translations/${id}`);
    const candidates = t.candidates && t.candidates.length ? t.candidates : (t.vocabulary || []).map(v => ({
      ...v,
      status: 'accepted',
      normalized_word: v.word,
    }));

    app.innerHTML = `
      <a href="#/history" class="back-link">${Icons.arrowLeft} Back</a>

      <div class="compare-grid">
        <figure>
          <img src="${escAttr(t.original_image_url)}" alt="Original screenshot" loading="lazy" onclick="openLightbox('${escAttr(t.original_image_url)}')">
          <figcaption>Original</figcaption>
        </figure>
        <figure>
          <img src="${escAttr(t.translated_image_url)}" alt="Translated screenshot" loading="lazy" onclick="openLightbox('${escAttr(t.translated_image_url)}')">
          <figcaption>Translated</figcaption>
        </figure>
      </div>

      ${t.source_text || t.translated_text ? `
        <div class="text-compare">
          <div class="text-block">
            <h4>Source Text (${escHtml(t.source_language)})</h4>
            <p>${escHtml(t.source_text || '-')}</p>
          </div>
          <div class="text-block">
            <h4>Translation (${escHtml(t.target_language)})</h4>
            <p>${escHtml(t.translated_text || '-')}</p>
          </div>
        </div>
      ` : ''}

      <div class="detail-meta">Translated at ${formatDate(t.created_at)}</div>

      <div class="tabs">
        <button class="tab-btn active" data-tab="vocab">Vocabulary (${candidates.length})</button>
        <button class="tab-btn" data-tab="grammar">Grammar (${t.grammar.length})</button>
      </div>

      <div class="tab-panel active" id="panel-vocab">
        ${candidates.length ? candidates.map(candidateCard).join('') : empty('No vocabulary')}
      </div>
      <div class="tab-panel" id="panel-grammar">
        ${t.grammar.length ? t.grammar.map(grammarReviewCard).join('') : empty('No grammar')}
      </div>
    `;

    bindTabs(app);
    bindReviewActions(app, () => renderDetail(app, id));
  } catch (err) {
    app.innerHTML = errorState(err);
  }
}

function bindTabs(root) {
  root.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      root.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      root.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      document.getElementById(`panel-${this.dataset.tab}`).classList.add('active');
    });
  });
}

function loading() {
  return '<div class="loading-state"><div class="spinner"></div><span>Loading...</span></div>';
}

function empty(title, subtitle = '') {
  return `
    <div class="empty-state">
      <span class="empty-icon">${Icons.book}</span>
      <p>${escHtml(title)}</p>
      ${subtitle ? `<small>${escHtml(subtitle)}</small>` : ''}
    </div>`;
}

function errorState(err) {
  return `<div class="empty-state"><p>Error: ${escHtml(err.message)}</p></div>`;
}

function getHashParams() {
  const query = (location.hash.split('?')[1] || '');
  return new URLSearchParams(query);
}

function getHashParam(name) {
  return getHashParams().get(name);
}

function getShanghaiDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftDate(date, days) {
  const d = new Date(`${date}T00:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

function escHtmlAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(s) {
  if (!s) return '-';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
