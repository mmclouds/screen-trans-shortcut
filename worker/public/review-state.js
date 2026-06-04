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

  globalThis.ReviewState = {
    partitionCandidates,
    applyReviewStatus,
    countPending,
    removeById,
    removeByIds,
  };
}());
