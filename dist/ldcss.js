/*! ldcss.js v3.1.1 — MIT */
/*!
 * ldcss.js — Lena Dijksma CSS
 * Zero-dependency behavior for data-ld-* interactive components.
 * Components: theme toggle, dropdown, popover, tabs, accordion, modal,
 * offcanvas, command palette, toast, copy-to-clipboard, dropzone, rating,
 * tag input, progress bars, entrance animations, segmented control,
 * filter chips, stepper, combobox, scrollspy, carousel, navbar collapse,
 * sidebar menu (closes on link click / Escape),
 * input clear button, password toggle, autosizing textarea, sortable
 * table headers.
 *
 * Events: modal/offcanvas/command/dropdown/popover/accordion/tab/carousel
 * dispatch CustomEvents on the element itself — ld:{component}:show and
 * ld:{component}:hide — bubbling, so a single listener higher up the
 * DOM can react to any instance:
 *   document.addEventListener('ld:modal:show', function (e) {
 *     console.log('opened', e.target, e.detail.trigger);
 *   });
 * detail.trigger is the element that caused the change (the clicked
 * button, or null for programmatic calls) where applicable.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ld-theme';
  var lastFocusedEl = null;
  var activeAnimationObservers = [];

  /* Module registry — each file in src/js/modules/ adds an init function
     here. They run once at load, from ldcss.refresh(root), and for every
     element the mutation observer sees being added. */
  var moduleInits = [];
  var wildcardListeners = [];
  var listenerRegistry = [];

  /* matches + descendants: lets init functions see an added root itself */
  function qsaSelf(root, selector) {
    var scope = root || document;
    var found = Array.prototype.slice.call(scope.querySelectorAll(selector));
    if (scope.nodeType === 1 && scope.matches && scope.matches(selector)) found.unshift(scope);
    return found;
  }

  /* Unified event dispatch. Every ldcss event is a bubbling CustomEvent named
     ld:<component>:<event> whose detail carries what changed. Pass
     cancelable = true for "before" events; the return value is false when a
     listener called preventDefault(). */
  function emit(el, name, detail, cancelable) {
    if (!el) return true;
    var evt = new CustomEvent(name, { bubbles: true, cancelable: !!cancelable, detail: detail || {} });
    var notCancelled = el.dispatchEvent(evt);
    wildcardListeners.slice().forEach(function (fn) {
      try { fn(evt); } catch (err) { console.error('ldcss listener error', err); }
    });
    return notCancelled;
  }

  function fullEventName(type) {
    return type.indexOf('ld:') === 0 ? type : 'ld:' + type;
  }

  function matchesTarget(e, selector) {
    return !selector || (e.target && e.target.closest && e.target.closest(selector));
  }

  /* ldcss.on('modal:show', fn)               every modal
     ldcss.on('toast:show', fn, {target:'#a'}) only inside #a
     ldcss.on('*', fn)                          every ldcss event
     Returns an unsubscribe function. */
  function on(type, handler, options) {
    options = options || {};
    var entry = { type: type, handler: handler };
    var listener = function (e) {
      if (!matchesTarget(e, options.target)) return;
      if (options.once) entry.off();
      handler(e, e.detail);
    };
    if (type === '*') {
      wildcardListeners.push(listener);
      entry.off = function () {
        var i = wildcardListeners.indexOf(listener);
        if (i !== -1) wildcardListeners.splice(i, 1);
      };
    } else {
      var name = fullEventName(type);
      var root = options.root || document;
      root.addEventListener(name, listener);
      entry.off = function () { root.removeEventListener(name, listener); };
    }
    listenerRegistry.push(entry);
    return entry.off;
  }

  function off(type, handler) {
    listenerRegistry = listenerRegistry.filter(function (entry) {
      if (entry.type !== type || (handler && entry.handler !== handler)) return true;
      entry.off();
      return false;
    });
  }

  function once(type, handler, options) {
    options = options || {};
    options.once = true;
    return on(type, handler, options);
  }

  /* Screen-reader announcements through two shared live regions. */
  var liveRegions = {};
  function announce(message, politeness) {
    politeness = politeness === 'assertive' ? 'assertive' : 'polite';
    var region = liveRegions[politeness];
    if (!region || !region.isConnected) {
      region = document.createElement('div');
      region.className = 'ld-sr-only';
      region.setAttribute('aria-live', politeness);
      region.setAttribute('aria-atomic', 'true');
      region.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
      document.body.appendChild(region);
      liveRegions[politeness] = region;
    }
    // clear first so announcing the same sentence twice still triggers
    region.textContent = '';
    setTimeout(function () { region.textContent = message; }, 50);
  }

  function uid(prefix) {
    uid.n = (uid.n || 0) + 1;
    return (prefix || 'ld') + '-' + uid.n;
  }

  /* Make sure an element has an id (for aria-controls / aria-activedescendant). */
  function ensureId(el, prefix) {
    if (!el.id) el.id = uid(prefix);
    return el.id;
  }

  /* ---------------------------------------------------------------------
     Theme
     ------------------------------------------------------------------- */

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved) {
      document.documentElement.setAttribute('data-ld-theme', saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // No explicit choice saved yet — match the OS/browser preference.
      // A saved choice (from toggleTheme) always wins over this on
      // future visits, this only fires the very first time.
      document.documentElement.setAttribute('data-ld-theme', 'dark');
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-ld-theme') || 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-ld-theme', next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
  }

  /* ---------------------------------------------------------------------
     Dropdown / Popover — share the same open/close-on-outside-click logic
     ------------------------------------------------------------------- */

  function closeAllFloating(panelAttr, except) {
    document.querySelectorAll('[' + panelAttr + '].ld-show').forEach(function (el) {
      if (el !== except) {
        el.classList.remove('ld-show');
        emit(el, floatingEventName(panelAttr, 'hide'), {});
      }
    });
  }

  function floatingEventName(panelAttr, phase) {
    return panelAttr === 'data-ld-dropdown-menu' ? 'ld:dropdown:' + phase : 'ld:popover:' + phase;
  }

  function toggleFloating(trigger, panelAttr, toggleKind) {
    var targetSel = trigger.getAttribute('data-ld-target');
    var panel = targetSel ? document.querySelector(targetSel) : trigger.parentElement.querySelector('[' + panelAttr + ']');
    if (!panel) return;
    var isOpen = panel.classList.contains('ld-show');
    closeAllFloating(panelAttr);
    document.querySelectorAll('[data-ld-toggle="' + toggleKind + '"]').forEach(function (t) {
      t.setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      panel.classList.add('ld-show');
      panel._ldTrigger = trigger;
      trigger.setAttribute('aria-expanded', 'true');
      emit(panel, floatingEventName(panelAttr, 'show'), { trigger: trigger });
    }
  }

  function closeAllDropdowns() { closeAllFloating('data-ld-dropdown-menu'); }
  function closeAllPopovers() { closeAllFloating('data-ld-popover-content'); }

  /* ---------------------------------------------------------------------
     Tabs
     ------------------------------------------------------------------- */

  function handleTabToggle(trigger) {
    var targetSel = trigger.getAttribute('data-ld-target');
    var panel = targetSel ? document.querySelector(targetSel) : null;
    var tabGroup = trigger.closest('[data-ld-tabs]');
    if (!panel || !tabGroup) return;

    var panelGroupSel = tabGroup.getAttribute('data-ld-panels');
    var panelGroup = panelGroupSel ? document.querySelector(panelGroupSel) : panel.parentElement;

    tabGroup.querySelectorAll('[data-ld-toggle="tab"]').forEach(function (t) {
      t.setAttribute('data-ld-active', 'false');
      t.setAttribute('aria-selected', 'false');
    });
    trigger.setAttribute('data-ld-active', 'true');
    trigger.setAttribute('aria-selected', 'true');

    if (panelGroup) {
      panelGroup.querySelectorAll('[data-ld-tab-panel]').forEach(function (p) {
        p.classList.remove('ld-show');
        p.setAttribute('aria-hidden', 'true');
      });
    }
    panel.classList.add('ld-show');
    panel.setAttribute('aria-hidden', 'false');
    emit(panel, 'ld:tab:show', { trigger: trigger });
  }

  /* ---------------------------------------------------------------------
     Accordion
     ------------------------------------------------------------------- */

  function handleAccordionToggle(trigger) {
    var targetSel = trigger.getAttribute('data-ld-target');
    var panel = targetSel ? document.querySelector(targetSel) : null;
    if (!panel) return;

    var wrapper = trigger.closest('[data-ld-accordion]');
    var isOpen = panel.classList.contains('ld-show');

    if (wrapper && wrapper.getAttribute('data-ld-accordion') === 'single') {
      wrapper.querySelectorAll('[data-ld-accordion-panel].ld-show').forEach(function (p) {
        p.classList.remove('ld-show');
        p.setAttribute('aria-hidden', 'true');
      });
      wrapper.querySelectorAll('.ld-accordion-trigger').forEach(function (t) {
        t.setAttribute('data-ld-active', 'false');
        t.setAttribute('aria-expanded', 'false');
      });
    }

    panel.classList.toggle('ld-show', !isOpen);
    panel.setAttribute('aria-hidden', String(isOpen));
    trigger.setAttribute('data-ld-active', String(!isOpen));
    trigger.setAttribute('aria-expanded', String(!isOpen));
    emit(panel, isOpen ? 'ld:accordion:hide' : 'ld:accordion:show', { trigger: trigger });
  }

  /* ---------------------------------------------------------------------
     Progress bars — read data-ld-value (0-100) into bar width
     ------------------------------------------------------------------- */

  function initProgressBars(root) {
    qsaSelf(root, '[data-ld-progress]').forEach(function (bar) {
      var val = parseFloat(bar.getAttribute('data-ld-value'));
      if (isNaN(val)) val = 0;
      val = Math.max(0, Math.min(100, val));
      bar.style.width = val + '%';
      bar.setAttribute('aria-valuenow', val);
    });
  }

  /* ---------------------------------------------------------------------
     Entrance animations — [data-ld-animate]
     CSS already shows everything immediately under prefers-reduced-motion,
     so this skips the observer entirely in that case rather than firing it
     and having the "animation" be an instant no-op transition.
     ------------------------------------------------------------------- */

  function initAnimations(root) {
    var els = qsaSelf(root, '[data-ld-animate]');
    if (!els.length) return;

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      els.forEach(function (el) { el.classList.add('ld-in-view'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('ld-in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    activeAnimationObservers.push(observer);
    els.forEach(function (el) { observer.observe(el); });
  }

  /* ---------------------------------------------------------------------
     Copy to clipboard
     ------------------------------------------------------------------- */

  function handleCopy(trigger) {
    var text = trigger.getAttribute('data-ld-copy');
    if (!text) {
      var targetSel = trigger.getAttribute('data-ld-target');
      var source = targetSel ? document.querySelector(targetSel) : null;
      text = source ? source.textContent.trim() : '';
    }
    if (!text) return;

    var finish = function () {
      var original = trigger.getAttribute('data-ld-original-label');
      if (original === null) {
        original = trigger.textContent;
        trigger.setAttribute('data-ld-original-label', original);
      }
      trigger.textContent = 'Copied';
      announce('Copied to clipboard');
      trigger.setAttribute('data-ld-copied', 'true');
      clearTimeout(trigger._ldCopyTimeout);
      trigger._ldCopyTimeout = setTimeout(function () {
        trigger.textContent = trigger.getAttribute('data-ld-original-label');
        trigger.removeAttribute('data-ld-copied');
      }, 1500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(finish, finish);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      finish();
    }
  }

  /* ---------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------- */

  /* Toasts and the notification centre live in src/js/modules/40-toast-notifications.js */

  /* ---------------------------------------------------------------------
     Focus trap helper — shared by modal, offcanvas, command palette
     ------------------------------------------------------------------- */

  function getFocusable(container) {
    var nodes = container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    return Array.prototype.slice.call(nodes);
  }

  function getOpenOverlay() {
    return document.querySelector('.ld-modal-backdrop.ld-show, .ld-offcanvas-backdrop.ld-show, .ld-command-backdrop.ld-show');
  }

  function trapTab(e) {
    if (e.key !== 'Tab') return;
    var overlay = getOpenOverlay();
    if (!overlay) return;
    var focusables = getFocusable(overlay);
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function returnFocus() {
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
      lastFocusedEl.focus();
    }
    lastFocusedEl = null;
  }

  /* ---------------------------------------------------------------------
     Modal
     ------------------------------------------------------------------- */

  function openModal(targetSel, trigger) {
    var backdrop = document.querySelector(targetSel);
    if (!backdrop) return;
    lastFocusedEl = trigger || document.activeElement;
    var box = backdrop.querySelector('.ld-modal');
    if (box) {
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
    }
    backdrop.classList.add('ld-show');
    var focusable = backdrop.querySelector('[data-ld-autofocus]') || backdrop.querySelector('button, input, a');
    if (focusable) focusable.focus();
    emit(backdrop, 'ld:modal:show', { trigger: trigger || null });
  }

  function closeModal(backdrop) {
    backdrop.classList.remove('ld-show');
    returnFocus();
    emit(backdrop, 'ld:modal:hide', {});
  }

  function closeAllModals() {
    document.querySelectorAll('.ld-modal-backdrop.ld-show').forEach(closeModal);
  }

  /* ---------------------------------------------------------------------
     Offcanvas
     ------------------------------------------------------------------- */

  function openOffcanvas(targetSel, trigger) {
    var backdrop = document.querySelector(targetSel);
    if (!backdrop) return;
    lastFocusedEl = trigger || document.activeElement;
    var panel = backdrop.querySelector('.ld-offcanvas');
    if (panel) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
    }
    backdrop.classList.add('ld-show');
    var focusable = backdrop.querySelector('[data-ld-autofocus]') || backdrop.querySelector('button, input, a');
    if (focusable) focusable.focus();
    emit(backdrop, 'ld:offcanvas:show', { trigger: trigger || null });
  }

  function closeOffcanvas(backdrop) {
    backdrop.classList.remove('ld-show');
    returnFocus();
    emit(backdrop, 'ld:offcanvas:hide', {});
  }

  function closeAllOffcanvas() {
    document.querySelectorAll('.ld-offcanvas-backdrop.ld-show').forEach(closeOffcanvas);
  }

  /* ---------------------------------------------------------------------
     Command palette
     ------------------------------------------------------------------- */

  function highlightCommandItem(list, index) {
    var items = Array.prototype.slice.call(list.querySelectorAll('[data-ld-command-item]:not(.ld-hide)'));
    items.forEach(function (item) { item.removeAttribute('data-ld-highlighted'); });
    if (items[index]) {
      items[index].setAttribute('data-ld-highlighted', 'true');
      items[index].scrollIntoView({ block: 'nearest' });
    }
    return items;
  }

  function filterCommandList(backdrop, query) {
    var list = backdrop.querySelector('[data-ld-command-list]');
    var empty = backdrop.querySelector('.ld-command-empty');
    if (!list) return;
    var q = query.trim().toLowerCase();
    var visibleCount = 0;
    list.querySelectorAll('[data-ld-command-item]').forEach(function (item) {
      var match = !q || item.textContent.toLowerCase().indexOf(q) !== -1;
      item.classList.toggle('ld-hide', !match);
      if (match) visibleCount++;
    });
    if (empty) empty.classList.toggle('ld-show', visibleCount === 0);
    highlightCommandItem(list, 0);
  }

  function openCommand(targetSel, trigger) {
    var backdrop = targetSel ? document.querySelector(targetSel) : document.querySelector('.ld-command-backdrop');
    if (!backdrop) return;
    lastFocusedEl = trigger || document.activeElement;
    backdrop.classList.add('ld-show');
    var input = backdrop.querySelector('.ld-command-input');
    if (input) {
      input.value = '';
      filterCommandList(backdrop, '');
      input.focus();
    }
    emit(backdrop, 'ld:command:show', { trigger: trigger || null });
  }

  function closeCommand(backdrop) {
    backdrop.classList.remove('ld-show');
    returnFocus();
    emit(backdrop, 'ld:command:hide', {});
  }

  function closeAllCommands() {
    document.querySelectorAll('.ld-command-backdrop.ld-show').forEach(closeCommand);
  }

  function runCommandAction(item) {
    var action = item.getAttribute('data-ld-command-action');
    if (!action) return;
    var sep = action.indexOf(':');
    var type = sep === -1 ? action : action.slice(0, sep);
    var arg = sep === -1 ? '' : action.slice(sep + 1);
    if (type === 'theme') {
      toggleTheme();
    } else if (type === 'toast') {
      showToast(arg || 'Done', 'success');
    } else if (type === 'offcanvas') {
      openOffcanvas(arg);
    } else if (type === 'modal') {
      openModal(arg);
    } else if (type === 'goto') {
      runGotoAction(arg);
    }
  }

  /* data-ld-command-action="goto:#section" scrolls to an in-page anchor
     (smoothly, unless the person prefers reduced motion), updates the URL,
     and moves focus to the target for keyboard/screen-reader users — the
     same landing behavior a real link click gets. Anything not starting
     with "#" is treated as a normal page URL and just navigates there,
     e.g. "goto:/pricing" or "goto:https://example.com". */
  function runGotoAction(arg) {
    if (!arg) return;
    if (arg.charAt(0) === '#') {
      var targetEl;
      try { targetEl = document.querySelector(arg); } catch (err) { targetEl = null; }
      if (!targetEl) return;
      var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      targetEl.scrollIntoView(reduceMotion ? { block: 'start' } : { behavior: 'smooth', block: 'start' });
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', arg);
      } else {
        window.location.hash = arg;
      }
      if (!targetEl.hasAttribute('tabindex')) targetEl.setAttribute('tabindex', '-1');
      targetEl.focus({ preventScroll: true });
    } else {
      window.location.href = arg;
    }
  }

  function handleCommandKeydown(e) {
    var backdrop = e.target.closest('.ld-command-backdrop');
    if (!backdrop) return;
    var list = backdrop.querySelector('[data-ld-command-list]');
    if (!list) return;
    var items = Array.prototype.slice.call(list.querySelectorAll('[data-ld-command-item]:not(.ld-hide)'));
    var currentIndex = items.findIndex(function (i) { return i.getAttribute('data-ld-highlighted') === 'true'; });

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightCommandItem(list, Math.min(items.length - 1, currentIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightCommandItem(list, Math.max(0, currentIndex - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var chosen = items[currentIndex] || items[0];
      if (chosen) chosen.click();
    }
  }

  /* ---------------------------------------------------------------------
     List group — clicking an interactive item selects it
     ------------------------------------------------------------------- */

  function handleListItemClick(item) {
    var list = item.closest('.ld-list');
    if (!list) return;
    list.querySelectorAll('.ld-list-item').forEach(function (li) {
      li.removeAttribute('data-ld-active');
    });
    item.setAttribute('data-ld-active', 'true');
  }

  /* ---------------------------------------------------------------------
     Pagination
     ------------------------------------------------------------------- */

  function getPaginationPages(pagination) {
    return Array.prototype.slice.call(pagination.querySelectorAll('li:not([data-ld-page])'));
  }

  function updatePaginationBounds(pagination, pages, index) {
    var prevBtn = pagination.querySelector('li[data-ld-page="prev"] button');
    var nextBtn = pagination.querySelector('li[data-ld-page="next"] button');
    if (prevBtn) prevBtn.disabled = index <= 0;
    if (nextBtn) nextBtn.disabled = index >= pages.length - 1;
  }

  function getPaginatedItems(target) {
    if (!target) return [];
    if (target.tagName === 'TABLE') {
      var tbody = target.querySelector('tbody');
      return tbody ? Array.prototype.slice.call(tbody.children) : [];
    }
    return Array.prototype.slice.call(target.children);
  }

  function showPaginationPage(target, items, pageSize, pageIndex) {
    items.forEach(function (item, i) {
      item.style.display = Math.floor(i / pageSize) === pageIndex ? '' : 'none';
    });
    if (target) target.setAttribute('data-ld-page-index', String(pageIndex));
  }

  function buildPaginationButtons(pagination, totalPages) {
    pagination.innerHTML = '';

    var prevLi = document.createElement('li');
    prevLi.setAttribute('data-ld-page', 'prev');
    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.textContent = '‹';
    prevBtn.setAttribute('aria-label', 'Previous page');
    prevLi.appendChild(prevBtn);
    pagination.appendChild(prevLi);

    for (var i = 0; i < totalPages; i++) {
      var li = document.createElement('li');
      if (i === 0) li.setAttribute('data-ld-active', 'true');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(i + 1);
      li.appendChild(btn);
      pagination.appendChild(li);
    }

    var nextLi = document.createElement('li');
    nextLi.setAttribute('data-ld-page', 'next');
    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.textContent = '›';
    nextBtn.setAttribute('aria-label', 'Next page');
    nextLi.appendChild(nextBtn);
    pagination.appendChild(nextLi);
  }

  function renderAutoPagination(pagination) {
    var targetSel = pagination.getAttribute('data-ld-paginate');
    var target = document.querySelector(targetSel);
    if (!target) return;

    var pageSize = parseInt(pagination.getAttribute('data-ld-page-size'), 10) || 10;
    var items = getPaginatedItems(target);
    var totalPages = Math.max(1, Math.ceil(items.length / pageSize));

    buildPaginationButtons(pagination, totalPages);
    showPaginationPage(target, items, pageSize, 0);
    updatePaginationBounds(pagination, getPaginationPages(pagination), 0);
  }

  function handlePaginationClick(button) {
    if (button.disabled) return;
    var li = button.closest('li');
    var pagination = li ? li.closest('.ld-pagination') : null;
    if (!li || !pagination) return;

    var pages = getPaginationPages(pagination);
    var currentIndex = pages.findIndex(function (p) { return p.getAttribute('data-ld-active') === 'true'; });
    var role = li.getAttribute('data-ld-page');
    var targetIndex = currentIndex;

    if (role === 'prev') targetIndex = currentIndex - 1;
    else if (role === 'next') targetIndex = currentIndex + 1;
    else targetIndex = pages.indexOf(li);

    if (targetIndex < 0 || targetIndex >= pages.length) return;

    pages.forEach(function (p, i) { p.setAttribute('data-ld-active', i === targetIndex ? 'true' : 'false'); });
    updatePaginationBounds(pagination, pages, targetIndex);

    var targetSel = pagination.getAttribute('data-ld-paginate');
    if (targetSel) {
      var target = document.querySelector(targetSel);
      var pageSize = parseInt(pagination.getAttribute('data-ld-page-size'), 10) || 10;
      if (target) showPaginationPage(target, getPaginatedItems(target), pageSize, targetIndex);
    }
  }

  function initPagination(root) {
    qsaSelf(root, '.ld-pagination').forEach(function (pagination) {
      if (pagination.getAttribute('data-ld-paginate')) {
        renderAutoPagination(pagination);
        return;
      }
      var pages = getPaginationPages(pagination);
      var currentIndex = pages.findIndex(function (p) { return p.getAttribute('data-ld-active') === 'true'; });
      if (currentIndex === -1 && pages.length) {
        currentIndex = 0;
        pages[0].setAttribute('data-ld-active', 'true');
      }
      updatePaginationBounds(pagination, pages, currentIndex);
    });
  }

  /* ---------------------------------------------------------------------
     Dropzone
     ------------------------------------------------------------------- */

  function handleDropzoneClick(e) {
    var zone = e.target.closest('[data-ld-dropzone]');
    if (!zone || e.target.tagName === 'INPUT') return;
    var input = zone.querySelector('input[type="file"]');
    if (input) input.click();
  }

  function handleDropzoneDragOver(e) {
    var zone = e.target.closest('[data-ld-dropzone]');
    if (!zone) return;
    e.preventDefault();
    zone.setAttribute('data-ld-active', 'true');
  }

  function handleDropzoneDragLeave(e) {
    var zone = e.target.closest('[data-ld-dropzone]');
    if (!zone) return;
    zone.removeAttribute('data-ld-active');
  }

  function handleDropzoneDrop(e) {
    var zone = e.target.closest('[data-ld-dropzone]');
    if (!zone) return;
    e.preventDefault();
    zone.removeAttribute('data-ld-active');
    var files = e.dataTransfer && e.dataTransfer.files;
    var input = zone.querySelector('input[type="file"]');
    if (files && files.length && input) {
      try { input.files = files; } catch (err) {}
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var labelSel = zone.getAttribute('data-ld-dropzone-label');
    var label = labelSel ? document.querySelector(labelSel) : zone.querySelector('[data-ld-dropzone-filename]');
    if (label && files && files.length) {
      label.textContent = files.length === 1 ? files[0].name : files.length + ' files selected';
    }
  }

  /* ---------------------------------------------------------------------
     Rating
     ------------------------------------------------------------------- */

  function handleRatingClick(star) {
    var wrapper = star.closest('[data-ld-rating]');
    if (!wrapper) return;
    var stars = Array.prototype.slice.call(wrapper.querySelectorAll('[data-ld-star]'));
    var index = stars.indexOf(star);
    stars.forEach(function (s, i) {
      s.setAttribute('data-ld-active', i <= index ? 'true' : 'false');
      s.setAttribute('aria-pressed', i <= index ? 'true' : 'false');
    });
    wrapper.setAttribute('data-ld-value', String(index + 1));
  }

  function initRatings(root) {
    qsaSelf(root, '[data-ld-rating]').forEach(function (wrapper) {
      var value = parseInt(wrapper.getAttribute('data-ld-value'), 10) || 0;
      var stars = wrapper.querySelectorAll('[data-ld-star]');
      stars.forEach(function (s, i) {
        s.setAttribute('data-ld-active', i < value ? 'true' : 'false');
        s.setAttribute('role', 'button');
        s.setAttribute('aria-pressed', i < value ? 'true' : 'false');
      });
    });
  }

  /* ---------------------------------------------------------------------
     Tag input
     ------------------------------------------------------------------- */

  function addTag(wrapper, input, text) {
    text = text.trim();
    if (!text) return;
    var tag = document.createElement('span');
    tag.className = 'ld-tag';
    tag.setAttribute('data-ld-tag', '');

    var label = document.createElement('span');
    label.textContent = text;
    tag.appendChild(label);

    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ld-tag-remove';
    remove.setAttribute('data-ld-tag-remove', '');
    remove.setAttribute('aria-label', 'Remove ' + text);
    remove.textContent = '×';
    tag.appendChild(remove);

    wrapper.insertBefore(tag, input);
    input.value = '';
  }

  function handleTagsKeydown(e) {
    var input = e.target.closest('[data-ld-tags-input]');
    if (!input) return;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      var wrapper = input.closest('[data-ld-tags]');
      if (wrapper) addTag(wrapper, input, input.value);
    } else if (e.key === 'Backspace' && !input.value) {
      var wrap = input.closest('[data-ld-tags]');
      var tags = wrap ? wrap.querySelectorAll('.ld-tag, [data-ld-tag]') : [];
      if (tags.length) tags[tags.length - 1].remove();
    }
  }

  /* ---------------------------------------------------------------------
     Segmented control
     ------------------------------------------------------------------- */

  function handleSegmentToggle(item) {
    var group = item.closest('[data-ld-segmented]');
    if (!group) return;
    if (item.disabled || item.getAttribute('data-ld-disabled') === 'true') return;

    group.querySelectorAll('[data-ld-segment]').forEach(function (i) {
      i.setAttribute('data-ld-active', 'false');
      i.setAttribute('aria-pressed', 'false');
    });
    item.setAttribute('data-ld-active', 'true');
    item.setAttribute('aria-pressed', 'true');

    var targetSel = group.getAttribute('data-ld-target');
    if (targetSel) {
      var input = document.querySelector(targetSel);
      if (input) {
        input.value = item.getAttribute('data-ld-value') || item.textContent.trim();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  /* ---------------------------------------------------------------------
     Filter chips
     ------------------------------------------------------------------- */

  function handleChipToggle(chip) {
    var group = chip.closest('[data-ld-chips]');
    var isActive = chip.getAttribute('data-ld-active') === 'true';

    if (group && group.getAttribute('data-ld-chips') === 'single') {
      group.querySelectorAll('[data-ld-chip]').forEach(function (c) {
        c.setAttribute('data-ld-active', 'false');
      });
      chip.setAttribute('data-ld-active', 'true');
    } else {
      chip.setAttribute('data-ld-active', String(!isActive));
    }
  }

  /* ---------------------------------------------------------------------
     Stepper — programmatic API plus next/prev/clickable-step wiring
     ------------------------------------------------------------------- */

  function goToStep(stepper, index) {
    var steps = Array.prototype.slice.call(stepper.querySelectorAll('.ld-step'));
    if (index < 0 || index >= steps.length) return;

    steps.forEach(function (step, i) {
      step.setAttribute('data-ld-active', i === index ? 'true' : 'false');
      step.setAttribute('data-ld-complete', i < index ? 'true' : 'false');
    });
    stepper.setAttribute('data-ld-current', String(index));

    var panelsSel = stepper.getAttribute('data-ld-step-panels');
    var panelGroup = panelsSel ? document.querySelector(panelsSel) : null;
    if (panelGroup) {
      panelGroup.querySelectorAll('[data-ld-step-panel]').forEach(function (p, i) {
        p.classList.toggle('ld-show', i === index);
        p.setAttribute('aria-hidden', String(i !== index));
      });
    }
  }

  function currentStepIndex(stepper) {
    var steps = Array.prototype.slice.call(stepper.querySelectorAll('.ld-step'));
    var active = steps.findIndex(function (s) { return s.getAttribute('data-ld-active') === 'true'; });
    if (active !== -1) return active;
    var saved = parseInt(stepper.getAttribute('data-ld-current'), 10);
    return isNaN(saved) ? 0 : saved;
  }

  function handleStepClick(step) {
    var stepper = step.closest('[data-ld-stepper]');
    if (!stepper || stepper.getAttribute('data-ld-clickable') !== 'true') return;
    var steps = Array.prototype.slice.call(stepper.querySelectorAll('.ld-step'));
    goToStep(stepper, steps.indexOf(step));
  }

  function initSteppers(root) {
    qsaSelf(root, '[data-ld-stepper]').forEach(function (stepper) {
      goToStep(stepper, currentStepIndex(stepper));
    });
  }

  /* ---------------------------------------------------------------------
     Combobox / autocomplete
     ------------------------------------------------------------------- */

  /* The combobox (static, local-items and remote) lives in src/js/modules/45-combobox.js */

  /* ---------------------------------------------------------------------
     Roving tabindex — tabs and segmented control
     Only the active item in each group is a tab stop; Tab key jumps
     straight to the panel content, arrow keys move between options
     within the group (the same pattern browsers use for native radio
     buttons, and what the ARIA tabs/toolbar authoring practice expects).
     ------------------------------------------------------------------- */

  function initRovingTabindex(root) {
    qsaSelf(root, '[data-ld-tabs]').forEach(function (group) {
      var triggers = Array.prototype.slice.call(group.querySelectorAll('[data-ld-toggle="tab"]'));
      triggers.forEach(function (t) {
        t.setAttribute('tabindex', t.getAttribute('data-ld-active') === 'true' ? '0' : '-1');
      });
    });
    qsaSelf(root, '[data-ld-segmented]').forEach(function (group) {
      var items = Array.prototype.slice.call(group.querySelectorAll('[data-ld-segment]'));
      items.forEach(function (i) {
        i.setAttribute('tabindex', i.getAttribute('data-ld-active') === 'true' ? '0' : '-1');
      });
    });
  }

  function handleRovingKeydown(e) {
    var isTab = e.target.matches && e.target.matches('[data-ld-toggle="tab"]');
    var isSegment = e.target.matches && e.target.matches('[data-ld-segment]');
    if (!isTab && !isSegment) return;
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) return;

    var group = isTab ? e.target.closest('[data-ld-tabs]') : e.target.closest('[data-ld-segmented]');
    if (!group) return;
    var selector = isTab ? '[data-ld-toggle="tab"]' : '[data-ld-segment]';
    var items = Array.prototype.slice.call(group.querySelectorAll(selector));
    var currentIndex = items.indexOf(e.target);
    if (currentIndex === -1) return;

    var nextIndex = currentIndex;
    if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + items.length) % items.length;
    else if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % items.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = items.length - 1;

    e.preventDefault();
    items.forEach(function (item) { item.setAttribute('tabindex', '-1'); });
    items[nextIndex].setAttribute('tabindex', '0');
    items[nextIndex].focus();
    if (isTab) handleTabToggle(items[nextIndex]);
    else handleSegmentToggle(items[nextIndex]);
  }

  /* ---------------------------------------------------------------------
     Scrollspy — data-ld-scrollspy on a container of <a href="#section">
     links; the matching section that's most in view gets
     data-ld-active="true" (the same attribute .ld-nav-link already
     styles), cleared from the rest.
     ------------------------------------------------------------------- */

  function initScrollspy(root) {
    qsaSelf(root, '[data-ld-scrollspy]').forEach(function (nav) {
      var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
      var sections = links
        .map(function (link) { return document.querySelector(link.getAttribute('href')); })
        .filter(Boolean);
      if (!sections.length) return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = '#' + entry.target.id;
          links.forEach(function (link) {
            link.setAttribute('data-ld-active', link.getAttribute('href') === id ? 'true' : 'false');
          });
        });
      }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

      sections.forEach(function (section) { observer.observe(section); });
    });
  }

  /* ---------------------------------------------------------------------
     Carousel
     ------------------------------------------------------------------- */

  var carouselTimers = new WeakMap();

  function getCarouselParts(carousel) {
    var track = carousel.querySelector('[data-ld-carousel-track]');
    var slides = track ? Array.prototype.slice.call(track.querySelectorAll('[data-ld-carousel-slide]')) : [];
    var dots = Array.prototype.slice.call(carousel.querySelectorAll('[data-ld-carousel-dot]'));
    return { track: track, slides: slides, dots: dots };
  }

  function goToSlide(carousel, index) {
    var parts = getCarouselParts(carousel);
    if (!parts.track || !parts.slides.length) return;
    var next = ((index % parts.slides.length) + parts.slides.length) % parts.slides.length;
    parts.track.style.transform = 'translateX(-' + (next * 100) + '%)';
    parts.dots.forEach(function (dot, i) { dot.setAttribute('data-ld-active', i === next ? 'true' : 'false'); });
    carousel.setAttribute('data-ld-current', String(next));
    emit(carousel, 'ld:carousel:show', { index: next });
  }

  function currentSlideIndex(carousel) {
    var v = parseInt(carousel.getAttribute('data-ld-current'), 10);
    return isNaN(v) ? 0 : v;
  }

  function startCarouselAutoplay(carousel) {
    var interval = parseInt(carousel.getAttribute('data-ld-interval'), 10) || 5000;
    stopCarouselAutoplay(carousel);
    var timer = setInterval(function () {
      goToSlide(carousel, currentSlideIndex(carousel) + 1);
    }, interval);
    carouselTimers.set(carousel, timer);
  }

  function stopCarouselAutoplay(carousel) {
    var timer = carouselTimers.get(carousel);
    if (timer) clearInterval(timer);
  }

  function initCarousels(root) {
    qsaSelf(root, '[data-ld-carousel]').forEach(function (carousel) {
      goToSlide(carousel, 0);
      if (carousel.getAttribute('data-ld-autoplay') === 'true') {
        startCarouselAutoplay(carousel);
        carousel.addEventListener('mouseenter', function () { stopCarouselAutoplay(carousel); });
        carousel.addEventListener('mouseleave', function () { startCarouselAutoplay(carousel); });
      }
    });
  }

  /* ---------------------------------------------------------------------
     Navbar collapse
     ------------------------------------------------------------------- */

  function toggleNavbarCollapse(trigger) {
    var targetSel = trigger.getAttribute('data-ld-target');
    var panel = targetSel ? document.querySelector(targetSel) : null;
    if (!panel) return;
    var isShown = panel.getAttribute('data-ld-show') === 'true';
    panel.setAttribute('data-ld-show', String(!isShown));
    trigger.setAttribute('aria-expanded', String(!isShown));
    emit(panel, isShown ? 'ld:navbar:hide' : 'ld:navbar:show', { trigger: trigger });
  }

  /* Closes an open collapsible menu (sidebar dropdown on small screens).
     Returns the trigger button so callers can move focus back to it. */
  function closeNavbarCollapse(panel) {
    if (!panel || panel.getAttribute('data-ld-show') !== 'true') return null;
    panel.setAttribute('data-ld-show', 'false');
    var trigger = panel.id
      ? document.querySelector('[data-ld-toggle="navbar-collapse"][data-ld-target="#' + panel.id + '"]')
      : null;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    emit(panel, 'ld:navbar:hide', { trigger: trigger });
    return trigger;
  }

  /* ---------------------------------------------------------------------
     Delegated event wiring
     ------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
     Input clear button — [data-ld-input-clear]
     Shows/hides based on the paired input's value; clearing refocuses
     the input rather than leaving focus on a now-hidden button.
     ------------------------------------------------------------------- */

  function getClearTarget(clearBtn) {
    var targetSel = clearBtn.getAttribute('data-ld-target');
    return targetSel ? document.querySelector(targetSel) : clearBtn.previousElementSibling;
  }

  function syncInputClear(input) {
    var group = input.closest('.ld-input-group') || input.parentElement;
    if (!group) return;
    var clearBtn = group.querySelector('[data-ld-input-clear]');
    if (clearBtn) clearBtn.setAttribute('data-ld-show', input.value.length > 0 ? 'true' : 'false');
  }

  function initInputClear(root) {
    qsaSelf(root, '[data-ld-input-clear]').forEach(function (clearBtn) {
      var input = getClearTarget(clearBtn);
      if (input) syncInputClear(input);
    });
  }

  function handleInputClear(clearBtn) {
    var input = getClearTarget(clearBtn);
    if (!input) return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }

  /* ---------------------------------------------------------------------
     Password visibility toggle — [data-ld-password-toggle]
     ------------------------------------------------------------------- */

  function handlePasswordToggle(toggleBtn) {
    var targetSel = toggleBtn.getAttribute('data-ld-target');
    var input = targetSel ? document.querySelector(targetSel) : toggleBtn.previousElementSibling;
    if (!input) return;
    var showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    toggleBtn.setAttribute('data-ld-active', String(!showing));
    toggleBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  }

  /* ---------------------------------------------------------------------
     Autosizing textarea — [data-ld-autosize]
     Grows with content instead of scrolling internally. Resets height to
     auto before reading scrollHeight, or it would only ever grow.
     ------------------------------------------------------------------- */

  function autosizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function initAutosize(root) {
    qsaSelf(root, '[data-ld-autosize]').forEach(function (el) {
      el.style.overflowY = 'hidden';
      el.style.resize = 'none';
      autosizeTextarea(el);
    });
  }

  /* ---------------------------------------------------------------------
     Sortable table headers — .ld-table[data-ld-sortable] th[data-ld-sort]
     Sorts by the header's data-ld-sort-key (falls back to comparing
     cell textContent) using each cell's data-ld-sort-value if present,
     so a header can sort dates/numbers by a hidden value while
     displaying formatted text.
     ------------------------------------------------------------------- */

  function handleSortHeaderClick(th) {
    var table = th.closest('table');
    if (table && table.hasAttribute('data-ld-table')) { tableSortBy(table, th); return; }
    var tbody = table && table.querySelector('tbody');
    if (!tbody) return;
    var index = Array.prototype.indexOf.call(th.parentElement.children, th);
    var currentDir = th.getAttribute('data-ld-sort-dir');
    var nextDir = currentDir === 'asc' ? 'desc' : 'asc';

    th.parentElement.querySelectorAll('th[data-ld-sort]').forEach(function (t) {
      t.removeAttribute('data-ld-sort-dir');
      t.setAttribute('aria-sort', 'none');
    });
    th.setAttribute('data-ld-sort-dir', nextDir);
    th.setAttribute('aria-sort', nextDir === 'asc' ? 'ascending' : 'descending');

    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    rows.sort(function (a, b) {
      var cellA = a.children[index], cellB = b.children[index];
      var valA = (cellA && (cellA.getAttribute('data-ld-sort-value') || cellA.textContent.trim())) || '';
      var valB = (cellB && (cellB.getAttribute('data-ld-sort-value') || cellB.textContent.trim())) || '';
      var numA = parseFloat(valA), numB = parseFloat(valB);
      var cmp = (!isNaN(numA) && !isNaN(numB)) ? numA - numB : valA.localeCompare(valB);
      return nextDir === 'asc' ? cmp : -cmp;
    });
    rows.forEach(function (row) { tbody.appendChild(row); });
    emit(table, 'ld:table:sort', { key: th.getAttribute('data-ld-sort-key'), direction: nextDir });
  }

  /* ---------------------------------------------------------------------
     Debounce — exposed on window.ldcss for anyone wiring an async data
     source (server-filtered combobox, remote search) into the delegated
     input listener below, where debouncing per-instance is the caller's
     job, not something a synchronous local-list filter needs.
     ------------------------------------------------------------------- */

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait || 200);
    };
  }

  document.addEventListener('click', function (e) {
    var segmentEl = e.target.closest('[data-ld-segment]');
    if (segmentEl) {
      handleSegmentToggle(segmentEl);
      return;
    }

    var chipEl = e.target.closest('[data-ld-chip]');
    if (chipEl) {
      handleChipToggle(chipEl);
      return;
    }

    var stepEl = e.target.closest('.ld-step');
    if (stepEl) {
      handleStepClick(stepEl);
      return;
    }

    var comboboxOptionEl = e.target.closest('[data-ld-combobox-option]');
    if (comboboxOptionEl) {
      selectComboboxOption(comboboxOptionEl);
      return;
    }

    var dotEl = e.target.closest('[data-ld-carousel-dot]');
    if (dotEl) {
      var dotCarousel = dotEl.closest('[data-ld-carousel]');
      if (dotCarousel) {
        var dots = Array.prototype.slice.call(dotCarousel.querySelectorAll('[data-ld-carousel-dot]'));
        goToSlide(dotCarousel, dots.indexOf(dotEl));
      }
      return;
    }
    var toggleEl = e.target.closest('[data-ld-toggle]');
    if (toggleEl) {
      var kind = toggleEl.getAttribute('data-ld-toggle');
      if (kind === 'theme') {
        toggleTheme();
      } else if (kind === 'dropdown') {
        e.preventDefault();
        toggleFloating(toggleEl, 'data-ld-dropdown-menu', 'dropdown');
      } else if (kind === 'popover') {
        e.preventDefault();
        toggleFloating(toggleEl, 'data-ld-popover-content', 'popover');
      } else if (kind === 'tab') {
        e.preventDefault();
        handleTabToggle(toggleEl);
      } else if (kind === 'modal') {
        e.preventDefault();
        openModal(toggleEl.getAttribute('data-ld-target'), toggleEl);
      } else if (kind === 'offcanvas') {
        e.preventDefault();
        openOffcanvas(toggleEl.getAttribute('data-ld-target'), toggleEl);
      } else if (kind === 'command') {
        e.preventDefault();
        openCommand(toggleEl.getAttribute('data-ld-target'), toggleEl);
      } else if (kind === 'accordion') {
        e.preventDefault();
        handleAccordionToggle(toggleEl);
      } else if (kind === 'copy') {
        e.preventDefault();
        handleCopy(toggleEl);
      } else if (kind === 'toast') {
        e.preventDefault();
        handleToastTrigger(toggleEl);
      } else if (kind === 'step-next' || kind === 'step-prev') {
        e.preventDefault();
        var stepperEl = toggleEl.closest('[data-ld-stepper]') ||
          (toggleEl.getAttribute('data-ld-target') ? document.querySelector(toggleEl.getAttribute('data-ld-target')) : null);
        if (stepperEl) {
          var delta = kind === 'step-next' ? 1 : -1;
          goToStep(stepperEl, currentStepIndex(stepperEl) + delta);
        }
      } else if (kind === 'combobox') {
        e.preventDefault();
        var comboboxEl = toggleEl.closest('[data-ld-combobox]');
        if (comboboxEl) { openCombobox(comboboxEl); onComboboxInput(comboboxEl, true); }
      } else if (kind === 'carousel-prev' || kind === 'carousel-next') {
        e.preventDefault();
        var carouselEl = toggleEl.closest('[data-ld-carousel]');
        if (carouselEl) {
          var carouselDelta = kind === 'carousel-next' ? 1 : -1;
          goToSlide(carouselEl, currentSlideIndex(carouselEl) + carouselDelta);
        }
      } else if (kind === 'navbar-collapse') {
        e.preventDefault();
        toggleNavbarCollapse(toggleEl);
      }
      return;
    }

    var starEl = e.target.closest('[data-ld-star]');
    if (starEl) {
      handleRatingClick(starEl);
      return;
    }

    var commandItemEl = e.target.closest('[data-ld-command-item]');
    if (commandItemEl) {
      var cmdBackdrop = commandItemEl.closest('.ld-command-backdrop');
      if (cmdBackdrop) closeCommand(cmdBackdrop);
      runCommandAction(commandItemEl);
      return;
    }

    var pageBtn = e.target.closest('.ld-pagination button');
    if (pageBtn) {
      handlePaginationClick(pageBtn);
      return;
    }

    var listItemEl = e.target.closest('.ld-list-item[data-ld-interactive="true"]');
    if (listItemEl) {
      handleListItemClick(listItemEl);
      return;
    }

    var inputClearEl = e.target.closest('[data-ld-input-clear]');
    if (inputClearEl) {
      handleInputClear(inputClearEl);
      return;
    }

    var passwordToggleEl = e.target.closest('[data-ld-password-toggle]');
    if (passwordToggleEl) {
      handlePasswordToggle(passwordToggleEl);
      return;
    }

    var sortHeaderEl = e.target.closest('th[data-ld-sort]');
    if (sortHeaderEl) {
      handleSortHeaderClick(sortHeaderEl);
      return;
    }

    var tagRemoveEl = e.target.closest('.ld-tag-remove, [data-ld-tag-remove]');
    if (tagRemoveEl) {
      var tagEl = tagRemoveEl.closest('.ld-tag, [data-ld-tag]');
      if (tagEl) tagEl.remove();
      return;
    }

    var dismissEl = e.target.closest('[data-ld-dismiss="modal"]');
    if (dismissEl) {
      var backdrop = dismissEl.closest('.ld-modal-backdrop');
      if (backdrop) closeModal(backdrop);
      return;
    }

    var offcanvasDismissEl = e.target.closest('[data-ld-dismiss="offcanvas"]');
    if (offcanvasDismissEl) {
      var ocBackdrop = offcanvasDismissEl.closest('.ld-offcanvas-backdrop');
      if (ocBackdrop) closeOffcanvas(ocBackdrop);
      return;
    }

    var commandDismissEl = e.target.closest('[data-ld-dismiss="command"]');
    if (commandDismissEl) {
      var cmdDismissBackdrop = commandDismissEl.closest('.ld-command-backdrop');
      if (cmdDismissBackdrop) closeCommand(cmdDismissBackdrop);
      return;
    }

    var alertDismissEl = e.target.closest('[data-ld-dismiss="alert"]');
    if (alertDismissEl) {
      var alertEl = alertDismissEl.closest('.ld-alert');
      if (alertEl) alertEl.remove();
      return;
    }

    if (e.target.classList && e.target.classList.contains('ld-modal-backdrop')) {
      closeModal(e.target);
      return;
    }
    if (e.target.classList && e.target.classList.contains('ld-offcanvas-backdrop')) {
      closeOffcanvas(e.target);
      return;
    }
    if (e.target.classList && e.target.classList.contains('ld-command-backdrop')) {
      closeCommand(e.target);
      return;
    }

    handleDropzoneClick(e);

    if (!e.target.closest('[data-ld-dropdown]')) {
      closeAllDropdowns();
    }
    if (!e.target.closest('[data-ld-popover]')) {
      closeAllPopovers();
    }
    var openBox = e.target.closest('[data-ld-combobox]');
    closeAllComboboxes(openBox);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      // Modal/offcanvas/command already restore focus themselves (see
      // lastFocusedEl). Dropdown/popover don't trap focus the way those
      // do, so this only needs to act when the person was actually
      // keyboard-navigating inside the open panel — if they'd already
      // clicked elsewhere, that click is where focus should stay.
      var openFloating = document.querySelector('[data-ld-dropdown-menu].ld-show, [data-ld-popover-content].ld-show');
      var floatingReturnEl = (openFloating && openFloating.contains(document.activeElement) && openFloating._ldTrigger) || null;

      closeAllDropdowns();
      closeAllPopovers();
      closeAllModals();
      closeAllOffcanvas();
      closeAllCommands();
      closeAllComboboxes();

      if (floatingReturnEl && typeof floatingReturnEl.focus === 'function') floatingReturnEl.focus();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      var paletteExists = document.querySelector('.ld-command-backdrop');
      if (paletteExists) {
        e.preventDefault();
        openCommand(null);
      }
    }
    handleCommandKeydown(e);
    handleTagsKeydown(e);
    handleComboboxKeydown(e);
    handleRovingKeydown(e);
    trapTab(e);
  });

  document.addEventListener('input', function (e) {
    var commandInput = e.target.closest('.ld-command-input');
    if (commandInput) {
      var backdrop = commandInput.closest('.ld-command-backdrop');
      if (backdrop) filterCommandList(backdrop, commandInput.value);
    }
    var comboboxInput = e.target.closest('[data-ld-combobox] input');
    if (comboboxInput) {
      onComboboxInput(comboboxInput.closest('[data-ld-combobox]'));
    }

    if (e.target.hasAttribute && e.target.hasAttribute('data-ld-autosize')) {
      autosizeTextarea(e.target);
    }

    if (e.target.closest && e.target.closest('.ld-input-group')) {
      syncInputClear(e.target);
    }
  });

  document.addEventListener('change', function (e) {
    var input = e.target.closest('[data-ld-dropzone] input[type="file"]');
    if (!input) return;
    var zone = input.closest('[data-ld-dropzone]');
    var labelSel = zone.getAttribute('data-ld-dropzone-label');
    var label = labelSel ? document.querySelector(labelSel) : zone.querySelector('[data-ld-dropzone-filename]');
    if (label && input.files && input.files.length) {
      label.textContent = input.files.length === 1 ? input.files[0].name : input.files.length + ' files selected';
    }
  });

  /* Sidebar dropdown (small screens): choosing a link closes the menu, and
     Escape closes it and hands focus back to the toggle button. */
  document.addEventListener('click', function (e) {
    var sideLink = e.target.closest && e.target.closest('.ld-sidebar-link');
    if (sideLink) closeNavbarCollapse(sideLink.closest('.ld-sidebar-body'));
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var openMenu = document.querySelector('.ld-sidebar-body[data-ld-show="true"]');
    var trigger = closeNavbarCollapse(openMenu);
    if (trigger) trigger.focus();
  });

  window.ldcss = window.ldcss || {};
  window.ldcss.version = '3.1.1';

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


  /* =====================================================================
     Disclosure — general-purpose show/hide with animation
     Anything can be a disclosure: a "show more" block, a filter panel, a
     sidebar section, an FAQ answer, a tree node.

       <button data-ld-disclosure="#more" aria-expanded="false">Show more</button>
       <div class="ld-disclosure" id="more" data-ld-open="false">
         <div class="ld-disclosure-inner"> … </div>
       </div>

     Optional attributes
       data-ld-open="true"          on the panel: starts open
       data-ld-group="name"         on panels: opening one closes the others
       data-ld-text-open / -closed  on the trigger: label swap ("Show less")
     Events (on the panel, bubbling; "before" events are cancelable)
       ld:disclosure:before-show, :show, :before-hide, :hide
     API: ldcss.disclosure.show / hide / toggle / isOpen (element or selector)
     ===================================================================== */

  function disclosurePanel(ref) {
    if (!ref) return null;
    if (typeof ref === 'string') return document.querySelector(ref);
    if (ref.hasAttribute && ref.hasAttribute('data-ld-disclosure')) {
      return document.querySelector(ref.getAttribute('data-ld-disclosure'));
    }
    return ref;
  }

  function disclosureTriggers(panel) {
    if (!panel.id) return [];
    return Array.prototype.slice.call(document.querySelectorAll('[data-ld-disclosure="#' + panel.id + '"]'));
  }

  function isDisclosureOpen(ref) {
    var panel = disclosurePanel(ref);
    return !!panel && panel.getAttribute('data-ld-open') === 'true';
  }

  function paintDisclosure(panel, open) {
    panel.setAttribute('data-ld-open', open ? 'true' : 'false');
    if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
    disclosureTriggers(panel).forEach(function (trigger) {
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      var label = trigger.getAttribute(open ? 'data-ld-text-open' : 'data-ld-text-closed');
      if (label != null) {
        var target = trigger.querySelector('[data-ld-disclosure-label]') || trigger;
        target.textContent = label;
      }
    });
  }

  function setDisclosure(ref, open, trigger) {
    var panel = disclosurePanel(ref);
    if (!panel) return false;
    open = !!open;
    if (isDisclosureOpen(panel) === open) return open;
    var kind = open ? 'show' : 'hide';
    if (!emit(panel, 'ld:disclosure:before-' + kind, { trigger: trigger || null }, true)) return !open;

    if (open) {
      var group = panel.getAttribute('data-ld-group');
      if (group) {
        Array.prototype.forEach.call(document.querySelectorAll('[data-ld-group][data-ld-open]'), function (other) {
          if (other !== panel && other.getAttribute('data-ld-group') === group) setDisclosure(other, false);
        });
      }
    }
    paintDisclosure(panel, open);
    emit(panel, 'ld:disclosure:' + kind, { trigger: trigger || null });
    return open;
  }

  function initDisclosures(root) {
    qsaSelf(root, '[data-ld-disclosure]').forEach(function (trigger) {
      var panel = disclosurePanel(trigger);
      if (!panel) return;
      trigger.setAttribute('aria-controls', ensureId(panel, 'ld-disclosure'));
      if (trigger.tagName !== 'BUTTON' && !trigger.hasAttribute('tabindex')) trigger.setAttribute('tabindex', '0');
      if (trigger.tagName !== 'BUTTON' && !trigger.hasAttribute('role')) trigger.setAttribute('role', 'button');
      paintDisclosure(panel, panel.getAttribute('data-ld-open') === 'true');
    });
    qsaSelf(root, '.ld-disclosure').forEach(function (panel) {
      if (!panel.hasAttribute('data-ld-open')) paintDisclosure(panel, false);
      else paintDisclosure(panel, panel.getAttribute('data-ld-open') === 'true');
    });
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest && e.target.closest('[data-ld-disclosure]');
    if (!trigger || trigger.disabled || trigger.getAttribute('aria-disabled') === 'true') return;
    if (trigger.tagName === 'A') e.preventDefault();
    setDisclosure(trigger, !isDisclosureOpen(trigger), trigger);
  });

  // non-button triggers (role="button") need Enter / Space themselves
  document.addEventListener('keydown', function (e) {
    var trigger = e.target.closest && e.target.closest('[data-ld-disclosure]');
    if (!trigger || trigger.tagName === 'BUTTON' || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    setDisclosure(trigger, !isDisclosureOpen(trigger), trigger);
  });

  moduleInits.push(initDisclosures);
  window.ldcss.disclosure = {
    show: function (ref) { return setDisclosure(ref, true); },
    hide: function (ref) { return setDisclosure(ref, false); },
    toggle: function (ref, force) { return setDisclosure(ref, force == null ? !isDisclosureOpen(ref) : force); },
    isOpen: isDisclosureOpen
  };


  /* =====================================================================
     Context menu — right-click, long-press, or the keyboard menu key

       <div data-ld-context-menu="#ctx" tabindex="0">Right-click me</div>
       <div class="ld-context-menu" id="ctx">
         <button class="ld-context-item" data-ld-value="copy">Copy <span class="ld-context-shortcut">⌘C</span></button>
         <div class="ld-context-separator"></div>
         <button class="ld-context-item" data-ld-variant="danger" data-ld-value="delete">Delete</button>
       </div>

     Keyboard: ↑ ↓ Home End move, a letter jumps to the next matching item,
     Enter / Space activates, Escape closes and returns focus, Tab closes.
     Hold Shift while right-clicking to get the browser's own menu.
     Items: aria-disabled="true" (or disabled) skips them.
     data-ld-longpress="false" on the region turns the touch long-press off.
     Events: ld:contextmenu:before-show (cancelable), :show, :hide, :select
       select detail → { item, value, region, target, menu }
     API: ldcss.contextMenu.open(menu, x, y, region) / .close()
     ===================================================================== */

  var contextState = { menu: null, region: null, returnFocus: null };
  var LONG_PRESS_MS = 550;

  function contextItems(menu) {
    return Array.prototype.slice.call(menu.querySelectorAll('.ld-context-item, [role="menuitem"]')).filter(function (item) {
      return !item.disabled && item.getAttribute('aria-disabled') !== 'true' && item.getAttribute('data-ld-disabled') !== 'true';
    });
  }

  function focusContextItem(menu, item) {
    contextItems(menu).forEach(function (it) { it.setAttribute('tabindex', '-1'); });
    if (item) { item.setAttribute('tabindex', '0'); item.focus(); }
  }

  function prepareContextMenu(menu) {
    if (menu._ldReady) return;
    menu._ldReady = true;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-orientation', 'vertical');
    if (!menu.hasAttribute('tabindex')) menu.setAttribute('tabindex', '-1');
    Array.prototype.forEach.call(menu.querySelectorAll('.ld-context-item'), function (item) {
      if (!item.hasAttribute('role')) item.setAttribute('role', 'menuitem');
      item.setAttribute('tabindex', '-1');
    });
    Array.prototype.forEach.call(menu.querySelectorAll('.ld-context-separator'), function (sep) { sep.setAttribute('role', 'separator'); });
  }

  function closeContextMenu(restoreFocus) {
    var menu = contextState.menu;
    if (!menu) return;
    var region = contextState.region, back = contextState.returnFocus;
    menu.classList.remove('ld-show');
    menu.style.left = menu.style.top = '';
    contextState.menu = contextState.region = contextState.returnFocus = null;
    emit(menu, 'ld:contextmenu:hide', { region: region, menu: menu });
    if (restoreFocus && back && back.focus) back.focus();
  }

  function openContextMenu(menu, x, y, region, target, viaKeyboard) {
    if (!menu) return false;
    prepareContextMenu(menu);
    if (contextState.menu) closeContextMenu(false);
    if (!emit(menu, 'ld:contextmenu:before-show', { region: region, target: target, x: x, y: y }, true)) return false;

    contextState.returnFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : region;
    // measure while invisible, then clamp inside the viewport
    menu.style.visibility = 'hidden';
    menu.classList.add('ld-show');
    var margin = 8, rect = menu.getBoundingClientRect();
    var left = x, top = y;
    if (left + rect.width + margin > window.innerWidth) left = Math.max(margin, x - rect.width);
    if (top + rect.height + margin > window.innerHeight) top = Math.max(margin, y - rect.height);
    menu.style.left = Math.max(margin, left) + 'px';
    menu.style.top = Math.max(margin, top) + 'px';
    menu.style.visibility = '';

    contextState.menu = menu;
    contextState.region = region;
    menu._ldTarget = target;
    var items = contextItems(menu);
    if (viaKeyboard && items.length) focusContextItem(menu, items[0]);
    else menu.focus({ preventScroll: true });
    emit(menu, 'ld:contextmenu:show', { region: region, target: target, x: x, y: y });
    return true;
  }

  function contextRegionFor(node) {
    return node && node.closest ? node.closest('[data-ld-context-menu]') : null;
  }

  document.addEventListener('contextmenu', function (e) {
    var region = contextRegionFor(e.target);
    // let people reach the browser menu: Shift+right-click, or inside the menu itself
    if (e.shiftKey || (contextState.menu && contextState.menu.contains(e.target))) {
      if (contextState.menu && contextState.menu.contains(e.target)) e.preventDefault();
      else if (contextState.menu) closeContextMenu(false);
      return;
    }
    if (!region) { if (contextState.menu) closeContextMenu(false); return; }
    var menu = document.querySelector(region.getAttribute('data-ld-context-menu'));
    if (!menu) return;
    e.preventDefault();
    if (menu === contextState.menu && region === contextState.region && e._ldLongPress) return;
    // keyboard-invoked events report 0,0 — anchor to the focused region instead
    var viaKeyboard = e.clientX === 0 && e.clientY === 0 && !e.pointerType;
    var x = e.clientX, y = e.clientY;
    if (viaKeyboard) {
      var box = (e.target.getBoundingClientRect ? e.target : region).getBoundingClientRect();
      x = box.left + Math.min(24, box.width / 2);
      y = box.top + Math.min(24, box.height / 2);
    }
    openContextMenu(menu, x, y, region, e.target, viaKeyboard);
  });

  // long-press on touch screens (iOS never sends contextmenu for it)
  (function () {
    var timer = null, startX = 0, startY = 0, suppressClick = false;
    function cancel() { clearTimeout(timer); timer = null; }
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      var region = contextRegionFor(e.target);
      if (!region || region.getAttribute('data-ld-longpress') === 'false') return;
      startX = e.clientX; startY = e.clientY;
      cancel();
      timer = setTimeout(function () {
        timer = null;
        var menu = document.querySelector(region.getAttribute('data-ld-context-menu'));
        if (menu && openContextMenu(menu, startX, startY, region, e.target, false)) suppressClick = true;
      }, LONG_PRESS_MS);
    });
    document.addEventListener('pointermove', function (e) {
      if (timer && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) cancel();
    });
    ['pointerup', 'pointercancel'].forEach(function (t) { document.addEventListener(t, cancel); });
    document.addEventListener('click', function (e) {
      if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); }
    }, true);
  })();

  document.addEventListener('pointerdown', function (e) {
    if (contextState.menu && !contextState.menu.contains(e.target)) closeContextMenu(false);
  }, true);

  document.addEventListener('click', function (e) {
    var item = e.target.closest && e.target.closest('.ld-context-item');
    if (!item || !contextState.menu || !contextState.menu.contains(item)) return;
    if (item.disabled || item.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
    var menu = contextState.menu, region = contextState.region, target = menu._ldTarget;
    emit(item, 'ld:contextmenu:select', {
      item: item, value: item.getAttribute('data-ld-value'), region: region, target: target, menu: menu
    });
    closeContextMenu(true);
  });

  document.addEventListener('keydown', function (e) {
    var menu = contextState.menu;
    if (!menu) return;
    var items = contextItems(menu);
    var index = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeContextMenu(true); return; }
    if (e.key === 'Tab') { closeContextMenu(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); focusContextItem(menu, items[(index + 1) % items.length]); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusContextItem(menu, items[index <= 0 ? items.length - 1 : index - 1]); }
    else if (e.key === 'Home') { e.preventDefault(); focusContextItem(menu, items[0]); }
    else if (e.key === 'End') { e.preventDefault(); focusContextItem(menu, items[items.length - 1]); }
    else if ((e.key === 'Enter' || e.key === ' ') && index !== -1) { e.preventDefault(); items[index].click(); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var ch = e.key.toLowerCase(), ordered = items.slice(index + 1).concat(items.slice(0, index + 1));
      var hit = ordered.filter(function (it) { return it.textContent.trim().toLowerCase().indexOf(ch) === 0; })[0];
      if (hit) focusContextItem(menu, hit);
    }
  }, true);

  document.addEventListener('mouseover', function (e) {
    var item = e.target.closest && e.target.closest('.ld-context-item');
    if (item && contextState.menu && contextState.menu.contains(item) && !item.disabled && item.getAttribute('aria-disabled') !== 'true') {
      focusContextItem(contextState.menu, item);
    }
  });

  window.addEventListener('resize', function () { closeContextMenu(false); });
  window.addEventListener('blur', function () { closeContextMenu(false); });
  window.addEventListener('scroll', function (e) {
    if (contextState.menu && !contextState.menu.contains(e.target)) closeContextMenu(false);
  }, true);

  function initContextMenus(root) {
    qsaSelf(root, '[data-ld-context-menu]').forEach(function (region) {
      region.setAttribute('aria-haspopup', 'menu');
      var menu = document.querySelector(region.getAttribute('data-ld-context-menu'));
      if (menu) prepareContextMenu(menu);
    });
    qsaSelf(root, '.ld-context-menu').forEach(prepareContextMenu);
  }

  moduleInits.push(initContextMenus);
  window.ldcss.contextMenu = {
    open: function (menu, x, y, region) { return openContextMenu(typeof menu === 'string' ? document.querySelector(menu) : menu, x, y, region || null, region || null, false); },
    close: function () { closeContextMenu(true); }
  };


  /* =====================================================================
     Toasts with a queue + notification centre

     ldcss.toast({ title, message, variant, duration, id, actions, progress })
       variant   success | danger | warning | info
       duration  ms, default 3000; 0 keeps it until dismissed
       id        showing a toast with an id that is already up updates it
       actions   [{ label, onClick(event, handle), dismiss: true }]
       progress  true draws a countdown bar
     Only `data-ld-toast-max` toasts (on <body>, default 5) are visible at
     once; the rest wait in a queue and appear as others close. Hovering or
     focusing a toast pauses its timer. Danger toasts are announced
     assertively. Returns { id, el, dismiss(), update(spec) }.
     ldcss.toast.clear() dismisses everything, queue included.

     ldcss.notify(spec) = a toast that is also kept in the notification
     centre: unread count, history, mark read, clear. spec takes the same
     fields plus  toast: false  (history only).
     ldcss.notifications.{ list, unread, markRead, markAllRead, dismiss, clear }

       <span class="ld-badge" data-ld-notification-count hidden></span>
       <div data-ld-notification-center data-ld-mark-read="open"></div>

     data-ld-notify-store="key" on <body> keeps the history in localStorage.
     Triggers:  data-ld-toggle="toast"  data-ld-toast-message / -variant /
     -duration / -title / -persist     and     data-ld-notify  (same, with
     data-ld-notify-title / -message / -variant).
     Events: ld:toast:show, :hide { id, reason }, :action, :update
             ld:notification:add, :read, :dismiss, :clear
     ===================================================================== */

  var toastActive = [];
  var toastQueued = [];

  function getToastContainer() {
    var container = document.querySelector('.ld-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'ld-toast-container';
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', 'Notifications');
      container.setAttribute('aria-live', 'polite');
      var position = document.body.getAttribute('data-ld-toast-position');
      if (position) container.setAttribute('data-ld-position', position);
      document.body.appendChild(container);
    }
    return container;
  }

  function toastMax() {
    var n = parseInt(document.body.getAttribute('data-ld-toast-max'), 10);
    return n > 0 ? n : 5;
  }

  function normalizeToastSpec(spec, variant, duration) {
    if (typeof spec === 'string') spec = { message: spec, variant: variant, duration: duration };
    spec = spec || {};
    return {
      id: spec.id || uid('ld-toast'),
      title: spec.title || '',
      message: spec.message == null ? '' : String(spec.message),
      variant: spec.variant || null,
      duration: spec.duration == null || isNaN(spec.duration) ? 3000 : Math.max(0, +spec.duration),
      actions: spec.actions || [],
      progress: !!spec.progress
    };
  }

  function fillToast(entry) {
    var spec = entry.spec, el = entry.el;
    if (spec.variant) el.setAttribute('data-ld-variant', spec.variant); else el.removeAttribute('data-ld-variant');
    // problems interrupt (role=alert); everything else is announced politely by the container
    if (spec.variant === 'danger') el.setAttribute('role', 'alert'); else el.removeAttribute('role');

    var body = el.querySelector('.ld-toast-body');
    body.textContent = '';
    if (spec.title) {
      var title = document.createElement('div');
      title.className = 'ld-toast-title';
      title.textContent = spec.title;
      body.appendChild(title);
    }
    if (spec.title || spec.actions.length) {
      var msg = document.createElement('div');
      msg.className = 'ld-toast-message';
      msg.textContent = spec.message;
      body.appendChild(msg);
    } else {
      body.textContent = spec.message;
    }
    if (spec.actions.length) {
      var row = document.createElement('div');
      row.className = 'ld-toast-actions';
      spec.actions.forEach(function (action) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ld-btn';
        btn.setAttribute('data-ld-size', 'sm');
        btn.setAttribute('data-ld-variant', 'outline');
        btn.textContent = action.label;
        btn.addEventListener('click', function (e) {
          if (typeof action.onClick === 'function') action.onClick(e, entry.handle);
          emit(el, 'ld:toast:action', { id: spec.id, action: action.label });
          if (action.dismiss !== false) dismissToast(entry, 'action');
        });
        row.appendChild(btn);
      });
      body.appendChild(row);
    }

    var old = el.querySelector('.ld-toast-progress');
    if (old) old.remove();
    if (spec.progress && spec.duration > 0) {
      var bar = document.createElement('div');
      bar.className = 'ld-toast-progress';
      bar.setAttribute('aria-hidden', 'true');
      bar.style.animationDuration = spec.duration + 'ms';
      el.appendChild(bar);
    }
  }

  function startToastTimer(entry) {
    clearTimeout(entry.timer);
    if (entry.spec.duration <= 0) return;
    entry.remaining = entry.spec.duration;
    resumeToastTimer(entry);
  }

  function resumeToastTimer(entry) {
    clearTimeout(entry.timer);
    if (entry.spec.duration <= 0 || entry.remaining == null) return;
    entry.startedAt = Date.now();
    entry.el.removeAttribute('data-ld-paused');
    entry.timer = setTimeout(function () { dismissToast(entry, 'timeout'); }, entry.remaining);
  }

  function pauseToastTimer(entry) {
    if (entry.spec.duration <= 0 || !entry.timer) return;
    clearTimeout(entry.timer);
    entry.timer = null;
    entry.remaining = Math.max(400, entry.remaining - (Date.now() - entry.startedAt));
    entry.el.setAttribute('data-ld-paused', 'true');
  }

  function dismissToast(entry, reason) {
    if (entry.closed) return;
    entry.closed = true;
    clearTimeout(entry.timer);
    toastActive = toastActive.filter(function (e) { return e !== entry; });
    var el = entry.el;
    var finish = function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      emit(document.body, 'ld:toast:hide', { id: entry.spec.id, reason: reason || 'dismiss' });
      pumpToastQueue();
    };
    var animated = window.getComputedStyle(el).animationName !== 'none' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.classList.add('ld-toast-leaving');
    if (animated) setTimeout(finish, 180); else finish();
  }

  function renderToast(spec) {
    var container = getToastContainer();
    var el = document.createElement('div');
    el.className = 'ld-toast';
    el.setAttribute('data-ld-toast-id', spec.id);
    var body = document.createElement('div');
    body.className = 'ld-toast-body';
    el.appendChild(body);
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'ld-toast-close';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '×';
    el.appendChild(close);

    var entry = { spec: spec, el: el, timer: null, closed: false };
    entry.handle = {
      id: spec.id,
      el: el,
      dismiss: function () { dismissToast(entry, 'dismiss'); },
      update: function (patch) { return updateToast(entry, patch); }
    };
    close.addEventListener('click', function () { dismissToast(entry, 'dismiss'); });
    el.addEventListener('mouseenter', function () { pauseToastTimer(entry); });
    el.addEventListener('mouseleave', function () { if (!el.contains(document.activeElement)) resumeToastTimer(entry); });
    el.addEventListener('focusin', function () { pauseToastTimer(entry); });
    el.addEventListener('focusout', function () { if (!el.matches(':hover')) resumeToastTimer(entry); });

    fillToast(entry);
    container.appendChild(el);
    toastActive.push(entry);
    startToastTimer(entry);
    emit(el, 'ld:toast:show', { id: spec.id, variant: spec.variant });
    return entry;
  }

  function updateToast(entry, patch) {
    var spec = entry.spec;
    ['title', 'message', 'variant', 'actions', 'progress'].forEach(function (k) { if (patch[k] !== undefined) spec[k] = patch[k]; });
    if (patch.duration !== undefined) spec.duration = Math.max(0, +patch.duration);
    entry.closed = false;
    fillToast(entry);
    startToastTimer(entry);
    emit(entry.el, 'ld:toast:update', { id: spec.id });
    return entry.handle;
  }

  function pumpToastQueue() {
    while (toastQueued.length && toastActive.length < toastMax()) {
      var next = toastQueued.shift();
      var entry = renderToast(next.spec);
      next.handle.el = entry.el;
      next.handle._entry = entry;
    }
  }

  function toast(spec, variant, duration) {
    spec = normalizeToastSpec(spec, variant, duration);
    var live = toastActive.filter(function (e) { return e.spec.id === spec.id; })[0];
    if (live) return updateToast(live, spec);
    var waiting = toastQueued.filter(function (q) { return q.spec.id === spec.id; })[0];
    if (waiting) { waiting.spec = spec; return waiting.handle; }

    if (toastActive.length >= toastMax()) {
      var queued = { spec: spec };
      queued.handle = {
        id: spec.id,
        el: null,
        dismiss: function () {
          if (queued.handle._entry) queued.handle._entry.handle.dismiss();
          else toastQueued = toastQueued.filter(function (q) { return q !== queued; });
        },
        update: function (patch) {
          if (queued.handle._entry) return queued.handle._entry.handle.update(patch);
          Object.keys(patch).forEach(function (k) { spec[k] = patch[k]; });
          return queued.handle;
        }
      };
      toastQueued.push(queued);
      return queued.handle;
    }
    return renderToast(spec).handle;
  }

  toast.clear = function () {
    toastQueued = [];
    toastActive.slice().forEach(function (entry) { dismissToast(entry, 'clear'); });
  };

  /* kept for the data-ld-toggle="toast" trigger and older call sites */
  function showToast(message, variant, duration) {
    return toast({ message: message, variant: variant, duration: duration }).el;
  }

  function toastSpecFromTrigger(trigger, prefix) {
    var get = function (name) { return trigger.getAttribute('data-ld-' + prefix + '-' + name); };
    var duration = parseInt(get('duration'), 10);
    var persist = trigger.hasAttribute('data-ld-' + prefix + '-persist');
    return {
      title: get('title') || '',
      message: get('message') || 'Notification',
      variant: get('variant'),
      duration: persist ? 0 : (isNaN(duration) ? undefined : duration),
      progress: trigger.hasAttribute('data-ld-' + prefix + '-progress')
    };
  }

  function handleToastTrigger(trigger) {
    toast(toastSpecFromTrigger(trigger, 'toast'));
  }

  /* ----- notification centre ------------------------------------------- */

  var notifications = [];
  var notificationsLoaded = false;

  function notificationStoreKey() {
    return document.body.getAttribute('data-ld-notify-store');
  }

  function saveNotifications() {
    var key = notificationStoreKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(notifications.map(function (n) {
        return { id: n.id, title: n.title, message: n.message, variant: n.variant, time: n.time, read: n.read };
      })));
    } catch (err) { /* private mode / quota: history just won't persist */ }
  }

  function loadNotifications() {
    if (notificationsLoaded) return;
    var key = notificationStoreKey();
    if (!key) return;
    notificationsLoaded = true;
    try {
      var saved = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(saved)) notifications = saved.map(function (n) { n.actions = []; return n; });
    } catch (err) { /* ignore corrupted storage */ }
  }

  function timeAgo(then) {
    var seconds = Math.round((Date.now() - then) / 1000);
    if (seconds < 45) return 'just now';
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + ' min ago';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + ' h ago';
    var days = Math.round(hours / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }

  function unreadCount() {
    return notifications.filter(function (n) { return !n.read; }).length;
  }

  function copyNotification(n) {
    return { id: n.id, title: n.title, message: n.message, variant: n.variant, time: n.time, read: n.read };
  }

  function renderNotificationCenter(center) {
    center.classList.add('ld-nc');
    center.textContent = '';

    var head = document.createElement('div');
    head.className = 'ld-nc-head';
    var heading = document.createElement('strong');
    heading.textContent = center.getAttribute('data-ld-title') || 'Notifications';
    head.appendChild(heading);
    var tools = document.createElement('div');
    tools.className = 'ld-nc-tools';
    [['read', 'Mark all read'], ['clear', 'Clear all']].forEach(function (pair) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ld-btn';
      btn.setAttribute('data-ld-size', 'sm');
      btn.setAttribute('data-ld-variant', 'ghost');
      btn.setAttribute('data-ld-nc', pair[0]);
      btn.textContent = pair[1];
      btn.disabled = !notifications.length || (pair[0] === 'read' && !unreadCount());
      tools.appendChild(btn);
    });
    head.appendChild(tools);
    center.appendChild(head);

    if (!notifications.length) {
      var empty = document.createElement('p');
      empty.className = 'ld-nc-empty';
      empty.textContent = center.getAttribute('data-ld-empty') || "You're all caught up.";
      center.appendChild(empty);
      return;
    }

    var list = document.createElement('ul');
    list.className = 'ld-nc-list';
    notifications.forEach(function (n) {
      var li = document.createElement('li');
      li.className = 'ld-nc-item';
      li.setAttribute('data-ld-nc-id', n.id);
      if (!n.read) li.setAttribute('data-ld-unread', 'true');
      if (n.variant) li.setAttribute('data-ld-variant', n.variant);

      var main = document.createElement('button');
      main.type = 'button';
      main.className = 'ld-nc-main';
      main.setAttribute('data-ld-nc', 'open');
      var dot = document.createElement('span');
      dot.className = 'ld-nc-dot';
      dot.setAttribute('aria-hidden', 'true');
      main.appendChild(dot);
      var text = document.createElement('span');
      text.className = 'ld-nc-text';
      if (n.title) {
        var t = document.createElement('span');
        t.className = 'ld-nc-title';
        t.textContent = n.title;
        text.appendChild(t);
      }
      var m = document.createElement('span');
      m.className = 'ld-nc-message';
      m.textContent = n.message;
      text.appendChild(m);
      var time = document.createElement('time');
      time.className = 'ld-nc-time';
      time.setAttribute('datetime', new Date(n.time).toISOString());
      time.textContent = timeAgo(n.time);
      text.appendChild(time);
      main.appendChild(text);
      if (!n.read) {
        var sr = document.createElement('span');
        sr.className = 'ld-sr-only';
        sr.textContent = ' (unread)';
        text.appendChild(sr);
      }
      li.appendChild(main);

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'ld-nc-dismiss';
      del.setAttribute('data-ld-nc', 'dismiss');
      del.setAttribute('aria-label', 'Remove notification');
      del.textContent = '×';
      li.appendChild(del);
      list.appendChild(li);
    });
    center.appendChild(list);
  }

  function renderNotifications() {
    var count = unreadCount();
    qsaSelf(document, '[data-ld-notification-count]').forEach(function (badge) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = count === 0;
      badge.setAttribute('data-ld-count', String(count));
    });
    qsaSelf(document, '[data-ld-notification-center]').forEach(renderNotificationCenter);
  }

  function findNotification(id) {
    return notifications.filter(function (n) { return n.id === id; })[0];
  }

  function notify(spec) {
    loadNotifications();
    spec = spec || {};
    var id = spec.id || uid('ld-n');
    var entry = findNotification(id);
    var fresh = !entry;
    if (!entry) { entry = { id: id }; notifications.unshift(entry); }
    entry.title = spec.title || '';
    entry.message = spec.message == null ? '' : String(spec.message);
    entry.variant = spec.variant || null;
    entry.time = Date.now();
    entry.read = false;
    entry.actions = spec.actions || [];
    var max = parseInt(document.body.getAttribute('data-ld-notify-max'), 10) || 50;
    if (notifications.length > max) notifications.length = max;
    saveNotifications();
    renderNotifications();
    emit(document.body, 'ld:notification:add', { notification: copyNotification(entry), updated: !fresh });
    if (spec.toast !== false) {
      toast({
        id: id, title: entry.title, message: entry.message, variant: entry.variant,
        duration: spec.duration == null ? 5000 : spec.duration, actions: entry.actions, progress: spec.progress
      });
    }
    return { id: id, markRead: function () { markNotificationRead(id); }, dismiss: function () { dismissNotification(id); } };
  }

  function markNotificationRead(id) {
    var n = findNotification(id);
    if (!n || n.read) return;
    n.read = true;
    saveNotifications();
    renderNotifications();
    emit(document.body, 'ld:notification:read', { id: id });
  }

  function markAllNotificationsRead() {
    var changed = notifications.filter(function (n) { return !n.read; });
    if (!changed.length) return;
    changed.forEach(function (n) { n.read = true; });
    saveNotifications();
    renderNotifications();
    emit(document.body, 'ld:notification:read', { all: true, ids: changed.map(function (n) { return n.id; }) });
  }

  function dismissNotification(id) {
    var before = notifications.length;
    notifications = notifications.filter(function (n) { return n.id !== id; });
    if (notifications.length === before) return;
    saveNotifications();
    renderNotifications();
    emit(document.body, 'ld:notification:dismiss', { id: id });
  }

  function clearNotifications() {
    if (!notifications.length) return;
    notifications = [];
    saveNotifications();
    renderNotifications();
    emit(document.body, 'ld:notification:clear', {});
  }

  document.addEventListener('click', function (e) {
    var notifyTrigger = e.target.closest && e.target.closest('[data-ld-notify]');
    if (notifyTrigger) {
      var spec = toastSpecFromTrigger(notifyTrigger, 'notify');
      notify(spec);
      return;
    }
    var control = e.target.closest && e.target.closest('[data-ld-notification-center] [data-ld-nc]');
    if (!control) return;
    var kind = control.getAttribute('data-ld-nc');
    var item = control.closest('[data-ld-nc-id]');
    var center = control.closest('[data-ld-notification-center]');
    if (kind === 'read') markAllNotificationsRead();
    else if (kind === 'clear') clearNotifications();
    else if (kind === 'open' && item) markNotificationRead(item.getAttribute('data-ld-nc-id'));
    else if (kind === 'dismiss' && item) {
      var next = item.nextElementSibling || item.previousElementSibling;
      var nextId = next && next.getAttribute('data-ld-nc-id');
      dismissNotification(item.getAttribute('data-ld-nc-id'));
      var target = nextId && center.querySelector('[data-ld-nc-id="' + nextId + '"] [data-ld-nc="dismiss"]');
      (target || center).focus();
    }
  });

  // opening whatever holds the centre (popover, dropdown, offcanvas…) can mark everything read
  ['popover', 'dropdown', 'offcanvas', 'modal'].forEach(function (kind) {
    document.addEventListener('ld:' + kind + ':show', function (e) {
      var centers = qsaSelf(e.target, '[data-ld-notification-center][data-ld-mark-read="open"]');
      if (centers.length) setTimeout(markAllNotificationsRead, 600);
    });
  });

  moduleInits.push(function (root) {
    loadNotifications();
    // only touch what is new: re-rendering an already-rendered centre would drop keyboard focus
    var fresh = qsaSelf(root, '[data-ld-notification-center]:not(.ld-nc)');
    var badges = qsaSelf(root, '[data-ld-notification-count]:not([data-ld-count])');
    fresh.forEach(function (c) {
      if (!c.hasAttribute('tabindex')) c.setAttribute('tabindex', '-1');
      renderNotificationCenter(c);
    });
    if (badges.length) renderNotifications();
  });

  window.ldcss.toast = toast;
  window.ldcss.notify = notify;
  window.ldcss.notifications = {
    list: function () { return notifications.map(copyNotification); },
    unread: unreadCount,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
    dismiss: dismissNotification,
    clear: clearNotifications
  };


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

  function initResizables(root) {
    qsaSelf(root, '[data-ld-resizable]').forEach(function (box) {
      if (box._ldResizable) return;
      box._ldResizable = true;
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
    });
  }

  function resizeStart(e) {
    var handle = e.target.closest && e.target.closest('.ld-resize-handle');
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

  document.addEventListener('pointerdown', resizeStart);
  document.addEventListener('pointermove', resizeDragMove);
  document.addEventListener('pointerup', resizeEnd);
  document.addEventListener('pointercancel', resizeEnd);

  document.addEventListener('dblclick', function (e) {
    var handle = e.target.closest && e.target.closest('.ld-resize-handle');
    var box = handle && handle.parentElement;
    if (!box || !box._ldResizable) return;
    resizeApply(box, box._ldInitial.slice());
    resizeSave(box);
    emit(box, 'ld:resize:end', { sizes: resizePercent(box), handle: resizeParts(box).handles.indexOf(handle), reset: true });
  });

  document.addEventListener('keydown', function (e) {
    var handle = e.target.closest && e.target.closest('.ld-resize-handle');
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

  window.addEventListener('resize', function () {
    qsaSelf(document, '[data-ld-resizable]').forEach(function (box) { if (box._ldSizes) resizeSyncAria(box); });
  });

  moduleInits.push(initResizables);
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

  function initSearch(root) {
    qsaSelf(root, '[data-ld-search]').forEach(function (wrap) {
      if (wrap._ldSearch) return;
      var input = searchInputOf(wrap);
      if (!input) return;
      wrap._ldSearch = true;
      wrap.classList.add('ld-search');
      input.classList.add('ld-input');
      if (!input.hasAttribute('type')) input.setAttribute('type', 'search');
      if (!input.hasAttribute('autocomplete')) input.setAttribute('autocomplete', 'off');
      if (!input.hasAttribute('enterkeyhint')) input.setAttribute('enterkeyhint', 'search');
      if (!input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby') && !(input.id && document.querySelector('label[for="' + input.id + '"]'))) {
        input.setAttribute('aria-label', input.getAttribute('placeholder') || 'Search');
      }
      wrap.setAttribute('role', wrap.hasAttribute('data-ld-combobox') ? wrap.getAttribute('role') || 'search' : 'search');

      // the field: input + clear button + shortcut hint, so they sit inside the input, not over the button
      var field = document.createElement('div');
      field.className = 'ld-search-field';
      input.parentNode.insertBefore(field, input);
      field.appendChild(input);

      var clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'ld-search-clear';
      clear.setAttribute('aria-label', 'Clear search');
      clear.textContent = '×';
      clear.hidden = true;
      clear.addEventListener('click', function () { searchClear(wrap); });
      field.appendChild(clear);

      var key = wrap.getAttribute('data-ld-shortcut');
      if (key && key !== 'none') {
        var hint = document.createElement('kbd');
        hint.className = 'ld-search-kbd ld-kbd';
        hint.setAttribute('aria-hidden', 'true');
        hint.textContent = key;
        field.appendChild(hint);
        input.setAttribute('aria-keyshortcuts', key);
      }

      if (wrap.getAttribute('data-ld-search-button') === 'false') {
        wrap.setAttribute('data-ld-search-compact', '');
        var icon = document.createElement('span');
        icon.className = 'ld-search-icon';
        icon.setAttribute('aria-hidden', 'true');
        field.insertBefore(icon, input);
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
        button.addEventListener('click', function (e) {
          var ok = searchSubmit(wrap, 'button');
          if (!ok && inForm) e.preventDefault();
        });
        field.insertAdjacentElement('afterend', button);
      }

      if (wrap.hasAttribute('data-ld-search-filter')) {
        input.addEventListener('input', function () { searchFilter(wrap); });
      } else {
        input.addEventListener('input', function () { searchSyncClear(wrap); });
      }
      input.addEventListener('keydown', function (e) {
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
  window.ldcss.search = { filter: searchFilter, clear: searchClear, submit: searchSubmit };


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
    var pageBtn = e.target.closest && e.target.closest('[data-ld-table-page]');
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


  /* =====================================================================
     Accessibility layer (v3.1.0)

     Runs on load and for every element added later, and fills in what the
     markup did not say, without ever overriding an attribute you set:

       · aria-current follows data-ld-active on nav links, sidebar links and pager buttons
       · dropdown menus: role=menu / menuitem, ↑ ↓ Home End, Esc returns focus
       · data-ld-tooltip becomes the accessible name (icon-only controls) or
         description, and Esc hides it while it is showing (WCAG 1.4.13)
       · dialogs get aria-labelledby from their first heading; the rest of the
         page is made inert while a modal / offcanvas / command palette is open
       · progress bars get role=progressbar; chips get aria-pressed
       · command palette: combobox/listbox roles and aria-activedescendant
       · carousels: roledescription, "n of m" slide labels, autoplay stops
         for prefers-reduced-motion and while anything inside has focus
       · plain sortable headers (th[data-ld-sort]) work from the keyboard
       · fields inside .ld-validate get aria-invalid once the person has touched them
       · skip links focus their target

     ldcss.a11y.audit(root?) → [{ rule, message, element }] for the common
     mistakes this layer cannot fix for you (also logs a table).
     ===================================================================== */

  function currentValueFor(el) {
    var href = el.getAttribute('href') || '';
    return href.charAt(0) === '#' ? 'location' : 'page';
  }

  function syncCurrent(el) {
    var active = el.getAttribute('data-ld-active') === 'true';
    var target = el;
    if (el.matches('li') && el.parentElement && /ld-pagination|ld-pager/.test(el.parentElement.className)) target = el.querySelector('button, a') || el;
    if (target.hasAttribute('aria-current') && !target._ldCurrent) return; // the author set it themselves
    if (active) {
      target.setAttribute('aria-current', el.matches('li') ? 'page' : currentValueFor(el));
      target._ldCurrent = true;
    } else if (target._ldCurrent) {
      target.removeAttribute('aria-current');
      target._ldCurrent = false;
    }
  }

  var CURRENT_SELECTOR = '.ld-nav-link, .ld-sidebar-link, .ld-pagination li, .ld-pager li';

  function syncChip(chip) {
    if (!chip.hasAttribute('role')) chip.setAttribute('role', 'button');
    if (!chip.hasAttribute('tabindex') && chip.tagName !== 'BUTTON') chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-pressed', chip.getAttribute('data-ld-active') === 'true' ? 'true' : 'false');
  }

  function syncCommandActive(item) {
    if (item.getAttribute('data-ld-highlighted') !== 'true') return;
    var backdrop = item.closest('.ld-command-backdrop');
    var input = backdrop && backdrop.querySelector('.ld-command-input');
    if (input) input.setAttribute('aria-activedescendant', ensureId(item, 'ld-cmd'));
  }

  function initA11y(root) {
    // dropdowns
    qsaSelf(root, '[data-ld-dropdown]').forEach(function (dd) {
      var trigger = dd.querySelector('[data-ld-toggle="dropdown"]');
      var menu = dd.querySelector('[data-ld-dropdown-menu]');
      if (!trigger || !menu) return;
      if (!trigger.hasAttribute('aria-haspopup')) trigger.setAttribute('aria-haspopup', 'menu');
      if (!trigger.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', ensureId(menu, 'ld-menu'));
      if (!menu.hasAttribute('role')) menu.setAttribute('role', 'menu');
      Array.prototype.forEach.call(menu.querySelectorAll('a, button'), function (item) {
        if (!item.hasAttribute('role')) item.setAttribute('role', 'menuitem');
        item.setAttribute('tabindex', '-1');
      });
    });

    // tooltips
    qsaSelf(root, '[data-ld-tooltip]').forEach(function (el) {
      var tip = el.getAttribute('data-ld-tooltip');
      if (!tip || el._ldTip) return;
      el._ldTip = true;
      var hasName = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || el.textContent.trim() !== '' || (el.querySelector && el.querySelector('img[alt]:not([alt=""])'));
      if (!hasName) el.setAttribute('aria-label', tip);
      else if (!el.hasAttribute('aria-description') && !el.hasAttribute('aria-describedby') && el.getAttribute('aria-label') !== tip) el.setAttribute('aria-description', tip);
      var undismiss = function () { el.removeAttribute('data-ld-tooltip-dismissed'); };
      el.addEventListener('mouseleave', undismiss);
      el.addEventListener('blur', undismiss);
    });

    // progress
    qsaSelf(root, '[data-ld-progress]').forEach(function (bar) {
      if (!bar.hasAttribute('role')) bar.setAttribute('role', 'progressbar');
      if (!bar.hasAttribute('aria-valuemin')) bar.setAttribute('aria-valuemin', '0');
      if (!bar.hasAttribute('aria-valuemax')) bar.setAttribute('aria-valuemax', '100');
      if (!bar.hasAttribute('aria-label') && !bar.hasAttribute('aria-labelledby')) {
        var holder = bar.closest('[data-ld-progress-label]');
        bar.setAttribute('aria-label', holder ? holder.getAttribute('data-ld-progress-label') : 'Progress');
      }
    });

    // chips
    qsaSelf(root, '[data-ld-chip]').forEach(syncChip);

    // aria-current
    qsaSelf(root, CURRENT_SELECTOR).forEach(syncCurrent);

    // command palette
    qsaSelf(root, '.ld-command-backdrop').forEach(function (backdrop) {
      var input = backdrop.querySelector('.ld-command-input');
      var list = backdrop.querySelector('[data-ld-command-list]');
      if (input && list) {
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-expanded', 'true');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', ensureId(list, 'ld-cmdlist'));
        if (!input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby')) input.setAttribute('aria-label', input.getAttribute('placeholder') || 'Search commands');
        list.setAttribute('role', 'listbox');
        Array.prototype.forEach.call(list.querySelectorAll('[data-ld-command-item]'), function (item) {
          item.setAttribute('role', 'option');
          ensureId(item, 'ld-cmd');
        });
      }
    });

    // carousels
    qsaSelf(root, '[data-ld-carousel]').forEach(function (carousel) {
      if (carousel._ldA11y) return;
      carousel._ldA11y = true;
      if (!carousel.hasAttribute('role')) carousel.setAttribute('role', 'region');
      carousel.setAttribute('aria-roledescription', 'carousel');
      if (!carousel.hasAttribute('aria-label') && !carousel.hasAttribute('aria-labelledby')) carousel.setAttribute('aria-label', 'Carousel');
      var slides = carousel.querySelectorAll('[data-ld-carousel-slide], .ld-carousel-slide');
      Array.prototype.forEach.call(slides, function (slide, i) {
        if (!slide.hasAttribute('role')) slide.setAttribute('role', 'group');
        slide.setAttribute('aria-roledescription', 'slide');
        if (!slide.hasAttribute('aria-label')) slide.setAttribute('aria-label', (i + 1) + ' of ' + slides.length);
      });
      Array.prototype.forEach.call(carousel.querySelectorAll('[data-ld-carousel-dot]'), function (dot, i) {
        if (!dot.hasAttribute('aria-label')) dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      });
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        carousel.setAttribute('data-ld-autoplay', 'false');
        stopCarouselAutoplay(carousel);
      }
      carousel.addEventListener('focusin', function () { stopCarouselAutoplay(carousel); });
    });

    // legacy sortable headers (easy tables build their own buttons)
    qsaSelf(root, 'th[data-ld-sort]').forEach(function (th) {
      if (th.closest('table[data-ld-table]') || th._ldSortA11y) return;
      th._ldSortA11y = true;
      if (!th.hasAttribute('tabindex')) th.setAttribute('tabindex', '0');
      if (!th.hasAttribute('aria-sort')) th.setAttribute('aria-sort', 'none');
    });

    // skip links
    qsaSelf(root, '.ld-skip-link[href^="#"]').forEach(function (link) {
      var target = document.getElementById(link.getAttribute('href').slice(1));
      if (target && !target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
    });
  }

  /* attributes that other components flip — mirror them into ARIA */
  if (window.MutationObserver) {
    var attrWatcher = new MutationObserver(function (records) {
      records.forEach(function (rec) {
        var el = rec.target;
        if (el.nodeType !== 1) return;
        if (rec.attributeName === 'data-ld-active') {
          if (el.matches(CURRENT_SELECTOR)) syncCurrent(el);
          else if (el.hasAttribute('data-ld-chip')) syncChip(el);
        } else if (rec.attributeName === 'data-ld-highlighted' && el.matches('[data-ld-command-item]')) {
          syncCommandActive(el);
        }
      });
    });
    var startAttrWatcher = function () {
      if (document.body) attrWatcher.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-ld-active', 'data-ld-highlighted'] });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startAttrWatcher); else startAttrWatcher();
  }

  /* dropdown keyboard */
  function dropdownItems(menu) {
    return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'));
  }

  function focusMenuItem(menu, item) {
    dropdownItems(menu).forEach(function (it) { it.setAttribute('tabindex', '-1'); });
    if (item) { item.setAttribute('tabindex', '0'); item.focus(); }
  }

  document.addEventListener('keydown', function (e) {
    var dd = e.target.closest && e.target.closest('[data-ld-dropdown]');
    if (!dd) return;
    var menu = dd.querySelector('[data-ld-dropdown-menu]');
    if (!menu) return;
    var trigger = dd.querySelector('[data-ld-toggle="dropdown"]');
    var open = menu.classList.contains('ld-show');
    var items = dropdownItems(menu);
    if (e.target === trigger && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      if (!open) trigger.click();
      setTimeout(function () { var list = dropdownItems(menu); focusMenuItem(menu, e.key === 'ArrowUp' ? list[list.length - 1] : list[0]); }, 0);
      return;
    }
    if (!open || !menu.contains(e.target)) return;
    var i = items.indexOf(e.target);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusMenuItem(menu, items[(i + 1) % items.length]); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusMenuItem(menu, items[i <= 0 ? items.length - 1 : i - 1]); }
    else if (e.key === 'Home') { e.preventDefault(); focusMenuItem(menu, items[0]); }
    else if (e.key === 'End') { e.preventDefault(); focusMenuItem(menu, items[items.length - 1]); }
    else if (e.key === 'Tab') { menu.classList.remove('ld-show'); if (trigger) trigger.setAttribute('aria-expanded', 'false'); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var ch = e.key.toLowerCase();
      var hit = items.slice(i + 1).concat(items.slice(0, i + 1)).filter(function (it) { return it.textContent.trim().toLowerCase().indexOf(ch) === 0; })[0];
      if (hit) focusMenuItem(menu, hit);
    }
  });

  /* Esc hides a visible tooltip without moving focus */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var tipEl = document.querySelector('[data-ld-tooltip]:focus-visible, [data-ld-tooltip]:hover');
    if (tipEl) tipEl.setAttribute('data-ld-tooltip-dismissed', 'true');
  });

  document.addEventListener('keydown', function (e) {
    var th = e.target.closest && e.target.closest('th[data-ld-sort]');
    if (th && e.target === th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); th.click(); }
  });

  /* switching a sortable header updates the status the same way for plain tables */
  document.addEventListener('ld:table:sort', function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute('data-ld-table')) return; // easy tables announce themselves
    var d = e.detail || {};
    announce(d.direction ? 'Sorted ' + (d.direction === 'asc' ? 'ascending' : 'descending') : 'Sorting cleared');
  });

  /* dialogs: name, and keep the rest of the page out of reach */
  var inertMarks = [];

  function labelDialog(dialog) {
    if (dialog.hasAttribute('aria-label') || dialog.hasAttribute('aria-labelledby')) return;
    var heading = dialog.querySelector('h1, h2, h3, h4, h5, h6, .ld-modal-title, .ld-offcanvas-title');
    if (heading) dialog.setAttribute('aria-labelledby', ensureId(heading, 'ld-dialog-title'));
  }

  function makeRestInert(dialog) {
    releaseInert();
    var node = dialog;
    while (node && node !== document.body) {
      var parent = node.parentNode;
      if (!parent) break;
      Array.prototype.forEach.call(parent.children, function (sib) {
        if (sib === node || sib.hasAttribute('inert')) return;
        if (/^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(sib.tagName)) return;
        if (sib.classList.contains('ld-toast-container') || sib.hasAttribute('aria-live') || sib.classList.contains('ld-sr-only')) return;
        sib.setAttribute('inert', '');
        inertMarks.push(sib);
      });
      node = parent;
    }
  }

  function releaseInert() {
    inertMarks.forEach(function (el) { el.removeAttribute('inert'); });
    inertMarks = [];
  }

  ['modal', 'offcanvas', 'command'].forEach(function (kind) {
    document.addEventListener('ld:' + kind + ':show', function (e) {
      var host = e.target;
      var dialog = host.matches && host.matches('[role="dialog"]') ? host : (host.querySelector && host.querySelector('[role="dialog"]')) || host;
      labelDialog(dialog);
      // wait one frame: the component marks its box role=dialog while opening
      setTimeout(function () {
        var d = host.matches && host.matches('[role="dialog"]') ? host : (host.querySelector && host.querySelector('[role="dialog"]')) || host;
        labelDialog(d);
        makeRestInert(host);
      }, 0);
    });
    document.addEventListener('ld:' + kind + ':hide', function () {
      var stillOpen = document.querySelector('.ld-modal-backdrop.ld-show, .ld-offcanvas-backdrop.ld-show, .ld-command-backdrop.ld-show');
      if (!stillOpen) releaseInert();
    });
  });

  /* forms: aria-invalid once the field has been touched */
  function syncInvalid(field) {
    if (!field.closest || !field.closest('.ld-validate, form[data-ld-validate]')) return;
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(field.tagName)) return;
    var bad;
    try { bad = field.matches(':user-invalid'); } catch (err) { bad = field._ldTouched && !field.validity.valid; }
    if (bad) field.setAttribute('aria-invalid', 'true');
    else if (field.getAttribute('aria-invalid') === 'true') field.removeAttribute('aria-invalid');
  }

  document.addEventListener('focusout', function (e) { e.target._ldTouched = true; syncInvalid(e.target); });
  document.addEventListener('input', function (e) { if (e.target.getAttribute && e.target.getAttribute('aria-invalid')) syncInvalid(e.target); });
  document.addEventListener('invalid', function (e) { e.target._ldTouched = true; syncInvalid(e.target); }, true);

  /* -- audit ----------------------------------------------------------------- */

  function accessibleName(el) {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    var by = el.getAttribute('aria-labelledby');
    if (by) return by.split(/\s+/).map(function (id) { var n = document.getElementById(id); return n ? n.textContent : ''; }).join(' ').trim();
    if (el.id) { var lab = document.querySelector('label[for="' + el.id + '"]'); if (lab) return lab.textContent.trim(); }
    var wrapping = el.closest('label');
    if (wrapping) return wrapping.textContent.trim();
    if (el.getAttribute('title')) return el.getAttribute('title').trim();
    return (el.textContent || '').trim() || (el.querySelector && el.querySelector('img[alt]') ? el.querySelector('img[alt]').getAttribute('alt').trim() : '');
  }

  function audit(root) {
    root = root || document;
    var found = [];
    // elements inside [hidden] (for example other pages of a tabbed layout) are not on screen, so they are skipped
    var visibleAll = function (scope, selector) {
      return qsaSelf(scope, selector).filter(function (el) { return !el.closest('[hidden]'); });
    };
    var add = function (rule, message, element) { found.push({ rule: rule, message: message, element: element }); };

    visibleAll(root, 'img:not([alt])').forEach(function (el) { add('img-alt', 'Image without alt text (use alt="" if decorative)', el); });
    visibleAll(root, 'button, [role="button"], a[href]').forEach(function (el) {
      if (!accessibleName(el)) add('name', 'Interactive element with no accessible name', el);
    });
    visibleAll(root, 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea').forEach(function (el) {
      if (!accessibleName(el) && !el.getAttribute('placeholder')) add('label', 'Form field with no label', el);
      else if (!accessibleName(el)) add('label', 'Form field labelled only by its placeholder', el);
    });
    var ids = {};
    visibleAll(root, '[id]').forEach(function (el) {
      if (ids[el.id]) add('duplicate-id', 'Duplicate id "' + el.id + '"', el);
      ids[el.id] = true;
    });
    visibleAll(root, '[aria-controls], [aria-labelledby], [aria-describedby], [data-ld-target]').forEach(function (el) {
      ['aria-controls', 'aria-labelledby', 'aria-describedby'].forEach(function (attr) {
        var v = el.getAttribute(attr);
        if (v) v.split(/\s+/).forEach(function (id) { if (!document.getElementById(id)) add('aria-ref', attr + ' points at missing id "' + id + '"', el); });
      });
    });
    visibleAll(root, '[tabindex]').forEach(function (el) { if (parseInt(el.getAttribute('tabindex'), 10) > 0) add('tabindex', 'Positive tabindex breaks the natural focus order', el); });
    visibleAll(root, '[role="button"]:not(button):not([tabindex])').forEach(function (el) { add('keyboard', 'role="button" that cannot receive focus', el); });
    if (root === document) {
      if (!document.documentElement.getAttribute('lang')) add('lang', '<html> has no lang attribute', document.documentElement);
      if (!visibleAll(document, 'main, [role="main"]').length) add('landmark', 'No <main> landmark', document.body);
      if (!document.title) add('title', 'Page has no <title>', document.documentElement);
      var h1 = visibleAll(document, 'h1');
      if (h1.length !== 1) add('h1', h1.length ? 'More than one <h1>' : 'No <h1>', h1[0] || document.body);
    }
    var last = 0;
    visibleAll(root, 'h1, h2, h3, h4, h5, h6').forEach(function (h) {
      var level = parseInt(h.tagName.charAt(1), 10);
      if (last && level > last + 1) add('heading-order', 'Heading level jumps from h' + last + ' to h' + level, h);
      last = level;
    });
    if (found.length && window.console && console.table) {
      console.table(found.map(function (f) { return { rule: f.rule, message: f.message, element: f.element }; }));
    }
    return found;
  }

  moduleInits.push(initA11y);
  window.ldcss.a11y = { audit: audit };



  document.addEventListener('dragover', handleDropzoneDragOver);
  document.addEventListener('dragleave', handleDropzoneDragLeave);
  document.addEventListener('drop', handleDropzoneDrop);

  initTheme();
  initProgressBars();
  initRatings();
  initPagination();
  initAnimations();
  initSteppers();
  initRovingTabindex();
  initScrollspy();
  initCarousels();
  initInputClear();
  initAutosize();
  moduleInits.forEach(function (fn) { fn(document); });

  /* ---------------------------------------------------------------------
     Mutation-aware initializer. A MutationObserver on <body> runs the same
     setup as ldcss.refresh() on every element added to the page, so markup
     from fetch(), innerHTML or a framework just works — no manual
     ldcss.refresh() call. Opt out with <body data-ld-observe="false">, or
     for one subtree with data-ld-no-observe. ldcss.unobserve() /
     ldcss.observe() switch it off and on at runtime.
     ------------------------------------------------------------------- */
  var observer = null;

  function runInitializers(root) {
    initProgressBars(root);
    initRatings(root);
    initPagination(root);
    initAnimations(root);
    initSteppers(root);
    initRovingTabindex(root);
    initScrollspy(root);
    initCarousels(root);
    initInputClear(root);
    initAutosize(root);
    moduleInits.forEach(function (fn) { fn(root); });
  }

  function observeDom(target) {
    if (observer || !window.MutationObserver) return;
    target = target || document.body;
    if (!target) return;
    var options = { childList: true, subtree: true };
    observer = new MutationObserver(function (records) {
      var added = [];
      records.forEach(function (record) {
        Array.prototype.forEach.call(record.addedNodes, function (node) {
          if (node.nodeType === 1 && !node.closest('[data-ld-no-observe]')) added.push(node);
        });
        Array.prototype.forEach.call(record.removedNodes, function (node) {
          if (node.nodeType === 1) qsaSelf(node, '[data-ld-carousel]').forEach(stopCarouselAutoplay);
        });
      });
      // only the outermost added elements: their descendants are covered
      added = added.filter(function (node, i) {
        return node.isConnected && !added.some(function (other, j) { return j !== i && other.contains(node); });
      });
      if (!added.length) return;
      // Initializers add DOM themselves (pagination buttons, clear buttons…).
      // Pause while they run and drop what they caused, so it cannot loop.
      observer.disconnect();
      try {
        added.forEach(function (node) {
          runInitializers(node);
          emit(node, 'ld:init', { root: node });
        });
      } finally {
        observer.takeRecords();
        observer.observe(target, options);
      }
    });
    observer.observe(target, options);
  }

  function unobserveDom() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  function startObserver() {
    if (document.body && document.body.getAttribute('data-ld-observe') !== 'false') observeDom();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver);
  else startObserver();

  /* ---------------------------------------------------------------------
     Public re-init API — for content added after DOMContentLoaded
     (fetch results, tab lazy-load, framework-patched DOM, etc).
     Delegated listeners (clicks, keydown, dropzone change/drag) already
     work on new elements automatically — only the one-time attribute/DOM
     sweeps below need to be re-run, scoped to whatever you just added.
     ------------------------------------------------------------------- */
  window.ldcss = window.ldcss || {};
  window.ldcss.refresh = runInitializers;
  window.ldcss.observe = observeDom;
  window.ldcss.unobserve = unobserveDom;
  window.ldcss.on = on;
  window.ldcss.off = off;
  window.ldcss.once = once;
  window.ldcss.emit = emit;
  window.ldcss.announce = announce;

  window.ldcss.debounce = debounce;

  /* Coarse teardown: disconnects every entrance-animation
     IntersectionObserver. Delegated listeners (click/input/keydown/drag)
     don't need teardown — they're bound once on document and no-op
     harmlessly on elements that no longer exist. Call this before
     removing a large chunk of DOM that contained [data-ld-animate]
     elements, then call ldcss.refresh() again for whatever's left. */
  window.ldcss.destroy = function () {
    activeAnimationObservers.forEach(function (observer) { observer.disconnect(); });
    activeAnimationObservers = [];
    unobserveDom();
    qsaSelf(document, '[data-ld-carousel]').forEach(stopCarouselAutoplay);
  };
})();
