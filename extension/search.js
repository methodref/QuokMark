/* Derived, in-memory search data; native bookmarks remain the source of truth. */
const BookmarkSearch = (() => {
  const fields = ['title', 'hostname', 'pathname'];
  const cjk = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+$/u;
  const cjkParts = /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+)/u;
  const normalize = text => String(text || '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
  const words = text => normalize(text).split(cjkParts).flatMap(part => cjk.test(part) ? [part] : part.match(/\.?[\p{L}\p{N}]+(?:\.[\p{L}\p{N}]+)*(?:\+\+|#)?/gu) || []);
  const grams = word => { const letters = [...word]; return letters.slice(1).map((letter, i) => letters[i] + letter); };
  function tokens(text) {
    return words(text).flatMap(word => cjk.test(word) ? [...word, ...grams(word)] : [word, ...(word.includes('.') ? word.split('.').filter(Boolean) : [])]);
  }
  function decodePath(path) {
    return path.split('/').map(segment => { try { return decodeURIComponent(segment); } catch { return segment; } }).join('/');
  }
  function parseURL(value) { try { return new URL(value); } catch { return null; } }
  function oneEdit(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length >= b.length) i++;
      if (b.length >= a.length) j++;
    }
    return edits + Number(i < a.length || j < b.length) <= 1;
  }
  function phrase(title, query) {
    let start = title.indexOf(query);
    while (start !== -1) {
      const end = start + query.length;
      const boundary = char => !char || !/[\p{Script=Latin}\p{N}]/u.test(char);
      if ((cjk.test(query[0]) || boundary(title[start - 1])) && (cjk.test(query.at(-1)) || boundary(title[end]))) return true;
      start = title.indexOf(query, start + 1);
    }
    return false;
  }
  const compare = (a, b) => a.tier - b.tier || b.score - a.score || a.order - b.order || String(a.id).localeCompare(String(b.id), 'en');
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));

  return class BookmarkSearch {
    constructor(MiniSearchClass = globalThis.MiniSearch) {
      this.MiniSearchClass = MiniSearchClass;
      this.tree = null;
      this.version = 0;
      this.state = 'loading';
      this.records = new Map();
      this.titles = new Map(); this.urls = new Map();
      this.cache = new Map();
    }
    async replaceTree(tree) {
      this.tree = tree;
      const version = ++this.version, records = new Map(), documents = [], titles = new Map(), urls = new Map();
      this.state = 'loading'; this.cache.clear();
      const stack = tree.slice().reverse().map(node => ({ node, path: [], parentId: '' }));
      let order = 0, batch = 0;
      while (stack.length) {
        if (version !== this.version) return false;
        const { node, path, parentId } = stack.pop();
        if (node.type === 'separator') continue;
        const fullPath = [...path, node.title || ''], record = { node, fullPath, parentId, order: order++ };
        if (node.url) {
          const url = parseURL(node.url);
          record.text = { title: normalize(node.title), hostname: normalize(url?.hostname), pathname: normalize(url ? decodePath(url.pathname) : '') };
          record.href = url?.href || node.url;
          for (const [map, key] of [[titles, record.text.title], [urls, record.href]]) {
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(node.id);
          }
          const document = { id: node.id }, terms = [];
          for (const field of fields) {
            const fieldTokens = tokens(record.text[field]);
            if (field === 'pathname' && url && normalize(url.pathname) !== record.text.pathname) fieldTokens.push(...tokens(url.pathname));
            document[field] = fieldTokens.join(' '); terms.push(...fieldTokens);
          }
          record.terms = new Set(terms); documents.push(document);
        }
        records.set(node.id, record);
        for (let i = (node.children?.length || 0) - 1; i >= 0; i--) stack.push({ node: node.children[i], path: fullPath, parentId: node.id });
        if (++batch === 100) { batch = 0; await pause(); }
      }
      try {
        const index = new this.MiniSearchClass({ fields, tokenize: text => text.split(' ').filter(Boolean), processTerm: term => term,
          searchOptions: { combineWith: 'AND', boost: { title: 5, hostname: 3, pathname: 1 }, weights: { prefix: 0.8, fuzzy: 0.35 }, maxFuzzy: 1 } });
        for (let i = 0; i < documents.length; i += 100) {
          if (version !== this.version) return false;
          index.addAll(documents.slice(i, i + 100)); await pause();
        }
        if (version !== this.version) return false;
        this.index = index; this.state = 'ready';
      } catch {
        if (version !== this.version) return false;
        this.index = null; this.state = 'fallback';
      }
      this.records = records; this.titles = titles; this.urls = urls;
      return true;
    }
    search(input) {
      if (this.state === 'loading') return { state: 'loading', hits: new Map() };
      if (this.cache.has(input)) return this.cache.get(input);
      const query = normalize(input), hits = new Map();
      if (this.state === 'fallback') {
        for (const [id, record] of this.records) if (record.node.url && (record.node.title || '').toLocaleLowerCase().includes(input.toLocaleLowerCase())) hits.set(id, { id, tier: 2, score: 0, order: record.order });
      } else if (query) {
        const parsed = /^[a-z][a-z\d+.-]*:/i.test(input.trim()) ? parseURL(input.trim()) : null;
        const url = parsed && (/^[a-z][a-z\d+.-]*:\/\//i.test(input.trim()) || this.urls.has(parsed.href)) ? parsed : null;
        const domain = !url && /^[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+$/u.test(query) ? parseURL('https://' + query) : null;
        const keywords = [...new Set(words(url ? url.hostname + ' ' + decodePath(url.pathname) : query))];
        const last = keywords.length - 1, allowPrefix = !url && !/\s$/.test(input) && last >= 0 && /[a-z]/u.test(keywords[last]) && !cjk.test(keywords[last]);
        const fuzzyWord = word => /^[a-z]{4,}$/u.test(word);
        const querySpec = (prefix, fuzzy) => ({ combineWith: 'AND', queries: keywords.map((word, i) => ({
          combineWith: 'AND', queries: (cjk.test(word) && [...word].length > 1 ? grams(word) : [word]).map(term => ({ queries: [term], prefix: prefix && allowPrefix && i === last, fuzzy: fuzzy && fuzzyWord(word) ? 1 : false }))
        })) });
        const valid = record => keywords.every(word => !cjk.test(word) || fields.some(field => record.text[field].includes(word)));
        const add = (result, tier) => {
          const record = this.records.get(result.id);
          if (!record || (url && record.text.hostname !== normalize(url.hostname)) || !valid(record)) return;
          if (url && record.href === url.href) tier = -1;
          else if (record.text.title === query || (domain && record.text.hostname === normalize(domain.hostname))) tier = 0;
          else if (tier === 2 && phrase(record.text.title, query)) tier = 1;
          hits.set(result.id, { id: result.id, tier, score: result.score, order: record.order });
        };
        if (keywords.length) {
          for (const result of this.index.search(querySpec(false, false))) add(result, 2);
          if (allowPrefix) for (const result of this.index.search(querySpec(true, false))) if (!hits.has(result.id)) add(result, 3);
        }
        // Equality is checked independently of tokenization, including URL query/fragment.
        for (const id of new Set([...(this.titles.get(query) || []), ...(url ? this.urls.get(url.href) || [] : [])])) if (!hits.has(id)) add({ id, score: 0 }, 0);
        if (hits.size < 5 && !url && !domain && keywords.some(fuzzyWord)) {
          const approximate = [];
          for (const result of this.index.search(querySpec(true, true))) {
            if (hits.has(result.id)) continue;
            const record = this.records.get(result.id);
            if (!valid(record)) continue;
            let edits = 0;
            const covered = keywords.every((word, i) => {
              if (record.terms.has(word) || cjk.test(word)) return true;
              if (allowPrefix && i === last && [...record.terms].some(term => term.startsWith(word))) return true;
              if (!fuzzyWord(word) || ![...record.terms].some(term => fuzzyWord(term) && oneEdit(word, term))) return false;
              return ++edits <= 1;
            });
            if (covered && edits === 1) approximate.push({ id: result.id, tier: 5, score: result.score, order: record.order });
          }
          approximate.sort(compare).slice(0, 10).forEach(hit => hits.set(hit.id, hit));
        }
      }
      const result = { state: this.state, hits };
      if (this.cache.size === 2) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(input, result);
      return result;
    }
    popup(input) {
      const result = this.search(input), folderMatches = new Set(), keys = new Map();
      if (result.state === 'loading') return { ...result, nodes: [], folderMatches };
      const term = input.toLocaleLowerCase();
      const visit = (nodes, includeAll = false) => {
        const kept = [];
        for (const node of nodes) {
          const record = this.records.get(node.id);
          if (!record) continue;
          let key = result.hits.get(node.id) || { id: node.id, tier: 6, score: 0, order: record.order };
          if (node.url) { if (!includeAll && !result.hits.has(node.id)) continue; kept.push(node); }
          else {
            const matched = (node.title || '').toLocaleLowerCase().includes(term);
            if (matched) { folderMatches.add(node.id); key = { ...key, tier: 4 }; }
            const children = visit(node.children || [], includeAll || matched);
            if (!includeAll && !matched && !children.length) continue;
            for (const child of children) if (compare(keys.get(child.id), key) < 0) key = keys.get(child.id);
            kept.push({ ...node, children });
          }
          keys.set(node.id, key);
        }
        return kept.sort((a, b) => compare(keys.get(a.id), keys.get(b.id)));
      };
      return { ...result, nodes: visit(this.tree), folderMatches };
    }
    bindings(input) {
      const result = this.search(input), groups = new Map(), term = input.trim().toLocaleLowerCase();
      if (result.state === 'loading') return { ...result, groups: [] };
      for (const [id, record] of this.records) {
        const key = record.node.url ? result.hits.get(id) : (record.node.title || '').toLocaleLowerCase().includes(term) ? { id, tier: 4, score: 0, order: record.order } : null;
        if (!key) continue;
        if (!groups.has(record.parentId)) groups.set(record.parentId, { parentId: record.parentId, fullPath: record.fullPath.slice(0, -1), entries: [], key });
        const group = groups.get(record.parentId);
        group.entries.push({ ...record, key });
        if (compare(key, group.key) < 0) group.key = key;
      }
      const ordered = [...groups.values()].sort((a, b) => compare(a.key, b.key));
      for (const group of ordered) group.entries.sort((a, b) => compare(a.key, b.key));
      return { ...result, groups: ordered };
    }
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BookmarkSearch;
