(function () {
  function partitionCandidates(items) {
    return (items || []).reduce((groups, item) => {
      if (item.status === 'rejected') {
        groups.rejected.push(item);
      } else if (item.status === 'filtered') {
        groups.filtered.push(item);
      } else {
        groups.active.push(item);
      }
      return groups;
    }, { active: [], rejected: [], filtered: [] });
  }

  function applyReviewStatus(translations, kind, id, status) {
    const key = kind === 'grammar' ? 'grammar' : 'candidates';
    return (translations || []).map((translation) => ({
      ...translation,
      [key]: (translation[key] || []).map((item) => (
        Number(item.id) === Number(id) ? { ...item, status } : item
      )),
    }));
  }

  function countPending(translation) {
    return [
      ...(translation.candidates || []),
      ...(translation.grammar || []),
    ].filter((item) => item.status === 'pending').length;
  }

  function removeById(items, id) {
    return (items || []).filter((item) => Number(item.id) !== Number(id));
  }

  function removeByIds(items, ids) {
    const idSet = new Set((ids || []).map((id) => Number(id)));
    return (items || []).filter((item) => !idSet.has(Number(item.id)));
  }

  function normalizeWord(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
      .replace(/\s+/g, ' ');
  }

  function tokenizeSourceText(text) {
    const tokens = [];
    const pattern = /[A-Za-z]+(?:[-'][A-Za-z]+)*/g;
    let lastIndex = 0;
    let index = 0;
    let match;

    while ((match = pattern.exec(String(text || ''))) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ type: 'text', value: text.slice(lastIndex, match.index), key: `text-${index}` });
        index += 1;
      }

      const value = match[0];
      tokens.push({ type: 'word', value, key: normalizeWord(value) });
      index += 1;
      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < String(text || '').length) {
      tokens.push({ type: 'text', value: String(text || '').slice(lastIndex), key: `text-${index}` });
    }

    return tokens;
  }

  function collectExistingNormalizedWords(candidates) {
    return new Set((candidates || [])
      .map((candidate) => normalizeWord(candidate.normalized_word || candidate.word || ''))
      .filter(Boolean));
  }

  globalThis.ReviewState = {
    partitionCandidates,
    applyReviewStatus,
    countPending,
    removeById,
    removeByIds,
    normalizeWord,
    tokenizeSourceText,
    collectExistingNormalizedWords,
  };
}());
