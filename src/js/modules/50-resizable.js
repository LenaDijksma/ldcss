  /* =====================================================================
     Resizable panels

       <div class="ld-resizable" data-ld-resizable style="height: 320px">
         <div class="ld-panel" data-ld-size="30" data-ld-min="15%">…</div>
         <div class="ld-panel">…</div>
       </div>

     Handles are inserted between panels for you (or put your own
     .ld-resize-handle in). Drag a handle, or focus it and use the arrow
     keys (Shift = bigger steps), Home / End (min / max), Enter (collapse
     or restore). Double-click resets.

     On the container   data-ld-direction="horizontal" (default) | "vertical"
                        data-ld-persist="key"   remember sizes in localStorage
     On a panel         data-ld-size="30"       starting size, in percent
                        data-ld-min / data-ld-max   "20%", "160px" or a number (px)
     Events (on the container): ld:resize:start, :move, :end
       detail → { sizes: [percent, …], handle: index }
     API: ldcss.resizable.get(el) / .set(el, [30, 70]) / .reset(el)
     ===================================================================== */

  var resizeDrag = null;

  function resizeParts(box) {
    var panels = [], handles = [];
    Array.prototype.forEach.call(box.children, function (child) {
      if (child.classList.contains('ld-panel')) panels.push(child);
      else if (child.classList.contains('ld-resize-handle')) handles.push(child);
    });
    return { panels: panels, handles: handles };
  }

  function resizeIsVertical(box) {
    return box.getAttribute('data-ld-direction') === 'vertical';
  }

  /* pixels left for panels once the handles have taken theirs */
  function resizeAvailable(box) {
    var parts = resizeParts(box), vertical = resizeIsVertical(box);
    var total = vertical ? box.clientHeight : box.clientWidth;
    parts.handles.forEach(function (h) { total -= vertical ? h.offsetHeight : h.offsetWidth; });
    return Math.max(1, total);
  }

  function resizeLimit(panel, attr, avail, fallback) {
    var raw = panel.getAttribute(attr);
    if (raw == null || raw === '') return fallback;
    var n = parseFloat(raw);
    if (isNaN(n)) return fallback;
    return /%\s*$/.test(raw) ? n / 100 : n / avail;
  }

  function resizeSizes(box) {
    return (box._ldSizes || []).slice();
  }

  function resizePercent(box) {
    return resizeSizes(box).map(function (f) { return Math.round(f * 1000) / 10; });
  }

  function resizeApply(box, sizes) {
    var parts = resizeParts(box);
    box._ldSizes = sizes;
    parts.panels.forEach(function (panel, i) { panel.style.flex = sizes[i] + ' 1 0%'; });
    resizeSyncAria(box);
  }

  function resizeSyncAria(box) {
    var parts = resizeParts(box), avail = resizeAvailable(box), sizes = box._ldSizes || [];
    parts.handles.forEach(function (handle, i) {
      var prev = parts.panels[i], next = parts.panels[i + 1];
      if (!prev || !next) return;
      var sum = sizes[i] + sizes[i + 1];
      var lo = Math.max(resizeLimit(prev, 'data-ld-min', avail, 0), sum - resizeLimit(next, 'data-ld-max', avail, 1));
      var hi = Math.min(resizeLimit(prev, 'data-ld-max', avail, 1), sum - resizeLimit(next, 'data-ld-min', avail, 0));
      handle.setAttribute('aria-valuenow', String(Math.round(sizes[i] * 100)));
      handle.setAttribute('aria-valuemin', String(Math.round(lo * 100)));
      handle.setAttribute('aria-valuemax', String(Math.round(hi * 100)));
    });
  }

  /* move the boundary at handle `index` so the panel before it is `want` (fraction) */
  function resizeMove(box, index, want) {
    var parts = resizeParts(box), avail = resizeAvailable(box), sizes = resizeSizes(box);
    var prev = parts.panels[index], next = parts.panels[index + 1];
    if (!prev || !next) return false;
    var sum = sizes[index] + sizes[index + 1];
    var lo = Math.max(resizeLimit(prev, 'data-ld-min', avail, 0), sum - resizeLimit(next, 'data-ld-max', avail, 1));
    var hi = Math.min(resizeLimit(prev, 'data-ld-max', avail, 1), sum - resizeLimit(next, 'data-ld-min', avail, 0));
    if (lo > hi) return false;
    var clamped = Math.min(hi, Math.max(lo, want));
    if (Math.abs(clamped - sizes[index]) < 1e-6) return false;
    sizes[index] = clamped;
    sizes[index + 1] = sum - clamped;
    resizeApply(box, sizes);
    return true;
  }

  function resizeSave(box) {
    var key = box.getAttribute('data-ld-persist');
    if (!key) return;
    try { localStorage.setItem('ld-resizable:' + key, JSON.stringify(box._ldSizes)); } catch (err) { /* ignore */ }
  }

  function resizeInitialSizes(box) {
    var parts = resizeParts(box), n = parts.panels.length;
    var key = box.getAttribute('data-ld-persist');
    if (key) {
      try {
        var saved = JSON.parse(localStorage.getItem('ld-resizable:' + key) || 'null');
        if (Array.isArray(saved) && saved.length === n) return saved;
      } catch (err) { /* ignore */ }
    }
    var wanted = parts.panels.map(function (p) { var v = parseFloat(p.getAttribute('data-ld-size')); return isNaN(v) ? null : v / 100; });
    var used = wanted.reduce(function (a, v) { return a + (v || 0); }, 0);
    var open = wanted.filter(function (v) { return v === null; }).length;
    var share = open ? Math.max(0, 1 - used) / open : 0;
    var sizes = wanted.map(function (v) { return v === null ? share : v; });
    var total = sizes.reduce(function (a, v) { return a + v; }, 0) || 1;
    return sizes.map(function (v) { return v / total; });
  }

  defineComponent('resizable', '[data-ld-resizable]', function (box, scope) {
    box._ldResizable = true;
    box._ldAddedClass = !box.classList.contains('ld-resizable');
    box.classList.add('ld-resizable');
    var vertical = resizeIsVertical(box);
    var parts = resizeParts(box);

    // put a handle between every pair of panels that does not have one
    parts.panels.forEach(function (panel, i) {
      var after = panel.nextElementSibling;
      if (i < parts.panels.length - 1 && !(after && after.classList.contains('ld-resize-handle'))) {
        var handle = document.createElement('div');
        handle.className = 'ld-resize-handle';
        box.insertBefore(handle, panel.nextSibling);
        scope.add(handle);
      }
    });
    parts = resizeParts(box);
    parts.handles.forEach(function (handle, i) {
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-orientation', vertical ? 'horizontal' : 'vertical');
      handle.setAttribute('tabindex', '0');
      if (!handle.hasAttribute('aria-label')) handle.setAttribute('aria-label', box.getAttribute('data-ld-label') || 'Resize panels');
      if (parts.panels[i]) handle.setAttribute('aria-controls', ensureId(parts.panels[i], 'ld-panel'));
    });
    box._ldInitial = resizeInitialSizes(box);
    box._ldInitialDefault = null;
    resizeApply(box, box._ldInitial.slice());
  }, function (box) {
    if (resizeDrag && resizeDrag.box === box) resizeEnd();
    resizeParts(box).panels.forEach(function (panel) { panel.style.flex = ''; });
    resizeParts(box).handles.forEach(function (handle) {
      ['role', 'aria-orientation', 'tabindex', 'aria-controls', 'aria-valuenow', 'aria-valuemin', 'aria-valuemax'].forEach(function (a) { handle.removeAttribute(a); });
    });
    if (box._ldAddedClass) box.classList.remove('ld-resizable');
    box._ldResizable = false;
    box._ldSizes = null;
  }, { gate: true });

  function resizeStart(e) {
    var handle = e.target.closest && closestOf(e.target, '.ld-resize-handle');
    var box = handle && handle.parentElement;
    if (!box || !box._ldResizable || e.button > 0) return;
    var parts = resizeParts(box), vertical = resizeIsVertical(box);
    var index = parts.handles.indexOf(handle);
    if (index === -1) return;
    e.preventDefault();
    handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
    resizeDrag = {
      box: box, handle: handle, index: index, vertical: vertical,
      start: vertical ? e.clientY : e.clientX,
      startPrev: box._ldSizes[index], avail: resizeAvailable(box),
      rtl: !vertical && getComputedStyle(box).direction === 'rtl', moved: false
    };
    box.setAttribute('data-ld-resizing', 'true');
    document.documentElement.classList.add('ld-resizing');
    document.documentElement.setAttribute('data-ld-resize-axis', vertical ? 'vertical' : 'horizontal');
    emit(box, 'ld:resize:start', { sizes: resizePercent(box), handle: index });
  }

  function resizeDragMove(e) {
    if (!resizeDrag) return;
    var d = resizeDrag;
    var delta = ((d.vertical ? e.clientY : e.clientX) - d.start) / d.avail;
    if (d.rtl) delta = -delta;
    if (resizeMove(d.box, d.index, d.startPrev + delta)) {
      d.moved = true;
      emit(d.box, 'ld:resize:move', { sizes: resizePercent(d.box), handle: d.index });
    }
  }

  function resizeEnd() {
    if (!resizeDrag) return;
    var d = resizeDrag;
    resizeDrag = null;
    d.box.removeAttribute('data-ld-resizing');
    document.documentElement.classList.remove('ld-resizing');
    document.documentElement.removeAttribute('data-ld-resize-axis');
    if (d.moved) resizeSave(d.box);
    emit(d.box, 'ld:resize:end', { sizes: resizePercent(d.box), handle: d.index });
  }

  delegate('pointerdown', resizeStart);
  delegate('pointermove', resizeDragMove);
  delegate('pointerup', resizeEnd);
  delegate('pointercancel', resizeEnd);

  delegate('dblclick', function (e) {
    var handle = e.target.closest && closestOf(e.target, '.ld-resize-handle');
    var box = handle && handle.parentElement;
    if (!box || !box._ldResizable) return;
    resizeApply(box, box._ldInitial.slice());
    resizeSave(box);
    emit(box, 'ld:resize:end', { sizes: resizePercent(box), handle: resizeParts(box).handles.indexOf(handle), reset: true });
  });

  delegate('keydown', function (e) {
    var handle = e.target.closest && closestOf(e.target, '.ld-resize-handle');
    var box = handle && handle.parentElement;
    if (!box || !box._ldResizable) return;
    var parts = resizeParts(box), index = parts.handles.indexOf(handle), vertical = resizeIsVertical(box);
    var rtl = !vertical && getComputedStyle(box).direction === 'rtl';
    var step = e.shiftKey ? 0.1 : 0.02, change = 0, sizes = resizeSizes(box);
    var grow = vertical ? 'ArrowDown' : (rtl ? 'ArrowLeft' : 'ArrowRight');
    var shrink = vertical ? 'ArrowUp' : (rtl ? 'ArrowRight' : 'ArrowLeft');
    if (e.key === grow) change = step;
    else if (e.key === shrink) change = -step;
    else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      resizeMove(box, index, e.key === 'Home' ? -1 : 2);
      resizeSave(box);
      emit(box, 'ld:resize:end', { sizes: resizePercent(box), handle: index });
      return;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // collapse the panel before the handle, or put it back
      if (handle._ldRestore != null) { resizeMove(box, index, handle._ldRestore); handle._ldRestore = null; }
      else { handle._ldRestore = sizes[index]; resizeMove(box, index, -1); }
      resizeSave(box);
      emit(box, 'ld:resize:end', { sizes: resizePercent(box), handle: index });
      return;
    } else return;
    e.preventDefault();
    if (resizeMove(box, index, sizes[index] + change)) {
      resizeSave(box);
      emit(box, 'ld:resize:move', { sizes: resizePercent(box), handle: index });
      emit(box, 'ld:resize:end', { sizes: resizePercent(box), handle: index });
    }
  });

  delegateWindow('resize', function () {
    qsaSelf(document, '[data-ld-resizable]').forEach(function (box) { if (box._ldSizes) resizeSyncAria(box); });
  });

  window.ldcss.resizable = {
    get: function (el) { return resizePercent(typeof el === 'string' ? document.querySelector(el) : el); },
    set: function (el, percents) {
      el = typeof el === 'string' ? document.querySelector(el) : el;
      var total = percents.reduce(function (a, v) { return a + v; }, 0) || 1;
      resizeApply(el, percents.map(function (v) { return v / total; }));
      resizeSave(el);
    },
    reset: function (el) {
      el = typeof el === 'string' ? document.querySelector(el) : el;
      resizeApply(el, el._ldInitial.slice());
      resizeSave(el);
    }
  };

