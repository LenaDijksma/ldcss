  /* =====================================================================
     Fuzzy matching — ldcss.fuzzy.match / .search / .highlight
     Subsequence matching with scoring (the approach used by fzy): every
     query character must appear in order; matches that are consecutive,
     start a word, or sit right after a separator score higher; gaps cost
     a little. Case-insensitive and accent-insensitive.

       ldcss.fuzzy.match('btn', 'Button')        → { score, indices: [0,3,4] } | null
       ldcss.fuzzy.search('btn pri', items, { keys: ['name', 'desc'], limit: 10 })
       ldcss.fuzzy.highlight('Button', [0, 3, 4]) → '<mark>B</mark>ut<mark>to</mark>n'

     A multi-word query is an AND: "btn pri" needs both "btn" and "pri".
     ===================================================================== */

  var FUZZY_GAP_LEADING = -0.005;
  var FUZZY_GAP_TRAILING = -0.005;
  var FUZZY_GAP_INNER = -0.01;
  var FUZZY_CONSECUTIVE = 1.0;
  var FUZZY_MAX_LENGTH = 256;

  function fuzzyFold(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i).normalize('NFD').charAt(0).toLowerCase();
      out += c.length === 1 ? c : str.charAt(i).toLowerCase().charAt(0);
    }
    return out;
  }

  function fuzzyBonus(text, j) {
    if (j === 0) return 0.8;
    var prev = text.charAt(j - 1), cur = text.charAt(j);
    if (prev === '/' || prev === '\\') return 0.9;
    if (prev === ' ' || prev === '-' || prev === '_' || prev === ':') return 0.8;
    if (prev === '.') return 0.6;
    if (prev === prev.toLowerCase() && prev !== prev.toUpperCase() && cur === cur.toUpperCase() && cur !== cur.toLowerCase()) return 0.7;
    return 0;
  }

  function fuzzyIsSubsequence(q, t) {
    var k = 0;
    for (var j = 0; j < t.length && k < q.length; j++) if (t.charAt(j) === q.charAt(k)) k++;
    return k === q.length;
  }

  function fuzzyMatch(query, text) {
    query = String(query == null ? '' : query);
    text = String(text == null ? '' : text);
    if (!query) return { score: 0, indices: [] };
    var q = fuzzyFold(query), t = fuzzyFold(text);
    var n = q.length, m = t.length;
    if (n > m || !fuzzyIsSubsequence(q, t)) return null;

    // too long for the full scoring table: plain left-to-right match
    if (m > FUZZY_MAX_LENGTH) {
      var idx = [], k = 0;
      for (var a = 0; a < m && k < n; a++) if (t.charAt(a) === q.charAt(k)) { idx.push(a); k++; }
      return { score: -idx[0], indices: idx };
    }

    var bonus = [];
    for (var b = 0; b < m; b++) bonus.push(fuzzyBonus(text, b));

    var D = [], M = [], i, j;
    for (i = 0; i < n; i++) {
      D.push(new Float64Array(m));
      M.push(new Float64Array(m));
      var prevScore = -Infinity;
      var gap = i === n - 1 ? FUZZY_GAP_TRAILING : FUZZY_GAP_INNER;
      for (j = 0; j < m; j++) {
        var score = -Infinity;
        if (q.charAt(i) === t.charAt(j)) {
          if (i === 0) score = j * FUZZY_GAP_LEADING + bonus[j];
          else if (j > 0) score = Math.max(M[i - 1][j - 1] + bonus[j], D[i - 1][j - 1] + FUZZY_CONSECUTIVE);
        }
        D[i][j] = score;
        prevScore = Math.max(score, prevScore + gap);
        M[i][j] = prevScore;
      }
    }

    var positions = new Array(n), matchRequired = false;
    j = m - 1;
    for (i = n - 1; i >= 0; i--) {
      for (; j >= 0; j--) {
        if (D[i][j] !== -Infinity && (matchRequired || D[i][j] === M[i][j])) {
          matchRequired = !!(i && j && M[i][j] === D[i - 1][j - 1] + FUZZY_CONSECUTIVE);
          positions[i] = j--;
          break;
        }
      }
    }
    return { score: M[n - 1][m - 1], indices: positions };
  }

  function fuzzyGet(item, key) {
    if (typeof key === 'function') return key(item);
    var value = item;
    String(key).split('.').forEach(function (part) { value = value == null ? value : value[part]; });
    return value;
  }

  /* items: strings, or objects with options.keys (strings, dotted paths or
     functions). A key may be { name, weight }. Returns
     [{ item, score, key, indices, matches: {key: indices} }] best first.
     An empty query returns every item in its original order. */
  function fuzzySearch(query, items, options) {
    options = options || {};
    var keys = options.keys || [null];
    var terms = String(query || '').trim().split(/\s+/).filter(Boolean);
    var results = [];

    items.forEach(function (item, order) {
      if (!terms.length) { results.push({ item: item, score: 0, indices: [], matches: {}, order: order }); return; }
      var total = 0, matches = {}, bestKey = null, bestKeyScore = -Infinity, ok = true;

      terms.forEach(function (term) {
        if (!ok) return;
        var best = null;
        keys.forEach(function (key) {
          var name = key && typeof key === 'object' ? key.name : key;
          var weight = key && typeof key === 'object' && key.weight ? key.weight : 1;
          var text = key === null ? item : fuzzyGet(item, name);
          if (text == null) return;
          var hit = fuzzyMatch(term, text);
          if (!hit) return;
          var weighted = hit.score * weight;
          if (!best || weighted > best.score) best = { score: weighted, hit: hit, name: String(name) };
        });
        if (!best) { ok = false; return; }
        total += best.score;
        var slot = matches[best.name] || (matches[best.name] = []);
        best.hit.indices.forEach(function (ix) { if (slot.indexOf(ix) === -1) slot.push(ix); });
        if (best.score > bestKeyScore) { bestKeyScore = best.score; bestKey = best.name; }
      });

      if (!ok) return;
      if (options.threshold != null && total < options.threshold) return;
      Object.keys(matches).forEach(function (k) { matches[k].sort(function (a, b) { return a - b; }); });
      results.push({ item: item, score: total, key: bestKey, indices: bestKey ? matches[bestKey] : [], matches: matches, order: order });
    });

    if (terms.length) results.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    return options.limit ? results.slice(0, options.limit) : results;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* text + matched indices → safe HTML with <mark> around the matches */
  function fuzzyHighlight(text, indices) {
    text = String(text == null ? '' : text);
    if (!indices || !indices.length) return escapeHtml(text);
    var set = {}, out = '', open = false;
    indices.forEach(function (ix) { set[ix] = true; });
    for (var i = 0; i < text.length; i++) {
      if (set[i] && !open) { out += '<mark>'; open = true; }
      if (!set[i] && open) { out += '</mark>'; open = false; }
      out += escapeHtml(text.charAt(i));
    }
    return out + (open ? '</mark>' : '');
  }

  window.ldcss.fuzzy = { match: fuzzyMatch, search: fuzzySearch, highlight: fuzzyHighlight };
  window.ldcss.escapeHtml = escapeHtml;

