// ===== SVG 图标 =====
const Icons = {
  arrowLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  book: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
  edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
  plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  x: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
};

// ===== 配置 =====
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

// ===== Router =====
function router() {
  const hash = location.hash.slice(1) || '/';
  const app = document.getElementById('app');

  if (hash === '/') {
    renderList(app);
  } else if (hash.startsWith('/translation/')) {
    const id = hash.split('/translation/')[1];
    renderDetail(app, id);
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('load', () => { init().then(router); });

// ===== Toast =====
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2500);
}

// ===== API 请求 =====
async function api(path, opts = {}) {
  const url = API_BASE + path;
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (WORKER_API_KEY) {
    headers['Authorization'] = `Bearer ${WORKER_API_KEY}`;
  }
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ===== Lightbox =====
function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.remove('hidden');
}
document.getElementById('lightbox').addEventListener('click', function () {
  this.classList.add('hidden');
});

// ===== Modal =====
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
              ? `<textarea class="input" name="${f.name}" required>${escHtmlAttr(f.value || '')}</textarea>`
              : `<input class="input" type="${f.type || 'text'}" name="${f.name}" value="${escHtmlAttr(f.value || '')}" required>`}
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
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(this));
    await onSubmit(data);
    overlay.remove();
  });
}

// ===== 列表页 =====
async function renderList(app) {
  app.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Loading...</span></div>';

  try {
    const page = parseInt(new URLSearchParams(location.search).get('page') || '1');
    const result = await api(`/translations?page=${page}&limit=20`);

    if (!result.data.length) {
      app.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">${Icons.book}</span>
          <p>No translations yet</p>
          <small>Send a translation from your device to get started.</small>
        </div>`;
      return;
    }

    app.innerHTML = `
      <h1 class="page-title">Translation History</h1>
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
    app.innerHTML = `<div class="empty-state"><p>Error: ${escHtml(err.message)}</p></div>`;
  }
}

function renderPagination(p) {
  if (p.totalPages <= 1) return '';
  const items = [];
  for (let i = 1; i <= p.totalPages; i++) {
    items.push(`<li><a href="#/?page=${i}" class="${i === p.page ? 'primary' : ''}">${i}</a></li>`);
  }
  return `<nav class="pagination"><ul>${items.join('')}</ul></nav>`;
}

// ===== 详情页 =====
async function renderDetail(app, id) {
  app.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Loading...</span></div>';

  try {
    const t = await api(`/translations/${id}`);
    app.innerHTML = `
      <a href="#/" class="back-link">${Icons.arrowLeft} Back</a>

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

      <div class="detail-meta">
        Translated at ${formatDate(t.created_at)}
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn active" data-tab="vocab">Vocabulary (${t.vocabulary.length})</button>
        <button class="tab-btn" data-tab="grammar">Grammar (${t.grammar.length})</button>
      </div>

      <!-- Vocabulary Panel -->
      <div class="tab-panel active" id="panel-vocab">
        <div class="toolbar">
          <span></span>
          <button class="btn btn-primary btn-sm add-vocab-btn">
            ${Icons.plus} Add Word
          </button>
        </div>
        <table class="data-table vocab-table">
          <thead><tr><th>Word</th><th>Meaning</th><th>POS</th><th>Context</th><th></th></tr></thead>
          <tbody>${t.vocabulary.map(v => vocabRow(t.id, v)).join('')}</tbody>
        </table>
        <div class="vocab-cards">${t.vocabulary.map(v => vocabCard(t.id, v)).join('')}</div>
      </div>

      <!-- Grammar Panel -->
      <div class="tab-panel" id="panel-grammar">
        <div class="toolbar">
          <span></span>
          <button class="btn btn-primary btn-sm add-grammar-btn">
            ${Icons.plus} Add Grammar
          </button>
        </div>
        ${t.grammar.map(g => grammarCard(t.id, g)).join('')}
      </div>
    `;

    // Tab 切换
    app.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        app.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        app.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        document.getElementById(`panel-${this.dataset.tab}`).classList.add('active');
      });
    });

    // 添加按钮
    const addVocabBtn = app.querySelector('.add-vocab-btn');
    if (addVocabBtn) {
      addVocabBtn.addEventListener('click', () => addVocab(id));
    }
    const addGrammarBtn = app.querySelector('.add-grammar-btn');
    if (addGrammarBtn) {
      addGrammarBtn.addEventListener('click', () => addGrammar(id));
    }

    // 删除 & 编辑按钮
    app.querySelectorAll('.del-vocab').forEach(btn => {
      btn.addEventListener('click', async function () {
        if (!confirm('Delete this word?')) return;
        await api(`/translations/${id}/vocabulary/${this.dataset.vid}`, { method: 'DELETE' });
        showToast('Deleted');
        renderDetail(app, id);
      });
    });
    app.querySelectorAll('.edit-vocab').forEach(btn => {
      btn.addEventListener('click', async function () {
        await editVocab(id, this.dataset);
        renderDetail(app, id);
      });
    });
    app.querySelectorAll('.del-grammar').forEach(btn => {
      btn.addEventListener('click', async function () {
        if (!confirm('Delete this grammar note?')) return;
        await api(`/translations/${id}/grammar/${this.dataset.gid}`, { method: 'DELETE' });
        showToast('Deleted');
        renderDetail(app, id);
      });
    });
    app.querySelectorAll('.edit-grammar').forEach(btn => {
      btn.addEventListener('click', async function () {
        await editGrammar(id, this.dataset);
        renderDetail(app, id);
      });
    });
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Error: ${escHtml(err.message)}</p></div>`;
  }
}

// ===== 词汇/语法 增删改 =====
function addVocab(translationId) {
  openModal('Add Word', [
    { name: 'word', label: 'Word' },
    { name: 'meaning', label: 'Meaning' },
    { name: 'part_of_speech', label: 'Part of speech' },
    { name: 'context', label: 'Context' },
  ], async (data) => {
    await api(`/translations/${translationId}/vocabulary`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    showToast('Word added');
    location.reload();
  });
}

function editVocab(translationId, data) {
  openModal('Edit Word', [
    { name: 'word', label: 'Word', value: data.word },
    { name: 'meaning', label: 'Meaning', value: data.meaning },
    { name: 'part_of_speech', label: 'Part of speech', value: data.pos },
    { name: 'context', label: 'Context', value: data.context },
  ], async (formData) => {
    await api(`/translations/${translationId}/vocabulary/${data.vid}`, {
      method: 'PUT',
      body: JSON.stringify(formData),
    });
    showToast('Word updated');
  });
}

function addGrammar(translationId) {
  openModal('Add Grammar', [
    { name: 'pattern', label: 'Pattern' },
    { name: 'explanation', label: 'Explanation', type: 'textarea' },
    { name: 'example', label: 'Example' },
  ], async (data) => {
    await api(`/translations/${translationId}/grammar`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    showToast('Grammar added');
    location.reload();
  });
}

function editGrammar(translationId, data) {
  openModal('Edit Grammar', [
    { name: 'pattern', label: 'Pattern', value: data.pattern },
    { name: 'explanation', label: 'Explanation', type: 'textarea', value: data.explanation },
    { name: 'example', label: 'Example', value: data.example },
  ], async (formData) => {
    await api(`/translations/${translationId}/grammar/${data.gid}`, {
      method: 'PUT',
      body: JSON.stringify(formData),
    });
    showToast('Grammar updated');
  });
}

// ===== 词汇/语法 渲染 =====
function vocabRow(tid, v) {
  return `<tr>
    <td><strong>${escHtml(v.word)}</strong></td>
    <td>${escHtml(v.meaning)}</td>
    <td>${escHtml(v.part_of_speech || '-')}</td>
    <td>${escHtml(v.context || '-')}</td>
    <td>
      <div class="actions">
        <button class="btn btn-ghost btn-sm edit-vocab" data-vid="${v.id}" data-word="${escAttr(v.word)}" data-meaning="${escAttr(v.meaning)}" data-pos="${escAttr(v.part_of_speech || '')}" data-context="${escAttr(v.context || '')}">${Icons.edit}</button>
        <button class="btn btn-danger btn-sm del-vocab" data-vid="${v.id}">${Icons.trash}</button>
      </div>
    </td>
  </tr>`;
}

function vocabCard(tid, v) {
  return `
    <div class="item-card vocab-card">
      <div class="item-title">${escHtml(v.word)} <small style="font-weight:400;color:var(--ink-muted);">${escHtml(v.part_of_speech || '')}</small></div>
      <div class="item-subtitle">${escHtml(v.meaning)}</div>
      ${v.context ? `<div class="item-meta">Context: ${escHtml(v.context)}</div>` : ''}
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm edit-vocab" data-vid="${v.id}" data-word="${escAttr(v.word)}" data-meaning="${escAttr(v.meaning)}" data-pos="${escAttr(v.part_of_speech || '')}" data-context="${escAttr(v.context || '')}">${Icons.edit}</button>
        <button class="btn btn-danger btn-sm del-vocab" data-vid="${v.id}">${Icons.trash}</button>
      </div>
    </div>`;
}

function grammarCard(tid, g) {
  return `
    <div class="item-card grammar-card" style="margin-bottom:var(--space-sm);">
      <div class="item-title">${escHtml(g.pattern)}</div>
      <div class="item-meta" style="margin:var(--space-xs) 0;">${escHtml(g.explanation)}</div>
      ${g.example ? `<div class="item-meta" style="font-style:italic;">Example: ${escHtml(g.example)}</div>` : ''}
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm edit-grammar" data-gid="${g.id}" data-pattern="${escAttr(g.pattern)}" data-explanation="${escAttr(g.explanation)}" data-example="${escAttr(g.example || '')}">${Icons.edit}</button>
        <button class="btn btn-danger btn-sm del-grammar" data-gid="${g.id}">${Icons.trash}</button>
      </div>
    </div>`;
}

// ===== 工具函数 =====
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escHtmlAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(s) {
  if (!s) return '-';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
