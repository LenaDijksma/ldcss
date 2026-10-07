  /* =====================================================================
     Search bar — ld-search, with fuzzy matching

       <div class="ld-search" data-ld-search data-ld-shortcut="/">
         <input type="search" class="ld-input" placeholder="Search…" aria-label="Search">
       </div>

     The input is styled like any .ld-input (the class is added if you left
     it off) and a search button sits next to it, so a click does what Enter
     does. Inside the field: a clear (×) button that appears once there is
     text and a keyboard hint; a "/" (or any single key) shortcut focuses it.

     Submitting (Enter, or the button) emits ld:search:submit
     { query, source: 'enter' | 'button' } on the wrapper (cancelable), makes
     sure the results are current, and keeps focus in the field. In a
     dropdown it opens the results; Enter with a result highlighted still
     chooses that result. Inside a <form> the button is a real submit button,
     so the form submits as usual.

     data-ld-search-button="false"  no button; a decorative magnifier sits
                                    inside the field instead
     data-ld-search-label="Go"      accessible name of the button (default "Search")
     data-ld-search-variant="primary"  data-ld-variant for the button

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

     Shared: data-ld-shortcut="/" (set to none for no shortcut),
             Esc clears the field.
     Events (on the wrapper): ld:search:submit (cancelable), ld:search:filter.
     API: ldcss.search.filter(wrapper, query), .clear(wrapper), .submit(wrapper)
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

  /* Enter or the search button. Returns false when a listener cancelled it. */
  function searchSubmit(wrap, source) {
    wrap = typeof wrap === 'string' ? document.querySelector(wrap) : wrap;
    var input = searchInputOf(wrap);
    if (!input) return false;
    var query = input.value;
    if (!emit(wrap, 'ld:search:submit', { query: query, source: source || 'button' }, true)) return false;
    if (wrap.hasAttribute('data-ld-search-filter')) {
      searchFilter(wrap);
    } else if (wrap.hasAttribute('data-ld-combobox') && query.trim()) {
      window.ldcss.combobox.search(wrap, query);
    }
    if (source === 'button') input.focus();
    return true;
  }

  defineComponent('search', '[data-ld-search]', function (wrap, scope) {
    var input = searchInputOf(wrap);
    if (!input) return;
    wrap._ldSearch = true;
    var added = { wrapClass: !wrap.classList.contains('ld-search'), inputClass: !input.classList.contains('ld-input'), type: !input.hasAttribute('type'), autocomplete: !input.hasAttribute('autocomplete'), enterkeyhint: !input.hasAttribute('enterkeyhint'), label: false, role: !wrap.hasAttribute('role'), shortcut: false };
    wrap._ldSearchAdded = added;
    wrap.classList.add('ld-search');
    input.classList.add('ld-input');
    if (!input.hasAttribute('type')) input.setAttribute('type', 'search');
    if (!input.hasAttribute('autocomplete')) input.setAttribute('autocomplete', 'off');
    if (!input.hasAttribute('enterkeyhint')) input.setAttribute('enterkeyhint', 'search');
    if (!input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby') && !(input.id && document.querySelector('label[for="' + input.id + '"]'))) {
      input.setAttribute('aria-label', input.getAttribute('placeholder') || 'Search');
      added.label = true;
    }
    wrap.setAttribute('role', wrap.hasAttribute('data-ld-combobox') ? wrap.getAttribute('role') || 'search' : 'search');

    // the field: input + clear button + shortcut hint, so they sit inside the input, not over the button
    var field = document.createElement('div');
    field.className = 'ld-search-field';
    var home = { parent: input.parentNode, next: input.nextSibling };
    home.parent.insertBefore(field, input);
    field.appendChild(input);
    scope.cleanup(function () {
      // put the input back where it was and drop everything built around it
      home.parent.insertBefore(input, field);
      if (field.parentNode) field.parentNode.removeChild(field);
    });

    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'ld-search-clear';
    clear.setAttribute('aria-label', 'Clear search');
    clear.textContent = '×';
    clear.hidden = true;
    scope.on(clear, 'click', function () { searchClear(wrap); });
    field.appendChild(clear);

    var key = wrap.getAttribute('data-ld-shortcut');
    if (key && key !== 'none') {
      var hint = document.createElement('kbd');
      hint.className = 'ld-search-kbd ld-kbd';
      hint.setAttribute('aria-hidden', 'true');
      hint.textContent = key;
      field.appendChild(hint);
      input.setAttribute('aria-keyshortcuts', key);
      added.shortcut = true;
    }

    if (wrap.getAttribute('data-ld-search-button') === 'false') {
      wrap.setAttribute('data-ld-search-compact', '');
      var icon = document.createElement('span');
      icon.className = 'ld-search-icon';
      icon.setAttribute('aria-hidden', 'true');
      field.insertBefore(icon, input);
      scope.cleanup(function () { wrap.removeAttribute('data-ld-search-compact'); });
    } else {
      var button = document.createElement('button');
      var inForm = !!wrap.closest('form');
      button.type = inForm ? 'submit' : 'button';
      button.className = 'ld-btn ld-search-btn';
      var variant = wrap.getAttribute('data-ld-search-variant');
      if (variant) button.setAttribute('data-ld-variant', variant);
      button.setAttribute('aria-label', wrap.getAttribute('data-ld-search-label') || 'Search');
      var glyph = document.createElement('span');
      glyph.className = 'ld-search-icon';
      glyph.setAttribute('aria-hidden', 'true');
      button.appendChild(glyph);
      // in a form the browser submits; everywhere else the click is the submit
      scope.on(button, 'click', function (e) {
        var ok = searchSubmit(wrap, 'button');
        if (!ok && inForm) e.preventDefault();
      });
      field.insertAdjacentElement('afterend', button);
      scope.add(button);
    }

    if (wrap.hasAttribute('data-ld-search-filter')) {
      scope.on(input, 'input', function () { searchFilter(wrap); });
    } else {
      scope.on(input, 'input', function () { searchSyncClear(wrap); });
    }
    scope.on(input, 'keydown', function (e) {
      if (e.key === 'Escape' && input.value && !wrap.hasAttribute('data-ld-combobox')) { e.preventDefault(); searchClear(wrap); return; }
      if (e.key === 'Escape' && wrap.hasAttribute('data-ld-combobox')) {
        // a search input clears itself on Escape and fires `input`, which would search again and reopen the
        // list we are about to close; the first Escape only closes it, the second clears (combobox module)
        var open = wrap.querySelector('[data-ld-combobox-list]');
        if (open && open.classList.contains('ld-show')) e.preventDefault();
      }
      if (e.key !== 'Enter' || e.isComposing) return;
      // a highlighted result in an open dropdown is chosen by the combobox, not submitted
      var list = wrap.querySelector('[data-ld-combobox-list]');
      if (list && list.classList.contains('ld-show') && list.querySelector('[data-ld-highlighted="true"]')) return;
      searchSubmit(wrap, 'enter');
    });
    searchSyncClear(wrap);
  }, function (wrap) {
    var input = searchInputOf(wrap), added = wrap._ldSearchAdded || {};
    wrap._ldSearch = false;
    if (added.wrapClass) wrap.classList.remove('ld-search');
    if (added.role) wrap.removeAttribute('role');
    if (input) {
      if (added.inputClass) input.classList.remove('ld-input');
      if (added.type) input.removeAttribute('type');
      if (added.autocomplete) input.removeAttribute('autocomplete');
      if (added.enterkeyhint) input.removeAttribute('enterkeyhint');
      if (added.label) input.removeAttribute('aria-label');
      if (added.shortcut) input.removeAttribute('aria-keyshortcuts');
    }
  }, { gate: true });

  delegate('keydown', function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    var typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (typing) return;
    var wraps = Array.prototype.filter.call(document.querySelectorAll('[data-ld-search][data-ld-shortcut]'), function (w) { return w._ldSearch; });
    for (var i = 0; i < wraps.length; i++) {
      var key = wraps[i].getAttribute('data-ld-shortcut');
      if (key && key !== 'none' && e.key === key && wraps[i].offsetParent !== null) {
        var input = searchInputOf(wraps[i]);
        if (input) { e.preventDefault(); input.focus(); input.select(); }
        return;
      }
    }
  });

  window.ldcss.search = { filter: searchFilter, clear: searchClear, submit: searchSubmit };

