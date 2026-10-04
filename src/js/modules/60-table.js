  /* =====================================================================
     Easy tables — one attribute turns a plain table into a data table

       <table class="ld-table" data-ld-table
              data-ld-search data-ld-page-size="10" data-ld-select
              data-ld-empty="No people match.">
         <caption>People</caption>
         <thead><tr><th>Name</th><th data-ld-sort-type="number">Age</th><th data-ld-nosort>Actions</th></tr></thead>
         <tbody>…</tbody>
       </table>

     data-ld-table                  sortable headers (click or Enter/Space), scroll wrapper,
                                    empty state, screen-reader status line
       data-ld-search               adds a search box (fuzzy, every word must match)
         data-ld-search-columns="0,2"   only these columns (0-based)
         data-ld-search-placeholder="Filter rows…"
       data-ld-page-size="10"       paginates; data-ld-page-sizes="10,25,50" adds a rows-per-page select
       data-ld-select               checkbox column + select-all (works across pages)
       data-ld-empty="…"            text when nothing matches
       data-ld-sortable="false"     turn header sorting off (th[data-ld-nosort] for one column)
     On a th:  data-ld-sort-type="number|date|text" (auto-detected when omitted)
     On a td:  data-ld-sort-value="…" sorts by this instead of the visible text
     Sorting cycles ascending → descending → original order.

     Events (on the table): ld:table:sort { key, column, direction }, :filter { query, count },
       :page { page, pageSize, pageCount }, :select { count, rows }, :render { visible, total }
     API: ldcss.table.refresh(table)   re-read rows after you changed them
          .selected(table) → [tr…]   .clearSelection(table)   .search(table, q)   .page(table, n)
     Rows added to or removed from the tbody are picked up automatically.
     ===================================================================== */

  var tableCollator = typeof Intl !== 'undefined' && Intl.Collator ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }) : null;

  function tableRef(el) { return typeof el === 'string' ? document.querySelector(el) : el; }
  function tableSt(table) { return table._ldTable; }

  function tableCellValue(row, col) {
    var cell = row.cells[col];
    if (!cell) return '';
    var explicit = cell.getAttribute('data-ld-sort-value');
    return explicit != null ? explicit : cell.textContent.trim();
  }

  function tableNumber(text) {
    var cleaned = String(text).replace(/[\s$€£¥%,]/g, '').replace(/^\((.*)\)$/, '-$1');
    if (cleaned === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(cleaned)) return NaN;
    return parseFloat(cleaned);
  }

  function tableColumnType(st, col) {
    var th = st.headerCells[col];
    var declared = th && th.getAttribute('data-ld-sort-type');
    if (declared) return declared;
    var seen = 0, numeric = 0, dates = 0;
    for (var i = 0; i < st.rows.length && seen < 25; i++) {
      var v = tableCellValue(st.rows[i], col);
      if (v === '') continue;
      seen++;
      if (!isNaN(tableNumber(v))) numeric++;
      else if (/\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(v) && !isNaN(Date.parse(v))) dates++;
    }
    if (seen && numeric === seen) return 'number';
    if (seen && dates === seen) return 'date';
    return 'text';
  }

  function tableCompare(type) {
    return function (a, b) {
      var ea = a === '', eb = b === '';
      if (ea || eb) return ea === eb ? 0 : (ea ? 1 : -1); // blanks always last (flipped back for desc in caller)
      if (type === 'number') return tableNumber(a) - tableNumber(b);
      if (type === 'date') return Date.parse(a) - Date.parse(b);
      return tableCollator ? tableCollator.compare(a, b) : (a < b ? -1 : a > b ? 1 : 0);
    };
  }

  function tableSortBy(table, th) {
    var st = tableSt(table);
    if (!st) return;
    var col = th.cellIndex;
    var next;
    if (st.sort.col !== col) next = 'asc';
    else next = st.sort.dir === 'asc' ? 'desc' : (st.sort.dir === 'desc' ? null : 'asc');
    st.sort = { col: next ? col : -1, dir: next };
    st.page = 1;
    tableApply(table, 'sort');
    var label = th.textContent.trim();
    tableAnnounce(table, next ? 'Sorted by ' + label + ', ' + (next === 'asc' ? 'ascending' : 'descending') : 'Sorting cleared');
    emit(table, 'ld:table:sort', { key: th.getAttribute('data-ld-sort-key') || label, column: col, direction: next });
  }

  function tableAnnounce(table, message) {
    var st = tableSt(table);
    st.status.textContent = '';
    clearTimeout(st.announceTimer);
    st.announceTimer = setTimeout(function () { st.status.textContent = message; }, 60);
  }

  function tableCollectRows(table) {
    var st = tableSt(table);
    var body = table.tBodies[0];
    st.body = body;
    st.rows = body ? Array.prototype.slice.call(body.rows).filter(function (r) { return !r.hasAttribute('data-ld-table-empty'); }) : [];
    st.original = st.rows.slice();
    st.rows.forEach(function (row) {
      var from = st.selectable ? 1 : 0;
      var parts = [];
      for (var i = from; i < row.cells.length; i++) parts.push(row.cells[i].textContent.replace(/\s+/g, ' ').trim());
      row._ldCells = parts;
      row._ldText = parts.join(' ');
    });
  }

  function tableMatches(st) {
    var query = st.query.trim();
    if (!query) return st.rows.slice();
    var cols = st.searchColumns;
    var items = st.rows.map(function (row) {
      var text = cols ? cols.map(function (c) { return row._ldCells[c] || ''; }).join(' ') : row._ldText;
      return { row: row, text: text };
    });
    return window.ldcss.fuzzy.search(query, items, { keys: ['text'] }).map(function (r) { return r.item.row; });
  }

  function tableApply(table, reason) {
    var st = tableSt(table);
    st.busy = true;
    var matched = tableMatches(st);
    var inOriginalOrder = st.original.filter(function (r) { return matched.indexOf(r) !== -1; });
    var sorted = inOriginalOrder;
    if (st.sort.dir && st.sort.col >= 0) {
      var type = tableColumnType(st, st.sort.col);
      var cmp = tableCompare(type), sign = st.sort.dir === 'asc' ? 1 : -1;
      sorted = inOriginalOrder.map(function (row, i) { return { row: row, i: i, v: tableCellValue(row, st.sort.col) }; });
      sorted.sort(function (a, b) {
        var blank = (a.v === '') || (b.v === '');
        var r = blank ? cmp(a.v, b.v) : sign * cmp(a.v, b.v);
        return r || a.i - b.i; // stable
      });
      sorted = sorted.map(function (x) { return x.row; });
    }

    var total = sorted.length;
    var pageCount = st.pageSize ? Math.max(1, Math.ceil(total / st.pageSize)) : 1;
    if (st.page > pageCount) st.page = pageCount;
    if (st.page < 1) st.page = 1;
    var start = st.pageSize ? (st.page - 1) * st.pageSize : 0;
    var end = st.pageSize ? Math.min(total, start + st.pageSize) : total;
    var visible = sorted.slice(start, end);
    var visibleSet = visible;

    var fragmentOrder = sorted.concat(st.rows.filter(function (r) { return sorted.indexOf(r) === -1; }));
    fragmentOrder.forEach(function (row) {
      row.hidden = visibleSet.indexOf(row) === -1;
      st.body.appendChild(row);
    });

    // empty state
    var emptyRow = st.body.querySelector('[data-ld-table-empty]');
    if (!total) {
      if (!emptyRow) {
        emptyRow = st.body.insertRow(-1);
        emptyRow.setAttribute('data-ld-table-empty', '');
        var cell = emptyRow.insertCell(0);
        cell.colSpan = Math.max(1, st.headerCells.length);
        cell.textContent = table.getAttribute('data-ld-empty') || 'No matching rows.';
      }
    } else if (emptyRow) {
      emptyRow.remove();
    }

    // header state
    st.headerCells.forEach(function (th, i) {
      if (!th.hasAttribute('data-ld-sort')) return;
      if (st.sort.col === i && st.sort.dir) {
        th.setAttribute('data-ld-sort-dir', st.sort.dir);
        th.setAttribute('aria-sort', st.sort.dir === 'asc' ? 'ascending' : 'descending');
      } else {
        th.removeAttribute('data-ld-sort-dir');
        th.setAttribute('aria-sort', 'none');
      }
    });

    tableRenderFooter(table, total, start, end, pageCount);
    tableSyncSelectAll(table);
    if (st.observer) st.observer.takeRecords();
    st.busy = false;

    if (reason === 'search') {
      emit(table, 'ld:table:filter', { query: st.query, count: total });
      tableAnnounce(table, total ? total + (total === 1 ? ' row matches' : ' rows match') : 'No rows match');
    } else if (reason === 'page') {
      emit(table, 'ld:table:page', { page: st.page, pageSize: st.pageSize, pageCount: pageCount });
      tableAnnounce(table, 'Page ' + st.page + ' of ' + pageCount);
    }
    emit(table, 'ld:table:render', { visible: visible.length, total: total });
  }

  function tablePagerButtons(page, count) {
    if (count <= 7) { var all = []; for (var i = 1; i <= count; i++) all.push(i); return all; }
    var out = [1];
    var from = Math.max(2, page - 1), to = Math.min(count - 1, page + 1);
    if (page <= 3) { from = 2; to = 4; }
    if (page >= count - 2) { from = count - 3; to = count - 1; }
    if (from > 2) out.push('…');
    for (var n = from; n <= to; n++) out.push(n);
    if (to < count - 1) out.push('…');
    out.push(count);
    return out;
  }

  function tableRenderFooter(table, total, start, end, pageCount) {
    var st = tableSt(table);
    if (!st.footer) return;
    var all = st.rows.length;
    var text = total ? 'Showing ' + (start + 1) + '–' + end + ' of ' + total + (total !== all ? ' (filtered from ' + all + ')' : '') : 'No rows';
    if (st.selected.size) text += ' · ' + st.selected.size + ' selected';
    st.info.textContent = text;

    if (!st.pager) return;
    st.pager.textContent = '';
    st.pager.parentNode.hidden = pageCount <= 1;
    var mk = function (label, page, opts) {
      opts = opts || {};
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.setAttribute('data-ld-table-page', String(page));
      if (opts.aria) btn.setAttribute('aria-label', opts.aria);
      if (opts.current) { btn.setAttribute('aria-current', 'page'); li.setAttribute('data-ld-active', 'true'); }
      if (opts.disabled) btn.disabled = true;
      li.appendChild(btn);
      st.pager.appendChild(li);
    };
    mk('‹', st.page - 1, { aria: 'Previous page', disabled: st.page <= 1 });
    tablePagerButtons(st.page, pageCount).forEach(function (p) {
      if (p === '…') {
        var gap = document.createElement('li');
        gap.setAttribute('aria-hidden', 'true');
        gap.className = 'ld-pager-gap';
        gap.textContent = '…';
        st.pager.appendChild(gap);
      } else mk(String(p), p, { current: p === st.page, aria: 'Page ' + p });
    });
    mk('›', st.page + 1, { aria: 'Next page', disabled: st.page >= pageCount });
  }

  function tableSyncSelectAll(table) {
    var st = tableSt(table);
    if (!st.selectable || !st.selectAll) return;
    var matched = tableMatches(st);
    var chosen = matched.filter(function (r) { return st.selected.has(r); }).length;
    st.selectAll.checked = matched.length > 0 && chosen === matched.length;
    st.selectAll.indeterminate = chosen > 0 && chosen < matched.length;
    st.rows.forEach(function (row) {
      var on = st.selected.has(row);
      var box = row.cells[0] && row.cells[0].querySelector('input');
      if (box) box.checked = on;
      if (on) row.setAttribute('aria-selected', 'true'); else row.removeAttribute('aria-selected');
      row.toggleAttribute('data-ld-selected', on);
    });
  }

  function tableEmitSelect(table) {
    var st = tableSt(table);
    tableSyncSelectAll(table);
    tableRenderFooterOnly(table);
    emit(table, 'ld:table:select', { count: st.selected.size, rows: Array.from(st.selected) });
  }

  function tableRenderFooterOnly(table) {
    var st = tableSt(table);
    if (!st.footer) return;
    var base = st.info.textContent.replace(/ · \d+ selected$/, '');
    st.info.textContent = base + (st.selected.size ? ' · ' + st.selected.size + ' selected' : '');
  }

  function tableBuildSelectColumn(table, st) {
    Array.prototype.forEach.call(table.tHead ? table.tHead.rows : [], function (hr, ri) {
      var th = document.createElement('th');
      th.className = 'ld-table-select';
      th.scope = 'col';
      if (ri === 0) {
        var all = document.createElement('input');
        all.type = 'checkbox';
        all.setAttribute('aria-label', 'Select all rows');
        all.setAttribute('data-ld-table-selectall', '');
        th.appendChild(all);
        st.selectAll = all;
      }
      hr.insertBefore(th, hr.firstChild);
    });
    st.rows.forEach(function (row) { tableAddRowCheckbox(row); });
  }

  function tableAddRowCheckbox(row) {
    var td = document.createElement('td');
    td.className = 'ld-table-select';
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.setAttribute('aria-label', 'Select row');
    box.setAttribute('data-ld-table-rowselect', '');
    td.appendChild(box);
    row.insertBefore(td, row.firstChild);
  }

  function initTables(root) {
    qsaSelf(root, 'table[data-ld-table]').forEach(function (table) {
      if (table._ldTable) return;
      var st = table._ldTable = {
        rows: [], original: [], body: null, sort: { col: -1, dir: null }, query: '', page: 1,
        pageSize: parseInt(table.getAttribute('data-ld-page-size'), 10) || 0,
        selectable: table.hasAttribute('data-ld-select'), selected: new Set(), busy: false,
        headerCells: [], searchColumns: null
      };
      var cols = table.getAttribute('data-ld-search-columns');
      if (cols) st.searchColumns = cols.split(',').map(function (n) { return parseInt(n, 10); }).filter(function (n) { return !isNaN(n); });
      if (st.selectable) {
        // rows must be known before checkboxes are added to them
        var firstBody = table.tBodies[0];
        st.rows = firstBody ? Array.prototype.slice.call(firstBody.rows) : [];
        tableBuildSelectColumn(table, st);
        if (st.cols) st.cols = null;
      }
      // shift search columns to account for the select column
      if (st.selectable && st.searchColumns) st.searchColumns = st.searchColumns.map(function (c) { return c; });
      tableCollectRows(table);

      // wrapper + chrome
      var wrap = table.parentNode.classList && table.parentNode.classList.contains('ld-table-wrap') ? table.parentNode : null;
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'ld-table-wrap';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      }
      var caption = table.querySelector('caption');
      var name = (caption && caption.textContent.trim()) || table.getAttribute('aria-label') || 'Table';
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', name);
      wrap.tabIndex = 0;

      var shell = document.createElement('div');
      shell.className = 'ld-table-shell';
      wrap.parentNode.insertBefore(shell, wrap);

      if (table.hasAttribute('data-ld-search')) {
        var bar = document.createElement('div');
        bar.className = 'ld-table-toolbar';
        var input = document.createElement('input');
        input.type = 'search';
        input.className = 'ld-input';
        input.placeholder = table.getAttribute('data-ld-search-placeholder') || 'Filter rows…';
        input.setAttribute('aria-label', 'Filter ' + name);
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('data-ld-table-search', '');
        bar.appendChild(input);
        shell.appendChild(bar);
        st.searchInput = input;
        input.addEventListener('input', function () {
          clearTimeout(st.searchTimer);
          st.searchTimer = setTimeout(function () { st.query = input.value; st.page = 1; tableApply(table, 'search'); }, 120);
        });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && input.value) { input.value = ''; st.query = ''; st.page = 1; tableApply(table, 'search'); e.stopPropagation(); }
        });
      }
      shell.appendChild(wrap);

      st.status = document.createElement('div');
      st.status.className = 'ld-sr-only';
      st.status.setAttribute('role', 'status');
      st.status.setAttribute('aria-live', 'polite');
      shell.appendChild(st.status);

      if (st.pageSize || table.hasAttribute('data-ld-search') || st.selectable) {
        st.footer = document.createElement('div');
        st.footer.className = 'ld-table-footer';
        st.info = document.createElement('span');
        st.info.className = 'ld-table-info';
        st.footer.appendChild(st.info);
        var right = document.createElement('div');
        right.className = 'ld-table-footer-right';
        var sizes = (table.getAttribute('data-ld-page-sizes') || '').split(',').map(function (n) { return parseInt(n, 10); }).filter(Boolean);
        if (st.pageSize && sizes.length) {
          if (sizes.indexOf(st.pageSize) === -1) sizes.push(st.pageSize);
          sizes.sort(function (a, b) { return a - b; });
          var sel = document.createElement('select');
          sel.className = 'ld-select';
          sel.setAttribute('aria-label', 'Rows per page');
          sizes.forEach(function (n) { var o = document.createElement('option'); o.value = n; o.textContent = n + ' / page'; if (n === st.pageSize) o.selected = true; sel.appendChild(o); });
          sel.addEventListener('change', function () { st.pageSize = parseInt(sel.value, 10); st.page = 1; tableApply(table, 'page'); });
          right.appendChild(sel);
        }
        if (st.pageSize) {
          var nav = document.createElement('nav');
          nav.setAttribute('aria-label', name + ' pagination');
          st.pager = document.createElement('ul');
          st.pager.className = 'ld-pager';
          nav.appendChild(st.pager);
          right.appendChild(nav);
        }
        st.footer.appendChild(right);
        shell.appendChild(st.footer);
      }

      // sortable headers: wrap the label in a real button so keyboards and screen readers work
      var headRow = table.tHead && table.tHead.rows[table.tHead.rows.length - 1];
      st.headerCells = headRow ? Array.prototype.slice.call(headRow.cells) : [];
      if (table.getAttribute('data-ld-sortable') !== 'false') {
        st.headerCells.forEach(function (th) {
          if (th.hasAttribute('data-ld-nosort') || th.classList.contains('ld-table-select')) return;
          th.setAttribute('data-ld-sort', '');
          th.setAttribute('aria-sort', 'none');
          if (!th.querySelector('.ld-sort-btn')) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ld-sort-btn';
            while (th.firstChild) btn.appendChild(th.firstChild);
            th.appendChild(btn);
          }
        });
      }

      // rows added or removed later
      if (st.body && window.MutationObserver) {
        st.observer = new MutationObserver(function () {
          if (st.busy) return;
          clearTimeout(st.refreshTimer);
          st.refreshTimer = setTimeout(function () { refreshTable(table); }, 30);
        });
        st.observer.observe(st.body, { childList: true });
      }
      tableApply(table, 'init');
    });
  }

  function refreshTable(table) {
    table = tableRef(table);
    var st = table && tableSt(table);
    if (!st) return;
    st.busy = true;
    var body = table.tBodies[0];
    if (st.selectable && body) {
      Array.prototype.forEach.call(body.rows, function (row) {
        if (!row.hasAttribute('data-ld-table-empty') && !(row.cells[0] && row.cells[0].classList.contains('ld-table-select'))) tableAddRowCheckbox(row);
      });
    }
    tableCollectRows(table);
    st.selected.forEach(function (row) { if (st.rows.indexOf(row) === -1) st.selected.delete(row); });
    tableApply(table, 'refresh');
  }

  document.addEventListener('click', function (e) {
    var pageBtn = e.target.closest && closestOf(e.target, '[data-ld-table-page]');
    if (pageBtn && !pageBtn.disabled) {
      var shell = pageBtn.closest('.ld-table-shell');
      var table = shell && shell.querySelector('table[data-ld-table]');
      if (table) {
        tableSt(table).page = parseInt(pageBtn.getAttribute('data-ld-table-page'), 10);
        tableApply(table, 'page');
        var again = shell.querySelector('[aria-current="page"]');
        if (again) again.focus();
      }
    }
  });

  document.addEventListener('change', function (e) {
    var box = e.target;
    if (!box.matches || !box.matches('[data-ld-table-rowselect], [data-ld-table-selectall]')) return;
    var table = box.closest('table[data-ld-table]');
    var st = table && tableSt(table);
    if (!st) return;
    if (box.hasAttribute('data-ld-table-selectall')) {
      var matched = tableMatches(st);
      matched.forEach(function (row) { if (box.checked) st.selected.add(row); else st.selected.delete(row); });
    } else {
      var row = box.closest('tr');
      if (box.checked) st.selected.add(row); else st.selected.delete(row);
    }
    tableEmitSelect(table);
  });

  moduleInits.push(initTables);
  window.ldcss.table = {
    refresh: refreshTable,
    selected: function (el) { var st = tableSt(tableRef(el)); return st ? Array.from(st.selected) : []; },
    clearSelection: function (el) { el = tableRef(el); var st = tableSt(el); if (st) { st.selected.clear(); tableEmitSelect(el); } },
    search: function (el, q) { el = tableRef(el); var st = tableSt(el); st.query = q; st.page = 1; if (st.searchInput) st.searchInput.value = q; tableApply(el, 'search'); },
    page: function (el, n) { el = tableRef(el); tableSt(el).page = n; tableApply(el, 'page'); }
  };

