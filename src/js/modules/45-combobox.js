  /* =====================================================================
     Combobox — static options, local items, or a remote source

       <div class="ld-form-group" data-ld-combobox>
         <input class="ld-input" type="text" autocomplete="off" aria-label="Origin">
         <div data-ld-combobox-list>
           <div data-ld-combobox-option>Ethiopia — Guji</div> …
           <div data-ld-combobox-empty>No matching origin</div>
         </div>
       </div>

     Sources (pick one; with none, the static options are filtered)
       data-ld-source="/api/search?q={q}"   remote: fetch JSON, {q} = encoded query
       data-ld-source="#people"             local: <script type="application/json" id="people">
       ldcss.combobox.source(box, (query, { signal }) => Promise | array)
       ldcss.combobox.setItems(box, [...])  local items, fuzzy-matched
     Items: strings or { label, value, description, group, disabled, href, … }.
       data-ld-items-path="data.results"    where the array sits in a remote response
       data-ld-label-key / data-ld-value-key / data-ld-description-key

     Behaviour
       data-ld-debounce="250"   ms to wait after typing before a remote request
       data-ld-min-chars="2"    shorter queries show no results and send nothing
       data-ld-limit="50"       most results to render
       data-ld-group-limit="6"  with grouped items: most results per group
       data-ld-fuzzy="true"     fuzzy-match static options / local items (default for items)
       data-ld-select-on-tab    Tab selects the highlighted option
       data-ld-highlight="false" no <mark> on matched letters in remote results
       data-ld-cache="false"    do not remember answers per query
       Typing again cancels the request still in flight (AbortController) and
       a late answer to an old query is thrown away, so results never go stale.

     States (data-ld-state on the box: idle | loading | results | empty | error)
       [data-ld-combobox-loading]  shown while waiting  (auto-created if absent)
       [data-ld-combobox-empty]    no results           (auto-created if absent)
       [data-ld-combobox-error]    request failed       (auto-created, with a
                                   [data-ld-combobox-retry] button)

     Rendering
       ldcss.combobox.render(box, (item, ctx) => Node | htmlString)
         ctx = { query, indices (matched chars of the label), highlight(text) }
       data-ld-template="#tpl"  <template> cloned per result; elements with
         data-ld-field="label|description|…" get that item field as text,
         data-ld-field-src / -href set src / href.
       The default row escapes everything and <mark>s the matched letters.

     Keyboard: ↓ ↑ move (↓ opens), PageUp/PageDown jump 10, Enter chooses,
     Esc closes (again: clears), Tab closes. Focus stays in the input;
     aria-activedescendant follows the highlight. Result counts are announced.

     Events (bubbling, on the box): ld:combobox:search { query }, :results
     { query, count, items }, :error { query, error }, :cancel { query },
     :select { item, value, label, option }
     ===================================================================== */

  var COMBO_DEFAULT_LIMIT = 50;

  function comboList(box) { return box.querySelector('[data-ld-combobox-list]'); }
  function comboInput(box) { return box.querySelector('input'); }
  function comboState(box) { return box._ld || (box._ld = { seq: 0, controller: null, timer: null, cache: {}, items: null, source: null, renderer: null, lastQuery: null }); }

  function comboOptionEls(box) {
    var list = comboList(box);
    if (!list) return [];
    return Array.prototype.slice.call(list.querySelectorAll('[data-ld-combobox-option]:not(.ld-hide)')).filter(function (o) {
      return o.getAttribute('aria-disabled') !== 'true';
    });
  }

  function comboStatusRegion(box) {
    var region = box.querySelector('[data-ld-combobox-status]');
    if (!region) {
      region = document.createElement('div');
      region.className = 'ld-sr-only';
      region.setAttribute('data-ld-combobox-status', '');
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      box.appendChild(region);
    }
    return region;
  }

  function comboSpecial(box, kind, create) {
    var el = box.querySelector('[data-ld-combobox-' + kind + ']');
    if (el || !create) return el;
    var list = comboList(box);
    if (!list) return null;
    el = document.createElement('div');
    el.setAttribute('data-ld-combobox-' + kind, '');
    if (kind === 'loading') {
      el.innerHTML = '<span class="ld-spinner" aria-hidden="true"></span> <span>Searching…</span>';
    } else if (kind === 'empty') {
      el.textContent = 'No results';
    } else if (kind === 'error') {
      el.innerHTML = '<span data-ld-combobox-error-text>Something went wrong.</span> <button type="button" class="ld-btn" data-ld-size="sm" data-ld-variant="outline" data-ld-combobox-retry>Try again</button>';
    }
    list.appendChild(el);
    return el;
  }

  function comboSetState(box, state) {
    box.setAttribute('data-ld-state', state);
    var list = comboList(box);
    if (list) list.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    ['loading', 'empty', 'error'].forEach(function (kind) {
      var el = comboSpecial(box, kind, state === kind);
      if (el) el.classList.toggle('ld-show', state === kind);
    });
    var input = comboInput(box);
    if (input) input.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  }

  function openCombobox(box) {
    var list = comboList(box), input = comboInput(box);
    if (list) list.classList.add('ld-show');
    if (input) input.setAttribute('aria-expanded', 'true');
  }

  function closeCombobox(box) {
    var list = comboList(box), input = comboInput(box);
    if (list) {
      list.classList.remove('ld-show');
      list.querySelectorAll('[data-ld-combobox-option]').forEach(function (o) { o.removeAttribute('data-ld-highlighted'); });
    }
    if (input) {
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
  }

  function closeAllComboboxes(except) {
    document.querySelectorAll('[data-ld-combobox]').forEach(function (box) {
      if (box !== except) closeCombobox(box);
    });
  }

  function highlightComboboxOption(box, index) {
    var options = comboOptionEls(box), input = comboInput(box);
    options.forEach(function (o) { o.removeAttribute('data-ld-highlighted'); });
    var chosen = options[index];
    if (chosen) {
      chosen.setAttribute('data-ld-highlighted', 'true');
      chosen.scrollIntoView({ block: 'nearest' });
      if (input) input.setAttribute('aria-activedescendant', ensureId(chosen, 'ld-opt'));
    } else if (input) {
      input.removeAttribute('aria-activedescendant');
    }
    return options;
  }

  /* -- reading config ----------------------------------------------------- */

  function comboNumber(box, attr, fallback) {
    var n = parseInt(box.getAttribute(attr), 10);
    return isNaN(n) ? fallback : n;
  }

  function comboPath(obj, path) {
    if (!path) return obj;
    var cur = obj;
    String(path).split('.').forEach(function (k) { cur = cur == null ? cur : cur[k]; });
    return cur;
  }

  function comboNormalize(box, raw) {
    var labelKey = box.getAttribute('data-ld-label-key') || 'label';
    var valueKey = box.getAttribute('data-ld-value-key') || 'value';
    var descKey = box.getAttribute('data-ld-description-key') || 'description';
    return (raw || []).map(function (entry) {
      if (entry == null) return null;
      if (typeof entry !== 'object') return { label: String(entry), value: String(entry), raw: entry };
      var label = entry[labelKey] != null ? entry[labelKey] : (entry.name != null ? entry.name : entry.title);
      var value = entry[valueKey] != null ? entry[valueKey] : (entry.id != null ? entry.id : label);
      return {
        label: label == null ? '' : String(label),
        value: value,
        description: entry[descKey] == null ? '' : String(entry[descKey]),
        group: entry.group || '',
        disabled: !!entry.disabled,
        href: entry.href || '',
        keywords: entry.keywords || '',
        raw: entry
      };
    }).filter(Boolean);
  }

  /* -- rendering ---------------------------------------------------------- */

  function comboDefaultRow(item, ctx) {
    var row = document.createElement('div');
    var label = document.createElement('span');
    label.className = 'ld-combobox-label';
    label.innerHTML = ctx.highlight(item.label);
    row.appendChild(label);
    if (item.description) {
      var desc = document.createElement('small');
      desc.className = 'ld-combobox-desc';
      desc.innerHTML = ctx.highlight(item.description, ctx.descIndices);
      row.appendChild(desc);
    }
    return row;
  }

  function comboTemplateRow(template, item) {
    var node = template.content.firstElementChild ? template.content.firstElementChild.cloneNode(true) : document.createElement('div');
    var raw = item.raw && typeof item.raw === 'object' ? item.raw : item;
    var fill = function (el, attr, apply) {
      var field = el.getAttribute(attr);
      var value = field in item ? item[field] : (raw ? raw[field] : '');
      apply(el, value == null ? '' : String(value));
    };
    [node].concat(Array.prototype.slice.call(node.querySelectorAll('*'))).forEach(function (el) {
      if (el.hasAttribute('data-ld-field')) fill(el, 'data-ld-field', function (e, v) { e.textContent = v; });
      if (el.hasAttribute('data-ld-field-src')) fill(el, 'data-ld-field-src', function (e, v) { e.setAttribute('src', v); });
      if (el.hasAttribute('data-ld-field-href')) fill(el, 'data-ld-field-href', function (e, v) { e.setAttribute('href', v); });
    });
    return node;
  }

  function comboRender(box, items, query, matchInfo) {
    var list = comboList(box), st = comboState(box);
    if (!list) return;
    Array.prototype.forEach.call(list.querySelectorAll('[data-ld-rendered]'), function (n) { n.remove(); });
    var limit = comboNumber(box, 'data-ld-limit', COMBO_DEFAULT_LIMIT);
    var shown = items.slice(0, limit);
    var templateSel = box.getAttribute('data-ld-template');
    var template = templateSel ? document.querySelector(templateSel) : null;
    var lastGroup = null;
    var anchor = list.querySelector('[data-ld-combobox-loading], [data-ld-combobox-empty], [data-ld-combobox-error]');

    shown.forEach(function (item, i) {
      if (item.group && item.group !== lastGroup) {
        var heading = document.createElement('div');
        heading.className = 'ld-combobox-group';
        heading.setAttribute('role', 'presentation');
        heading.setAttribute('data-ld-rendered', '');
        heading.textContent = item.group;
        list.insertBefore(heading, anchor);
      }
      lastGroup = item.group;

      var info = (matchInfo && matchInfo[i]) || {};
      if (!matchInfo && query && box.getAttribute('data-ld-highlight') !== 'false') {
        // remote/cached results: the server did the matching, so just show where the query landed
        var lm = window.ldcss.fuzzy.match(query, item.label), dm = item.description ? window.ldcss.fuzzy.match(query, item.description) : null;
        info = { label: lm ? lm.indices : [], description: dm ? dm.indices : [] };
      }
      var ctx = {
        query: query,
        index: i,
        indices: info.label || [],
        descIndices: info.description || [],
        highlight: function (text, idx) {
          var indices = idx || (text === item.label ? info.label : null);
          return window.ldcss.fuzzy.highlight(text, indices || []);
        }
      };
      var content;
      if (st.renderer) content = st.renderer(item, ctx);
      else if (template) content = comboTemplateRow(template, item);
      else content = comboDefaultRow(item, ctx);

      var option = document.createElement(item.href ? 'a' : 'div');
      option.setAttribute('data-ld-combobox-option', '');
      option.setAttribute('data-ld-rendered', '');
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.id = uid('ld-opt');
      if (item.href) { option.setAttribute('href', item.href); option.setAttribute('tabindex', '-1'); }
      if (item.disabled) option.setAttribute('aria-disabled', 'true');
      option.setAttribute('data-ld-value', item.value == null ? item.label : String(item.value));
      option.setAttribute('data-ld-label', item.label);
      option._ldItem = item;
      if (typeof content === 'string') option.innerHTML = content;
      else if (content && content.nodeType) option.appendChild(content);
      list.insertBefore(option, anchor);
    });
    return shown.length;
  }

  /* -- searching ---------------------------------------------------------- */

  function comboAnnounce(box, count, query) {
    var region = comboStatusRegion(box);
    region.textContent = '';
    var msg = count === 0 ? 'No results' : count + (count === 1 ? ' result' : ' results') + ' available, use up and down arrows to review';
    setTimeout(function () { region.textContent = msg; }, 60);
  }

  function comboShowResults(box, items, query, matchInfo) {
    var count = comboRender(box, items, query, matchInfo);
    comboSetState(box, count ? 'results' : 'empty');
    var list = comboList(box);
    if (list) list.removeAttribute('data-ld-stale');
    openCombobox(box);
    highlightComboboxOption(box, box.getAttribute('data-ld-autohighlight') === 'false' ? -1 : 0);
    comboAnnounce(box, count, query);
    emit(box, 'ld:combobox:results', { query: query, count: count, items: items });
  }

  function comboLocalSearch(box, items, query) {
    var st = comboState(box);
    var results = window.ldcss.fuzzy.search(query, items, { keys: [{ name: 'label', weight: 1 }, { name: 'description', weight: 0.6 }, { name: 'keywords', weight: 0.5 }, { name: 'group', weight: 0.3 }] });
    // items that carry a group are shown under one heading per group, groups ordered by their best match
    if (results.some(function (r) { return r.item.group; })) {
      // cap each group so a group with hundreds of hits cannot push the others off the list
      var perGroup = comboNumber(box, 'data-ld-group-limit', 6), taken = {};
      results = results.filter(function (r) {
        var g = r.item.group || '';
        taken[g] = (taken[g] || 0) + 1;
        return taken[g] <= perGroup;
      });
      var order = [];
      results.forEach(function (r) { var g = r.item.group || ''; if (order.indexOf(g) === -1) order.push(g); });
      results = results
        .map(function (r, i) { return { r: r, i: i }; })
        .sort(function (a, b) { return order.indexOf(a.r.item.group || '') - order.indexOf(b.r.item.group || '') || a.i - b.i; })
        .map(function (x) { return x.r; });
    }
    comboShowResults(box, results.map(function (r) { return r.item; }), query, results.map(function (r) { return r.matches; }));
    void st;
  }

  function comboUrlFor(box, template, query) {
    var encoded = encodeURIComponent(query);
    if (template.indexOf('{q}') !== -1) return template.replace(/\{q\}/g, encoded);
    var param = box.getAttribute('data-ld-query-param') || 'q';
    return template + (template.indexOf('?') === -1 ? '?' : '&') + encodeURIComponent(param) + '=' + encoded;
  }

  function comboFetch(box, query, signal) {
    var template = box.getAttribute('data-ld-source');
    var options = { signal: signal, headers: { Accept: 'application/json' } };
    return fetch(comboUrlFor(box, template, query), options).then(function (res) {
      if (!res.ok) { var err = new Error('HTTP ' + res.status); err.status = res.status; throw err; }
      return res.json();
    }).then(function (json) {
      var path = box.getAttribute('data-ld-items-path');
      var list = comboPath(json, path);
      return Array.isArray(list) ? list : [];
    });
  }

  function cancelComboRequest(box, announce) {
    var st = comboState(box);
    clearTimeout(st.timer);
    if (st.controller) {
      st.controller.abort();
      st.controller = null;
      if (announce) emit(box, 'ld:combobox:cancel', { query: st.lastQuery });
    }
  }

  function comboIsRemote(box) {
    var st = comboState(box), src = box.getAttribute('data-ld-source');
    return !!st.source || (!!src && src.charAt(0) !== '#');
  }

  function comboLocalItems(box) {
    var st = comboState(box);
    if (st.items) return st.items;
    var src = box.getAttribute('data-ld-source');
    if (src && src.charAt(0) === '#') {
      var script = document.querySelector(src);
      if (script) {
        try { st.items = comboNormalize(box, JSON.parse(script.textContent)); } catch (err) { console.error('ldcss combobox: bad JSON in ' + src, err); st.items = []; }
        return st.items;
      }
    }
    return null;
  }

  function runComboSearch(box, query, bypassCache) {
    var st = comboState(box);
    cancelComboRequest(box, true);
    var seq = ++st.seq;
    st.lastQuery = query;
    var useCache = box.getAttribute('data-ld-cache') !== 'false' && !bypassCache;
    if (useCache && st.cache[query]) {
      comboShowResults(box, st.cache[query], query, null);
      return;
    }
    var controller = window.AbortController ? new AbortController() : null;
    st.controller = controller;
    var list = comboList(box);
    if (list && list.querySelector('[data-ld-rendered]')) list.setAttribute('data-ld-stale', 'true');
    comboSetState(box, 'loading');
    openCombobox(box);
    emit(box, 'ld:combobox:search', { query: query });

    var signal = controller && controller.signal;
    var work;
    try {
      work = st.source ? Promise.resolve(st.source(query, { signal: signal, box: box })) : comboFetch(box, query, signal);
    } catch (err) { work = Promise.reject(err); }

    work.then(function (raw) {
      if (seq !== st.seq) return; // a newer search owns the list now
      st.controller = null;
      var items = comboNormalize(box, Array.isArray(raw) ? raw : []);
      if (box.getAttribute('data-ld-cache') !== 'false') {
        st.cache[query] = items;
        var keys = Object.keys(st.cache);
        if (keys.length > 20) delete st.cache[keys[0]];
      }
      comboShowResults(box, items, query, null);
    }).catch(function (err) {
      if (seq !== st.seq || (err && err.name === 'AbortError')) return;
      st.controller = null;
      var list2 = comboList(box);
      if (list2) list2.removeAttribute('data-ld-stale');
      comboSetState(box, 'error');
      var text = box.querySelector('[data-ld-combobox-error-text]');
      if (text && !text.hasAttribute('data-ld-custom')) text.textContent = err && err.status ? 'Request failed (' + err.status + ').' : 'Could not load results.';
      openCombobox(box);
      comboAnnounce(box, -1, query);
      comboStatusRegion(box).textContent = 'Could not load results';
      emit(box, 'ld:combobox:error', { query: query, error: err });
    });
  }

  /* static markup: show / hide / reorder existing options */
  function filterCombobox(box, query) {
    var list = comboList(box);
    if (!list) return;
    var q = query.trim().toLowerCase();
    var fuzzy = box.getAttribute('data-ld-fuzzy') === 'true';
    var options = Array.prototype.slice.call(list.querySelectorAll('[data-ld-combobox-option]:not([data-ld-rendered])'));
    var visible = 0;
    if (fuzzy && q) {
      var ranked = window.ldcss.fuzzy.search(query, options.map(function (o) { return { el: o, text: o.textContent.trim() }; }), { keys: ['text'] });
      var hit = {};
      ranked.forEach(function (r, i) { hit[i] = r; });
      options.forEach(function (o) { o.classList.add('ld-hide'); });
      var empty = list.querySelector('[data-ld-combobox-empty]');
      ranked.forEach(function (r) { r.item.el.classList.remove('ld-hide'); list.insertBefore(r.item.el, empty); visible++; });
    } else {
      options.forEach(function (opt) {
        var match = !q || opt.textContent.toLowerCase().indexOf(q) !== -1;
        opt.classList.toggle('ld-hide', !match);
        if (match) visible++;
      });
    }
    comboSetState(box, visible ? 'results' : 'empty');
    comboAnnounce(box, visible, query);
  }

  function onComboboxInput(box, fromToggle) {
    if (!box) return;
    var input = comboInput(box), st = comboState(box);
    var query = input ? input.value : '';
    var min = comboNumber(box, 'data-ld-min-chars', 0);

    if (comboIsRemote(box)) {
      clearTimeout(st.timer);
      if (query.trim().length < min || (!query.trim() && min > 0)) {
        cancelComboRequest(box, true);
        st.seq++;
        var l = comboList(box);
        if (l) Array.prototype.forEach.call(l.querySelectorAll('[data-ld-rendered]'), function (n) { n.remove(); });
        comboSetState(box, 'idle');
        closeCombobox(box);
        return;
      }
      openCombobox(box);
      var wait = fromToggle ? 0 : comboNumber(box, 'data-ld-debounce', 250);
      // typing again before the timer fires means the previous (not yet sent) search never happens;
      // one already sent is cancelled inside runComboSearch
      st.timer = setTimeout(function () { runComboSearch(box, query.trim()); }, wait);
      comboSetState(box, st.cache[query.trim()] ? box.getAttribute('data-ld-state') || 'results' : 'loading');
      return;
    }

    var items = comboLocalItems(box);
    if (items) {
      if (query.trim().length < min) { closeCombobox(box); return; }
      comboLocalSearch(box, items, query.trim());
      return;
    }
    openCombobox(box);
    filterCombobox(box, query);
    highlightComboboxOption(box, 0);
  }

  /* -- selecting & keyboard ----------------------------------------------- */

  function selectComboboxOption(option) {
    var box = option.closest('[data-ld-combobox]');
    if (!box || option.getAttribute('aria-disabled') === 'true') return;
    var input = comboInput(box);
    var rendered = option.hasAttribute('data-ld-rendered');
    var item = option._ldItem || null;
    var fill = box.getAttribute('data-ld-fill');
    var label = option.getAttribute('data-ld-label') || option.textContent.trim();
    var value = option.getAttribute('data-ld-value');
    var text = fill === 'label' || (rendered && fill !== 'value') ? label : (value || option.textContent.trim());

    comboList(box).querySelectorAll('[data-ld-combobox-option]').forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
    option.setAttribute('aria-selected', 'true');
    box.setAttribute('data-ld-selected', value == null ? text : value);
    if (input) {
      input.value = text;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var proceed = emit(box, 'ld:combobox:select', { item: item, value: value, label: label, option: option }, true);
    cancelComboRequest(box, false);
    comboState(box).seq++;
    closeCombobox(box);
    if (input) input.focus();
    if (proceed && item && item.href && option.tagName === 'A') window.location.href = item.href;
  }

  function handleComboboxKeydown(e) {
    var box = e.target.closest && e.target.closest('[data-ld-combobox]');
    if (!box || e.target !== comboInput(box)) return;
    var list = comboList(box);
    if (!list) return;
    var isOpen = list.classList.contains('ld-show');
    var options = comboOptionEls(box);
    var current = options.findIndex(function (o) { return o.getAttribute('data-ld-highlighted') === 'true'; });

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openCombobox(box);
        if (!comboIsRemote(box) || comboOptionEls(box).length) {
          if (!comboOptionEls(box).length && (comboLocalItems(box) || !list.querySelector('[data-ld-rendered]'))) onComboboxInput(box, true);
          highlightComboboxOption(box, e.key === 'ArrowUp' ? comboOptionEls(box).length - 1 : 0);
        } else {
          onComboboxInput(box, true);
        }
      }
      return;
    }

    if (e.key === 'ArrowDown') { e.preventDefault(); highlightComboboxOption(box, Math.min(options.length - 1, current + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlightComboboxOption(box, Math.max(0, current - 1)); }
    else if (e.key === 'PageDown') { e.preventDefault(); highlightComboboxOption(box, Math.min(options.length - 1, current + 10)); }
    else if (e.key === 'PageUp') { e.preventDefault(); highlightComboboxOption(box, Math.max(0, current - 10)); }
    else if (e.key === 'Enter') {
      var chosen = options[current];
      if (chosen) { e.preventDefault(); selectComboboxOption(chosen); }
    } else if (e.key === 'Tab') {
      var tabChosen = options[current];
      if (tabChosen && box.hasAttribute('data-ld-select-on-tab')) selectComboboxOption(tabChosen);
      else closeCombobox(box);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      closeCombobox(box);
      cancelComboRequest(box, true);
    }
  }

  document.addEventListener('keydown', function (e) {
    // second Escape on an already-closed combobox clears it
    if (e.key !== 'Escape') return;
    var box = e.target.closest && e.target.closest('[data-ld-combobox]');
    var input = box && comboInput(box);
    if (input && e.target === input && input.value && !comboList(box).classList.contains('ld-show') && box.getAttribute('data-ld-escape-clear') !== 'false') {
      input.value = '';
      box.removeAttribute('data-ld-selected');
      comboSetState(box, 'idle');
    }
  }, true);

  document.addEventListener('click', function (e) {
    var retry = e.target.closest && e.target.closest('[data-ld-combobox-retry]');
    if (retry) {
      var box = retry.closest('[data-ld-combobox]');
      var input = box && comboInput(box);
      if (box && input) { runComboSearch(box, input.value.trim(), true); input.focus(); }
    }
  });

  /* keep the input open/closed in step with the list when focus leaves */
  document.addEventListener('focusin', function (e) {
    var box = e.target.closest && e.target.closest('[data-ld-combobox]');
    document.querySelectorAll('[data-ld-combobox]').forEach(function (other) {
      if (other !== box) closeCombobox(other);
    });
  });

  function initComboboxes(root) {
    qsaSelf(root, '[data-ld-combobox]').forEach(function (box) {
      var list = comboList(box), input = comboInput(box);
      if (!list || !input) return;
      var st = comboState(box);
      if (!st.ready) {
        st.ready = true;
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-haspopup', 'listbox');
        input.setAttribute('aria-expanded', list.classList.contains('ld-show') ? 'true' : 'false');
        input.setAttribute('aria-controls', ensureId(list, 'ld-listbox'));
        if (!input.hasAttribute('autocomplete')) input.setAttribute('autocomplete', 'off');
        list.setAttribute('role', 'listbox');
        comboStatusRegion(box);
        if (box.getAttribute('data-ld-source') || st.source) comboSetState(box, 'idle');
        // a visible <label for> is the best name; fall back to the placeholder
        if (!input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby') && !(input.id && document.querySelector('label[for="' + input.id + '"]')) && !input.closest('label')) {
          var fallback = input.getAttribute('placeholder');
          if (fallback) input.setAttribute('aria-label', fallback);
        }
      }
      Array.prototype.forEach.call(list.querySelectorAll('[data-ld-combobox-option]:not([role])'), function (o) {
        o.setAttribute('role', 'option');
        o.setAttribute('aria-selected', 'false');
        ensureId(o, 'ld-opt');
      });
      var special = ['empty', 'loading', 'error'];
      special.forEach(function (k) {
        var el = box.querySelector('[data-ld-combobox-' + k + ']');
        if (el && !el.hasAttribute('role')) el.setAttribute('role', 'presentation');
      });
    });
  }

  function comboRef(el) { return typeof el === 'string' ? document.querySelector(el) : el; }

  moduleInits.push(initComboboxes);
  window.ldcss.combobox = {
    source: function (el, fn) { var box = comboRef(el); comboState(box).source = fn; comboSetState(box, 'idle'); },
    render: function (el, fn) { comboState(comboRef(el)).renderer = fn; },
    setItems: function (el, items) {
      var box = comboRef(el);
      var st = comboState(box);
      st.items = comboNormalize(box, items);
      st.cache = {};
    },
    search: function (el, query) {
      var box = comboRef(el), input = comboInput(box);
      if (input) input.value = query;
      onComboboxInput(box, true);
    },
    clear: function (el) {
      var box = comboRef(el), input = comboInput(box);
      cancelComboRequest(box, false);
      if (input) input.value = '';
      box.removeAttribute('data-ld-selected');
      comboSetState(box, 'idle');
      closeCombobox(box);
    },
    open: function (el) { openCombobox(comboRef(el)); },
    close: function (el) { closeCombobox(comboRef(el)); }
  };

