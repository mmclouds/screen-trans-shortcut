// ===== 配置 =====
// 同源部署，Worker 同时托管 API 和静态页面
const API_BASE = '/api';
let WORKER_API_KEY = '';

// ===== 初始化 =====
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
          <label>${f.label}
            ${f.type === 'textarea'
              ? `<textarea name="${f.name}" required>${f.value || ''}</textarea>`
              : `<input type="${f.type || 'text'}" name="${f.name}" value="${f.value || ''}" required>`}
          </label>
        `).join('')}
        <div style="display:flex;gap:0.5rem;margin-top:1rem;">
          <button type="submit" class="primary">Save</button>
          <button type="button" class="secondary close-modal">Cancel</button>
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
  app.innerHTML = '<div class="empty-state"><div class="icon">⏳</div><p>Loading...</p></div>';

  try {
    const page = parseInt(new URLSearchParams(location.search).get('page') || '1');
    const result = await api(`/translations?page=${page}&limit=20`);

    if (!result.data.length) {
      app.innerHTML = `
        <div class="empty-state">
          <div class="icon">📭</div>
          <p>No translations yet</p>
          <small>Send a translation from your device to get started.</small>
        </div>`;
      return;
    }

    app.innerHTML = `
      <div class="translation-list">
        ${result.data.map(t => `
          <a href="#/translation/${t.id}" class="translation-card" style="text-decoration:none;color:inherit;">
            <img src="${escAttr(t.translated_image_url)}" alt="translated" loading="lazy">
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
    items.push(`<li><a href="#/?page=${i}" class="${i === p.page ? 'primary' : 'secondary'}">${i}</a></li>`);
  }
  return `<nav class="pagination"><ul>${items.join('')}</ul></nav>`;
}

// ===== 详情页 =====
async function renderDetail(app, id) {
  app.innerHTML = '<div class="empty-state"><div class="icon">⏳</div><p>Loading...</p></div>';

  try {
    const t = await api(`/translations/${id}`);
    app.innerHTML = `
      <a href="#/" class="back-link">← Back</a>

      <div class="compare-grid">
        <figure>
          <img src="${escAttr(t.original_image_url)}" alt="Original" loading="lazy" onclick="openLightbox('${escAttr(t.original_image_url)}')">
          <figcaption>Original</figcaption>
        </figure>
        <figure>
          <img src="${escAttr(t.translated_image_url)}" alt="Translated" loading="lazy" onclick="openLightbox('${escAttr(t.translated_image_url)}')">
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

      <div class="meta" style="margin-bottom:1rem;color:var(--pico-muted-color);font-size:0.85rem;">
        Translated at ${formatDate(t.created_at)}
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn active" data-tab="vocab">Vocabulary (${t.vocabulary.length})</button>
        <button class="tab-btn" data-tab="grammar">Grammar (${t.grammar.length})</button>
      </div>

      <!-- Vocabulary Panel -->
      <div class="tab-panel active" id="panel-vocab">
        <div style="margin-bottom:0.75rem;">
          <button class="primary" onclick="addVocab('${t.id}')" style="min-height:44px;">+ Add Word</button>
        </div>
        <div class="vocab-table">
          <table>
            <thead><tr><th>Word</th><th>Meaning</th><th>POS</th><th>Context</th><th></th></tr></thead>
            <tbody>${t.vocabulary.map(v => vocabRow(t.id, v, false)).join('')}</tbody>
          </table>
        </div>
        <div class="vocab-cards">${t.vocabulary.map(v => vocabRow(t.id, v, true)).join('')}</div>
      </div>

      <!-- Grammar Panel -->
      <div class="tab-panel" id="panel-grammar">
        <div style="margin-bottom:0.75rem;">
          <button class="primary" onclick="addGrammar('${t.id}')" style="min-height:44px;">+ Add Grammar</button>
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

    // 删除按钮
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
window.addVocab = async function (translationId) {
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
};

async function editVocab(translationId, data) {
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

window.addGrammar = async function (translationId) {
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
};

async function editGrammar(translationId, data) {
  openModal('Edit Grammar', [
    { name: 'pattern', label: 'Pattern', value: data.pattern },
    { name: 'explanation', label: 'Explanation', value: data.explanation, type: 'textarea' },
    { name: 'example', label: 'Example', value: data.example },
  ], async (formData) => {
    await api(`/translations/${translationId}/grammar/${data.gid}`, {
      method: 'PUT',
      body: JSON.stringify(formData),
    });
    showToast('Grammar updated');
  });
}

// ===== 词汇行渲染 =====
function vocabRow(tid, v, isCard) {
  if (isCard) {
    return `
      <div class="vocab-card">
        <div class="word">${escHtml(v.word)} <small>${escHtml(v.part_of_speech || '')}</small></div>
        <div class="meaning">${escHtml(v.meaning)}</div>
        ${v.context ? `<div class="meta">Context: ${escHtml(v.context)}</div>` : ''}
        <div class="card-actions">
          <button class="secondary edit-vocab" data-vid="${v.id}" data-word="${escAttr(v.word)}" data-meaning="${escAttr(v.meaning)}" data-pos="${escAttr(v.part_of_speech || '')}" data-context="${escAttr(v.context || '')}">Edit</button>
          <button class="contrast del-vocab" data-vid="${v.id}">Delete</button>
        </div>
      </div>`;
  }
  return `<tr>
    <td><strong>${escHtml(v.word)}</strong></td>
    <td>${escHtml(v.meaning)}</td>
    <td>${escHtml(v.part_of_speech || '-')}</td>
    <td>${escHtml(v.context || '-')}</td>
    <td>
      <div style="display:flex;gap:0.25rem;">
        <button class="secondary edit-vocab" data-vid="${v.id}" data-word="${escAttr(v.word)}" data-meaning="${escAttr(v.meaning)}" data-pos="${escAttr(v.part_of_speech || '')}" data-context="${escAttr(v.context || '')}">Edit</button>
        <button class="contrast del-vocab" data-vid="${v.id}">Del</button>
      </div>
    </td>
  </tr>`;
}

// ===== 语法卡片渲染 =====
function grammarCard(tid, g) {
  return `
    <div class="grammar-card" style="margin-bottom:0.75rem;">
      <div class="pattern">${escHtml(g.pattern)}</div>
      <div class="explanation">${escHtml(g.explanation)}</div>
      ${g.example ? `<div class="example">Example: ${escHtml(g.example)}</div>` : ''}
      <div class="card-actions">
        <button class="secondary edit-grammar" data-gid="${g.id}" data-pattern="${escAttr(g.pattern)}" data-explanation="${escAttr(g.explanation)}" data-example="${escAttr(g.example || '')}">Edit</button>
        <button class="contrast del-grammar" data-gid="${g.id}">Delete</button>
      </div>
    </div>`;
}

// ===== 工具函数 =====
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(s) {
  if (!s) return '-';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
