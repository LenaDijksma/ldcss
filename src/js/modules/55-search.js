  /* =====================================================================
     Search bar — ld-search, with fuzzy matching

       <div class="ld-search" data-ld-search data-ld-shortcut="/">
         <input type="search" class="ld-input" placeholder="Search…" aria-label="Search">
       </div>

     The wrapper gets a search icon, a clear (×) button that appears once
     there is text, a keyboard hint, and a "/" (or any single key) shortcut
     that focuses it.

     Two ways to use it:

     1. Search results in a dropdown — make the wrapper a combobox:
          <div class="ld-search" data-ld-search data-ld-combobox data-ld-source="#index">
            <input …>
            <div data-ld-combobox-list></div>
          </div>
        Items come from a JSON <script id="index">, a URL, or
        ldcss.combobox.setItems(el, items). Matching is fuzzy, results are
        grouped when items have a group, matched letters are highlighted, and
        items with an href navigate on selection. Everything the combobox
        offers (data-ld-limit, templates, renderers, events) applies.

     2. Filter content already on the page:
          <div class="ld-search" data-ld-search data-ld-search-filter="#cards"> … </div>
          <div id="cards">
            <article data-ld-search-item data-ld-search-text="extra keywords">…</article>
          </div>
          <p data-ld-search-empty>Nothing found.</p>
        Items that do not match get hidden (the hidden attribute). Every word
        must match somewhere in the item's text. data-ld-search-rank="true"
        also reorders the items best-first. data-ld-search-count="#count"
        writes "3 of 12" into that element.
        Events (on the wrapper): ld:search:filter { query, count, total }.

     Shared: data-ld-shortcut="/" (set to none for no shortcut),
             Esc clears the field.
     API: ldcss.search.filter(wrapper, query), ldcss.search.clear(wrapper)
     ===================================================================== */

  function searchInputOf(wrap) { return wrap.querySelector('input'); }

  function searchSyncClear(wrap) {
    var input = searchInputOf(wrap), clear = wrap.querySelector('.ld-search-clear');
    if (input && clear) clear.hidden = !input.value;
  }

  function searchItems(wrap) {
    var sel = wrap.getAttribute('data-ld-search-filter');
    var container = sel ? document.querySelector(sel) : null;
    if (!container) return [];
    var items = container.querySelectorAll('[data-ld-search-item]');
    return Array.prototype.slice.call(items.length ? items : container.children);
  }

  function searchFilter(wrap, query) {
    wrap = typeof wrap === 'string' ? document.querySelector(wrap) : wrap;
    var input = searchInputOf(wrap);
    if (input && typeof query === 'string' && input.value !== query) input.value = query;
    query = input ? input.value : (query || '');
    var items = searchItems(wrap);
    var records = items.map(function (el) {
      return { el: el, text: (el.getAttribute('data-ld-search-text') || '') + ' ' + el.textContent.replace(/\s+/g, ' ') };
    });
    var ranked = window.ldcss.fuzzy.search(query, records, { keys: ['text'] });
    var keep = {};
    ranked.forEach(function (r, i) { keep[records.indexOf(r.item)] = i; });
    var container = items.length ? items[0].parentNode : null;
    records.forEach(function (rec, i) { rec.el.hidden = !(i in keep); });
    if (wrap.getAttribute('data-ld-search-rank') === 'true' && query.trim() && container) {
      ranked.forEach(function (r) { container.appendChild(r.item.el); });
    }
    var count = ranked.length;
    var empty = document.querySelector(wrap.getAttribute('data-ld-search-empty') || '[data-ld-search-empty]');
    if (empty) empty.hidden = count !== 0;
    var counter = wrap.getAttribute('data-ld-search-count');
    var counterEl = counter ? document.querySelector(counter) : null;
    if (counterEl) counterEl.textContent = query.trim() ? count + ' of ' + items.length : '';
    if (query.trim()) {
      announce(count ? count + (count === 1 ? ' result' : ' results') : 'No results');
    }
    emit(wrap, 'ld:search:filter', { query: query, count: count, total: items.length });
    searchSyncClear(wrap);
  }

  function searchClear(wrap) {
    wrap = typeof wrap === 'string' ? document.querySelector(wrap) : wrap;
    var input = searchInputOf(wrap);
    if (!input) return;
    input.value = '';
    if (wrap.hasAttribute('data-ld-search-filter')) searchFilter(wrap, '');
    else if (wrap.hasAttribute('data-ld-combobox')) window.ldcss.combobox.clear(wrap);
    searchSyncClear(wrap);
    input.focus();
  }

  function initSearch(root) {
    qsaSelf(root, '[data-ld-search]').forEach(function (wrap) {
      if (wrap._ldSearch) return;
      wrap._ldSearch = true;
      wrap.classList.add('ld-search');
      var input = searchInputOf(wrap);
      if (!input) return;
      if (!input.hasAttribute('type')) input.setAttribute('type', 'search');
      if (!input.hasAttribute('autocomplete')) input.setAttribute('autocomplete', 'off');
      if (!input.hasAttribute('enterkeyhint')) input.setAttribute('enterkeyhint', 'search');
      if (!input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby') && !(input.id && document.querySelector('label[for="' + input.id + '"]'))) {
        input.setAttribute('aria-label', input.getAttribute('placeholder') || 'Search');
      }
      wrap.setAttribute('role', wrap.hasAttribute('data-ld-combobox') ? wrap.getAttribute('role') || 'search' : 'search');

      var icon = document.createElement('span');
      icon.className = 'ld-search-icon';
      icon.setAttribute('aria-hidden', 'true');
      wrap.insertBefore(icon, wrap.firstChild);

      var clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'ld-search-clear';
      clear.setAttribute('aria-label', 'Clear search');
      clear.textContent = '×';
      clear.hidden = true;
      clear.addEventListener('click', function () { searchClear(wrap); });
      input.insertAdjacentElement('afterend', clear);

      var key = wrap.getAttribute('data-ld-shortcut');
      if (key && key !== 'none') {
        var hint = document.createElement('kbd');
        hint.className = 'ld-search-kbd ld-kbd';
        hint.setAttribute('aria-hidden', 'true');
        hint.textContent = key;
        clear.insertAdjacentElement('afterend', hint);
        input.setAttribute('aria-keyshortcuts', key);
      }

      if (wrap.hasAttribute('data-ld-search-filter')) {
        input.addEventListener('input', function () { searchFilter(wrap); });
      } else {
        input.addEventListener('input', function () { searchSyncClear(wrap); });
      }
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && input.value && !wrap.hasAttribute('data-ld-combobox')) { e.preventDefault(); searchClear(wrap); }
      });
      searchSyncClear(wrap);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    var typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (typing) return;
    var wraps = document.querySelectorAll('[data-ld-search][data-ld-shortcut]');
    for (var i = 0; i < wraps.length; i++) {
      var key = wraps[i].getAttribute('data-ld-shortcut');
      if (key && key !== 'none' && e.key === key && wraps[i].offsetParent !== null) {
        var input = searchInputOf(wraps[i]);
        if (input) { e.preventDefault(); input.focus(); input.select(); }
        return;
      }
    }
  });

  moduleInits.push(initSearch);
  window.ldcss.search = { filter: searchFilter, clear: searchClear };

