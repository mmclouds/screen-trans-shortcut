// ===== SVG 图标 =====
const Icons = {
  arrowLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  book: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
  edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
  plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  volume: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M19 5a9 9 0 010 14"/></svg>',
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
    let currentSummary = summary;
    let currentTranslations = translations;
    const selectedWordsByTranslation = new Map();

    app.innerHTML = `
      <section class="today-toolbar" aria-label="Daily review controls">
        <div class="date-switcher">
          <a class="btn btn-ghost btn-sm date-step" href="#/today?date=${shiftDate(date, -1)}" aria-label="Previous day">&lt;</a>
          <input class="input date-input" type="date" value="${escAttr(date)}" aria-label="Selected date">
          <a class="btn btn-ghost btn-sm date-step" href="#/today?date=${shiftDate(date, 1)}" aria-label="Next day">&gt;</a>
        </div>
        <div class="compact-summary" aria-label="Daily summary">
          <span><strong>${summary.translations}</strong> 翻译</span>
          <span><strong>${summary.vocabulary.pending}</strong> 待处理</span>
          <span><strong>${summary.vocabulary.accepted}</strong> 已收录</span>
          <span><strong>${summary.vocabulary.filtered}</strong> 已过滤</span>
        </div>
      </section>

      <div class="tabs">
        <button class="tab-btn active" data-tab="translations">By translation</button>
        <button class="tab-btn" data-tab="words">By word</button>
      </div>

      <div class="tab-panel active" id="panel-translations"></div>
      <div class="tab-panel" id="panel-words">
        ${dayWords.length ? `<div class="day-word-list">${dayWords.map(dayWordCard).join('')}</div>` : empty('No word candidates for this day')}
      </div>
    `;

    const refreshReviewPanels = () => {
      renderCompactSummary(app, currentSummary);
      renderTodayTranslationPanel(app, currentTranslations, selectedWordsByTranslation);
      bindReviewActions(app.querySelector('#panel-translations'), {
        onCandidateStatus: (id, status) => {
          const previousStatus = findReviewItemStatus(currentTranslations, 'candidate', id);
          currentTranslations = ReviewState.applyReviewStatus(currentTranslations, 'candidate', id, status);
          updateSummaryCount(currentSummary.vocabulary, previousStatus, status);
          refreshReviewPanels();
        },
        onGrammarStatus: (id, status) => {
          const previousStatus = findReviewItemStatus(currentTranslations, 'grammar', id);
          currentTranslations = ReviewState.applyReviewStatus(currentTranslations, 'grammar', id, status);
          updateSummaryCount(currentSummary.grammar, previousStatus, status);
          refreshReviewPanels();
        },
        onCandidateUpdate: (id, patch) => {
          currentTranslations = updateLocalCandidate(currentTranslations, id, patch);
          refreshReviewPanels();
        },
      });
      bindWordPickerActions(app.querySelector('#panel-translations'), {
        selectionsByTranslation: selectedWordsByTranslation,
        onExtract: async (translationId, words) => {
          const candidates = await api(`/translations/${translationId}/vocabulary/extract-selected`, {
            method: 'POST',
            body: JSON.stringify({ words }),
          });
          selectedWordsByTranslation.set(String(translationId), new Set());
          currentTranslations = currentTranslations.map((translation) => (
            String(translation.id) === String(translationId)
              ? { ...translation, candidates: mergeCandidates(translation.candidates || [], candidates) }
              : translation
          ));
          showToast(candidates.length ? 'Word candidates extracted' : 'No new candidates found');
          refreshReviewPanels();
        },
      });
      bindSpeakButtons(app);
      hydrateMissingPhonetics(app);
    };

    app.querySelector('.date-input').addEventListener('change', function () {
      location.hash = `#/today?date=${this.value}`;
    });
    bindTabs(app);
    bindSourceImages(app);
    refreshReviewPanels();
  } catch (err) {
    app.innerHTML = errorState(err);
  }
}

function findReviewItemStatus(translations, kind, id) {
  const key = kind === 'grammar' ? 'grammar' : 'candidates';
  for (const translation of translations || []) {
    const item = (translation[key] || []).find((entry) => Number(entry.id) === Number(id));
    if (item) return item.status;
  }
  return null;
}

function updateSummaryCount(bucket, previousStatus, nextStatus) {
  if (!bucket || previousStatus === nextStatus) return;
  if (previousStatus && bucket[previousStatus] > 0) bucket[previousStatus] -= 1;
  if (nextStatus && bucket[nextStatus] !== undefined) bucket[nextStatus] += 1;
}

function updateLocalCandidate(translations, id, patch) {
  return (translations || []).map((translation) => ({
    ...translation,
    candidates: (translation.candidates || []).map((candidate) => (
      Number(candidate.id) === Number(id) ? { ...candidate, ...patch } : candidate
    )),
  }));
}

function renderCompactSummary(root, summary) {
  const el = root.querySelector('.compact-summary');
  if (!el) return;
  el.innerHTML = `
    <span><strong>${summary.translations}</strong> 翻译</span>
    <span><strong>${summary.vocabulary.pending}</strong> 待处理</span>
    <span><strong>${summary.vocabulary.accepted}</strong> 已收录</span>
    <span><strong>${summary.vocabulary.filtered}</strong> 已过滤</span>
  `;
}

function renderTodayTranslationPanel(root, translations, selectionsByTranslation = new Map()) {
  const panel = root.querySelector('#panel-translations');
  if (!panel) return;
  panel.innerHTML = translations.length
    ? translations.map((translation) => todayTranslationCard(
      translation,
      selectionsByTranslation.get(String(translation.id)) || new Set()
    )).join('')
    : empty('No translations for this day');
}

function todayTranslationCard(t, selectedWords = new Set()) {
  const pending = ReviewState.countPending(t);
  const vocabulary = ReviewState.partitionCandidates(t.candidates);
  const grammar = ReviewState.partitionCandidates(t.grammar);
  return `
    <article class="review-card">
      <div class="review-main">
        <a href="#/translation/${t.id}" class="review-thumb">
          <img src="${escAttr(t.translated_image_url)}" alt="Translated screenshot" loading="lazy">
        </a>
        <div class="review-copy">
          <div class="review-meta">${formatDate(t.created_at)} · ${pending ? `${pending} pending` : 'Processed'}</div>
          <p>${escHtml(displaySourceText(t) || '(no text detected)')}</p>
          <small>${escHtml(t.translated_text || '')}</small>
        </div>
      </div>

      <div class="review-section">
        <h3>Vocabulary</h3>
        ${renderWordPicker(t, selectedWords)}
        ${vocabulary.active.length ? vocabulary.active.map(candidateCard).join('') : '<p class="muted">No visible word candidates.</p>'}
        ${vocabulary.rejected.length ? `<details class="filtered-block"><summary>已拒绝 (${vocabulary.rejected.length})</summary>${vocabulary.rejected.map(candidateCard).join('')}</details>` : ''}
        ${vocabulary.filtered.length ? `<details class="filtered-block"><summary>Filtered mastered words (${vocabulary.filtered.length})</summary>${vocabulary.filtered.map(candidateCard).join('')}</details>` : ''}
      </div>

      <div class="review-section">
        <h3>Grammar</h3>
        ${grammar.active.length ? grammar.active.map(grammarReviewCard).join('') : '<p class="muted">No grammar candidates.</p>'}
        ${grammar.rejected.length ? `<details class="filtered-block"><summary>已拒绝 (${grammar.rejected.length})</summary>${grammar.rejected.map(grammarReviewCard).join('')}</details>` : ''}
      </div>
    </article>
  `;
}

function candidateCard(v) {
  return `
    <div class="candidate-card status-${escAttr(v.status)}">
      <div>
        <strong>${escHtml(v.word)}</strong>
        <button class="btn btn-ghost btn-sm speak-word" type="button" data-speak="${escAttr(v.word)}" aria-label="Play pronunciation">${Icons.volume}</button>
        <span class="pill">${escHtml(v.status)}</span>
        ${phoneticSpan(v.word, v.phonetic)}
        ${v.part_of_speech ? `<span class="muted">${escHtml(v.part_of_speech)}</span>` : ''}
        <p>${escHtml(v.meaning)}</p>
        ${v.context ? `<small>${escHtml(v.context)}</small>` : ''}
      </div>
      <div class="candidate-actions">
        ${v.status === 'pending' || v.status === 'rejected' || v.status === 'filtered' ? `
          <button class="btn btn-primary btn-sm accept-candidate" data-id="${v.id}">接受</button>
          <button class="btn btn-ghost btn-sm edit-candidate" data-id="${v.id}" data-word="${escAttr(v.word)}" data-meaning="${escAttr(v.meaning)}" data-pos="${escAttr(v.part_of_speech || '')}" data-context="${escAttr(v.context || '')}">${Icons.edit}</button>
          ${v.status === 'pending' || v.status === 'filtered' ? `<button class="btn btn-danger btn-sm reject-candidate" data-id="${v.id}">拒绝</button>` : ''}
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
      ${g.status === 'pending' || g.status === 'rejected' ? `
        <div class="candidate-actions">
          <button class="btn btn-primary btn-sm accept-grammar" data-id="${g.id}">接受</button>
          ${g.status === 'pending' ? `<button class="btn btn-danger btn-sm reject-grammar" data-id="${g.id}">拒绝</button>` : ''}
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
      <div class="item-meta">
        ${phoneticSpan(w.word, w.phonetic)}
        ${escHtml(w.part_of_speech || '-')} · ${w.occurrence_count} occurrence${w.occurrence_count > 1 ? 's' : ''}
        <button class="btn btn-ghost btn-sm speak-word" type="button" data-speak="${escAttr(w.word)}" aria-label="Play pronunciation">${Icons.volume}</button>
      </div>
      ${w.occurrences?.length ? `
        <div class="word-occurrences">
          ${w.occurrences.map(wordOccurrence).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function wordOccurrence(item) {
  const sentence = item.context || item.source_text || '';
  return `
    <div class="word-occurrence">
      <p>${escHtml(sentence || '(no source sentence)')}</p>
      ${item.translated_text ? `<small>${escHtml(item.translated_text)}</small>` : ''}
      <button class="btn btn-ghost btn-sm source-image" type="button" data-src="${escAttr(item.original_image_url)}">来源</button>
    </div>
  `;
}

function renderWordPicker(translation, selectedWords = new Set()) {
  const sourceText = displaySourceText(translation);
  if (!sourceText) return '';

  const tokens = ReviewState.tokenizeSourceText(sourceText);
  const existingWords = ReviewState.collectExistingNormalizedWords(translation.candidates || []);
  const source = tokens.map((token, index) => {
    if (token.type !== 'word') {
      return `<span class="source-token-text">${escHtml(token.value)}</span>`;
    }

    const exists = existingWords.has(token.key);
    const selected = selectedWords.has(token.key);
    const classes = ['source-token'];
    if (exists) classes.push('existing');
    if (selected) classes.push('selected');
    return `<button class="${classes.join(' ')}" type="button" data-word="${escAttr(token.value)}" data-key="${escAttr(token.key)}" ${exists ? 'disabled' : ''}>${escHtml(token.value)}</button>`;
  }).join('');

  return `
    <details class="word-picker" data-translation-id="${escAttr(translation.id)}">
      <summary class="word-picker-summary">
        <span>补提漏词</span>
        <small>${tokens.filter((token) => token.type === 'word' && !existingWords.has(token.key)).length} selectable</small>
      </summary>
      <div class="word-picker-source">${source}</div>
      <div class="word-picker-actions">
        <span class="word-picker-count">${selectedWords.size} selected</span>
        <button class="btn btn-primary btn-sm extract-selected" type="button" ${selectedWords.size ? '' : 'disabled'}>让 AI 识别</button>
        <button class="btn btn-ghost btn-sm clear-selected" type="button" ${selectedWords.size ? '' : 'disabled'}>清空</button>
      </div>
    </details>
  `;
}

function bindWordPickerActions(root, handlers) {
  if (!root) return;

  root.querySelectorAll('.word-picker').forEach((picker) => {
    const translationId = String(picker.dataset.translationId || '');
    const selectedWords = handlers.selectionsByTranslation.get(translationId) || new Set();
    handlers.selectionsByTranslation.set(translationId, selectedWords);

    const sync = () => {
      picker.querySelectorAll('.source-token').forEach((token) => {
        token.classList.toggle('selected', selectedWords.has(token.dataset.key));
      });
      const count = picker.querySelector('.word-picker-count');
      if (count) count.textContent = `${selectedWords.size} selected`;
      picker.querySelectorAll('.extract-selected, .clear-selected').forEach((btn) => {
        btn.disabled = selectedWords.size === 0;
      });
    };

    picker.querySelectorAll('.source-token:not(.existing)').forEach((token) => {
      token.addEventListener('click', function () {
        const key = this.dataset.key;
        if (!key) return;
        if (selectedWords.has(key)) {
          selectedWords.delete(key);
        } else {
          selectedWords.add(key);
        }
        sync();
      });
    });

    const clear = picker.querySelector('.clear-selected');
    if (clear) {
      clear.addEventListener('click', () => {
        selectedWords.clear();
        sync();
      });
    }

    const submit = picker.querySelector('.extract-selected');
    if (submit) {
      submit.addEventListener('click', async () => {
        const words = [...selectedWords].map((key) => (
          picker.querySelector(`.source-token[data-key="${cssAttr(key)}"]`)?.dataset.word || key
        ));
        if (!words.length) return;

        submit.disabled = true;
        submit.textContent = '识别中...';
        try {
          await handlers.onExtract(translationId, words);
        } catch (error) {
          showToast(error.message || 'AI extraction failed');
          sync();
        } finally {
          submit.textContent = '让 AI 识别';
        }
      });
    }
  });
}

function mergeCandidates(existing, incoming) {
  const byId = new Map();
  (existing || []).forEach((candidate) => byId.set(Number(candidate.id), candidate));
  (incoming || []).forEach((candidate) => byId.set(Number(candidate.id), candidate));
  return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

function bindReviewActions(root, handlers) {
  root.querySelectorAll('.accept-candidate').forEach(btn => {
    btn.addEventListener('click', async function () {
      await api(`/translation-vocabulary/${this.dataset.id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ familiarity: 'unknown' }),
      });
      showToast('Word accepted');
      handlers.onCandidateStatus(Number(this.dataset.id), 'accepted');
    });
  });
  root.querySelectorAll('.reject-candidate').forEach(btn => {
    btn.addEventListener('click', async function () {
      await api(`/translation-vocabulary/${this.dataset.id}/reject`, { method: 'POST' });
      showToast('Word rejected');
      handlers.onCandidateStatus(Number(this.dataset.id), 'rejected');
    });
  });
  root.querySelectorAll('.edit-candidate').forEach(btn => {
    btn.addEventListener('click', function () {
      editCandidate(this.dataset, handlers.onCandidateUpdate);
    });
  });
  root.querySelectorAll('.accept-grammar').forEach(btn => {
    btn.addEventListener('click', async function () {
      await api(`/grammar-notes/${this.dataset.id}/accept`, { method: 'POST' });
      showToast('Grammar accepted');
      handlers.onGrammarStatus(Number(this.dataset.id), 'accepted');
    });
  });
  root.querySelectorAll('.reject-grammar').forEach(btn => {
    btn.addEventListener('click', async function () {
      await api(`/grammar-notes/${this.dataset.id}/reject`, { method: 'POST' });
      showToast('Grammar rejected');
      handlers.onGrammarStatus(Number(this.dataset.id), 'rejected');
    });
  });
}

function editCandidate(data, onUpdate) {
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
    onUpdate(Number(data.id), formData);
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
    let words = await api(`/words?${query.toString()}`);
    const selectedWordIds = new Set();

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
      <div class="bulk-toolbar hidden">
        <span class="bulk-count">0 selected</span>
        <button class="btn btn-danger btn-sm bulk-delete-words" type="button">${Icons.trash} Delete selected</button>
      </div>
      <div class="word-list"></div>
    `;

    const refreshWordList = () => {
      renderWordList(app, words);
      bindWordActions(app, {
        selectedWordIds,
        onSelectionChange: () => renderBulkToolbar(app, selectedWordIds),
        onDelete: (id) => {
          words = ReviewState.removeById(words, id);
          selectedWordIds.delete(Number(id));
          renderBulkToolbar(app, selectedWordIds);
          refreshWordList();
        },
        onBulkDelete: (ids) => {
          words = ReviewState.removeByIds(words, ids);
          selectedWordIds.clear();
          renderBulkToolbar(app, selectedWordIds);
          refreshWordList();
        },
      });
      bindSpeakButtons(app);
      hydrateMissingPhonetics(app);
    };

    app.querySelector('.words-filters').addEventListener('submit', function (e) {
      e.preventDefault();
      const data = new FormData(this);
      const next = new URLSearchParams();
      for (const [key, value] of data.entries()) {
        if (value) next.set(key, value);
      }
      location.hash = `#/words?${next.toString()}`;
    });

    refreshWordList();
  } catch (err) {
    app.innerHTML = errorState(err);
  }
}

function renderBulkToolbar(root, selectedWordIds) {
  const toolbar = root.querySelector('.bulk-toolbar');
  const count = root.querySelector('.bulk-count');
  if (!toolbar || !count) return;
  const total = selectedWordIds.size;
  toolbar.classList.toggle('hidden', total === 0);
  count.textContent = `${total} selected`;
}

function renderWordList(root, words) {
  const list = root.querySelector('.word-list');
  if (!list) return;
  list.innerHTML = words.length ? words.map(wordCard).join('') : empty('No words yet');
}

function bindWordActions(root, handlers) {
  root.querySelectorAll('.word-familiarity').forEach(select => {
    select.addEventListener('change', async function () {
      await api(`/words/${this.dataset.id}`, {
        method: 'PUT',
        body: JSON.stringify({ familiarity: this.value }),
      });
      showToast('Word updated');
    });
  });

  root.querySelectorAll('.word-select').forEach(input => {
    input.checked = handlers.selectedWordIds.has(Number(input.value));
    input.addEventListener('change', function () {
      const id = Number(this.value);
      if (this.checked) {
        handlers.selectedWordIds.add(id);
      } else {
        handlers.selectedWordIds.delete(id);
      }
      handlers.onSelectionChange();
    });
  });

  root.querySelectorAll('.delete-word').forEach(btn => {
    btn.addEventListener('click', async function () {
      if (!confirm('Delete this word from the notebook?')) return;
      await api(`/words/${this.dataset.id}`, { method: 'DELETE' });
      showToast('Word deleted');
      handlers.onDelete(Number(this.dataset.id));
    });
  });

  const bulkDelete = root.querySelector('.bulk-delete-words');
  if (bulkDelete) bulkDelete.onclick = async () => {
    const ids = [...handlers.selectedWordIds];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected words from the notebook?`)) return;
    await api('/words/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    showToast('Words deleted');
    handlers.onBulkDelete(ids);
  };
}

function wordCard(w) {
  return `
    <article class="item-card word-card">
      <label class="word-select-wrap" aria-label="Select word">
        <input class="word-select" type="checkbox" value="${w.id}">
      </label>
      <div>
        <div class="item-title">${escHtml(w.word)}</div>
        <div class="item-subtitle">${escHtml(w.meaning)}</div>
        <div class="item-meta">
          ${phoneticSpan(w.word, w.phonetic)}
          ${escHtml(w.part_of_speech || '-')} · ${w.occurrence_count} occurrences · last seen ${formatDate(w.last_seen_at)}
          <button class="btn btn-ghost btn-sm speak-word" type="button" data-speak="${escAttr(w.word)}" aria-label="Play pronunciation">${Icons.volume}</button>
        </div>
      </div>
      <div class="word-actions">
        <select class="input word-familiarity" data-id="${w.id}">
          <option value="unknown" ${w.familiarity === 'unknown' ? 'selected' : ''}>Unknown</option>
          <option value="learning" ${w.familiarity === 'learning' ? 'selected' : ''}>Learning</option>
          <option value="mastered" ${w.familiarity === 'mastered' ? 'selected' : ''}>Mastered</option>
        </select>
        <button class="btn btn-danger btn-sm delete-word" type="button" data-id="${w.id}">${Icons.trash}</button>
      </div>
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
              <div class="source-text">${escHtml(displaySourceText(t) || '(no text detected)')}</div>
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
    let currentTranslation = { ...t, candidates };
    const selectedWordsByTranslation = new Map([[String(t.id), new Set()]]);

    app.innerHTML = `
      <div class="detail-toolbar">
        <a href="#/history" class="back-link">${Icons.arrowLeft} Back</a>
        <button class="btn btn-danger btn-sm delete-translation" type="button">${Icons.trash} Delete</button>
      </div>

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

      ${displaySourceText(t) || t.translated_text ? `
        <div class="text-compare">
          <div class="text-block">
            <h4>Source Text (${escHtml(t.source_language)})</h4>
            <p>${escHtml(displaySourceText(t) || '-')}</p>
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

      <div class="tab-panel active" id="panel-vocab"></div>
      <div class="tab-panel" id="panel-grammar"></div>
    `;

    const refreshDetailPanels = () => {
      renderDetailReviewPanels(app, currentTranslation, selectedWordsByTranslation);
      bindReviewActions(app.querySelector('#panel-vocab'), {
        onCandidateStatus: (candidateId, status) => {
          currentTranslation = ReviewState.applyReviewStatus([currentTranslation], 'candidate', candidateId, status)[0];
          refreshDetailPanels();
        },
        onGrammarStatus: () => {},
        onCandidateUpdate: (candidateId, patch) => {
          currentTranslation = updateLocalCandidate([currentTranslation], candidateId, patch)[0];
          refreshDetailPanels();
        },
      });
      bindWordPickerActions(app.querySelector('#panel-vocab'), {
        selectionsByTranslation: selectedWordsByTranslation,
        onExtract: async (translationId, words) => {
          const candidates = await api(`/translations/${translationId}/vocabulary/extract-selected`, {
            method: 'POST',
            body: JSON.stringify({ words }),
          });
          selectedWordsByTranslation.set(String(translationId), new Set());
          currentTranslation = {
            ...currentTranslation,
            candidates: mergeCandidates(currentTranslation.candidates || [], candidates),
          };
          showToast(candidates.length ? 'Word candidates extracted' : 'No new candidates found');
          refreshDetailPanels();
        },
      });
      bindReviewActions(app.querySelector('#panel-grammar'), {
        onCandidateStatus: () => {},
        onGrammarStatus: (grammarId, status) => {
          currentTranslation = ReviewState.applyReviewStatus([currentTranslation], 'grammar', grammarId, status)[0];
          refreshDetailPanels();
        },
        onCandidateUpdate: () => {},
      });
      bindSpeakButtons(app);
      hydrateMissingPhonetics(app);
    };

    bindTabs(app);
    refreshDetailPanels();
    app.querySelector('.delete-translation').addEventListener('click', async () => {
      if (!confirm('Delete this translation and all related vocabulary and grammar?')) return;
      await api(`/translations/${id}`, { method: 'DELETE' });
      showToast('Translation deleted');
      location.hash = '#/history';
    });
  } catch (err) {
    app.innerHTML = errorState(err);
  }
}

function renderDetailReviewPanels(root, translation, selectionsByTranslation = new Map()) {
  const vocabPanel = root.querySelector('#panel-vocab');
  const grammarPanel = root.querySelector('#panel-grammar');
  const vocabulary = ReviewState.partitionCandidates(translation.candidates || []);
  const grammar = ReviewState.partitionCandidates(translation.grammar || []);

  if (vocabPanel) {
    const selectedWords = selectionsByTranslation.get(String(translation.id)) || new Set();
    vocabPanel.innerHTML = `
      ${renderWordPicker(translation, selectedWords)}
      ${vocabulary.active.length ? vocabulary.active.map(candidateCard).join('') : empty('No vocabulary')}
      ${vocabulary.rejected.length ? `<details class="filtered-block"><summary>已拒绝 (${vocabulary.rejected.length})</summary>${vocabulary.rejected.map(candidateCard).join('')}</details>` : ''}
      ${vocabulary.filtered.length ? `<details class="filtered-block"><summary>Filtered mastered words (${vocabulary.filtered.length})</summary>${vocabulary.filtered.map(candidateCard).join('')}</details>` : ''}
    `;
  }

  if (grammarPanel) {
    grammarPanel.innerHTML = `
      ${grammar.active.length ? grammar.active.map(grammarReviewCard).join('') : empty('No grammar')}
      ${grammar.rejected.length ? `<details class="filtered-block"><summary>已拒绝 (${grammar.rejected.length})</summary>${grammar.rejected.map(grammarReviewCard).join('')}</details>` : ''}
    `;
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

function bindSourceImages(root) {
  root.querySelectorAll('.source-image').forEach(btn => {
    btn.addEventListener('click', function () {
      if (this.dataset.src) openLightbox(this.dataset.src);
    });
  });
}

function phoneticSpan(word, phonetic) {
  const value = phonetic || '';
  return `<span class="phonetic ${value ? '' : 'phonetic-empty'}" data-phonetic-word="${escAttr(word)}">${escHtml(value)}</span>`;
}

function hydrateMissingPhonetics(root) {
  const nodes = [...root.querySelectorAll('[data-phonetic-word]')];
  const words = [...new Set(nodes.map((node) => node.dataset.phoneticWord).filter(Boolean))];
  words.forEach(async (word) => {
    try {
      const result = await api(`/phonetic?word=${encodeURIComponent(word)}`);
      if (result.phonetic) {
        root.querySelectorAll(`.phonetic-empty[data-phonetic-word="${cssAttr(word)}"]`).forEach((node) => {
          node.textContent = result.phonetic;
          node.classList.remove('phonetic-empty');
        });
      }
      if (result.audio) {
        root.querySelectorAll(`.speak-word[data-speak="${cssAttr(word)}"]`).forEach((node) => {
          node.dataset.audio = result.audio;
        });
      }
    } catch (error) {
      console.warn('Unable to load pronunciation', word, error);
    }
  });
}

async function loadPronunciation(word) {
  const result = await api(`/phonetic?word=${encodeURIComponent(word)}`);
  return result.audio || '';
}

async function playPronunciation(word, audioUrl) {
  const audio = audioUrl || await loadPronunciation(word);
  if (!audio) {
    throw new Error('No dictionary audio found');
  }
  await new Audio(audio).play();
}

async function speakText(text, audioUrl = '') {
  if (!text) return;
  try {
    await playPronunciation(text, audioUrl);
  } catch {
    showToast('No dictionary pronunciation found');
  }
}

function bindSpeakButtons(root) {
  root.querySelectorAll('.speak-word').forEach(btn => {
    btn.addEventListener('click', function () {
      speakText(this.dataset.speak || '', this.dataset.audio || '');
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

function displaySourceText(translation) {
  return translation?.formatted_source_text || translation?.source_text || '';
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

function cssAttr(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatDate(s) {
  if (!s) return '-';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
