/*!
 * ldcss.js — Lena Dijksma CSS
 * Zero-dependency behavior for data-ld-* interactive components.
 * Components: theme toggle, dropdown, popover, tabs, accordion, modal,
 * offcanvas, command palette, toast, copy-to-clipboard, dropzone, rating,
 * tag input, progress bars, entrance animations, segmented control,
 * filter chips, stepper, combobox, scrollspy, carousel, navbar collapse,
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

  function emit(el, name, detail) {
    if (!el) return;
    el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail || {} }));
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
    (root || document).querySelectorAll('[data-ld-progress]').forEach(function (bar) {
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
    var els = (root || document).querySelectorAll('[data-ld-animate]');
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

  function getToastContainer() {
    var container = document.querySelector('.ld-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'ld-toast-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      // Read the desired corner once, at creation time, from
      // data-ld-toast-position on <body> (falls back to the default
      // top-right if unset). Set it before the first toast fires.
      var position = document.body.getAttribute('data-ld-toast-position');
      if (position) container.setAttribute('data-ld-position', position);
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, variant, duration) {
    var container = getToastContainer();
    var toast = document.createElement('div');
    toast.className = 'ld-toast';
    if (variant) toast.setAttribute('data-ld-variant', variant);

    var body = document.createElement('div');
    body.className = 'ld-toast-body';
    body.textContent = message;
    toast.appendChild(body);

    var close = document.createElement('button');
    close.className = 'ld-toast-close';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '×';
    close.addEventListener('click', function () { toast.remove(); });
    toast.appendChild(close);

    container.appendChild(toast);
    setTimeout(function () { toast.remove(); }, duration || 3000);
    return toast;
  }

  function handleToastTrigger(trigger) {
    var message = trigger.getAttribute('data-ld-toast-message') || 'Notification';
    var variant = trigger.getAttribute('data-ld-toast-variant');
    var duration = parseInt(trigger.getAttribute('data-ld-toast-duration'), 10);
    showToast(message, variant, isNaN(duration) ? undefined : duration);
  }

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
    (root || document).querySelectorAll('.ld-pagination').forEach(function (pagination) {
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
    (root || document).querySelectorAll('[data-ld-rating]').forEach(function (wrapper) {
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

    var label = document.createElement('span');
    label.textContent = text;
    tag.appendChild(label);

    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ld-tag-remove';
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
      var tags = wrap ? wrap.querySelectorAll('.ld-tag') : [];
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
    (root || document).querySelectorAll('[data-ld-stepper]').forEach(function (stepper) {
      goToStep(stepper, currentStepIndex(stepper));
    });
  }

  /* ---------------------------------------------------------------------
     Combobox / autocomplete
     ------------------------------------------------------------------- */

  function getComboboxList(box) { return box.querySelector('[data-ld-combobox-list]'); }

  function openCombobox(box) {
    var list = getComboboxList(box);
    if (list) list.classList.add('ld-show');
  }

  function closeCombobox(box) {
    var list = getComboboxList(box);
    if (list) {
      list.classList.remove('ld-show');
      list.querySelectorAll('[data-ld-combobox-option]').forEach(function (o) {
        o.removeAttribute('data-ld-highlighted');
      });
    }
  }

  function closeAllComboboxes(except) {
    document.querySelectorAll('[data-ld-combobox]').forEach(function (box) {
      if (box !== except) closeCombobox(box);
    });
  }

  function filterCombobox(box, query) {
    var list = getComboboxList(box);
    var empty = box.querySelector('[data-ld-combobox-empty]');
    if (!list) return;
    var q = query.trim().toLowerCase();
    var visible = 0;
    list.querySelectorAll('[data-ld-combobox-option]').forEach(function (opt) {
      var match = !q || opt.textContent.toLowerCase().indexOf(q) !== -1;
      opt.classList.toggle('ld-hide', !match);
      if (match) visible++;
    });
    if (empty) empty.classList.toggle('ld-show', visible === 0);
  }

  function highlightComboboxOption(box, index) {
    var options = Array.prototype.slice.call(box.querySelectorAll('[data-ld-combobox-option]:not(.ld-hide)'));
    options.forEach(function (o) { o.removeAttribute('data-ld-highlighted'); });
    if (options[index]) {
      options[index].setAttribute('data-ld-highlighted', 'true');
      options[index].scrollIntoView({ block: 'nearest' });
    }
    return options;
  }

  function selectComboboxOption(option) {
    var box = option.closest('[data-ld-combobox]');
    if (!box) return;
    var input = box.querySelector('input');
    if (input) {
      input.value = option.getAttribute('data-ld-value') || option.textContent.trim();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closeCombobox(box);
  }

  function handleComboboxKeydown(e) {
    var box = e.target.closest('[data-ld-combobox]');
    if (!box) return;
    var list = getComboboxList(box);
    if (!list || !list.classList.contains('ld-show')) {
      if (e.key === 'ArrowDown') { e.preventDefault(); openCombobox(box); highlightComboboxOption(box, 0); }
      return;
    }
    var options = Array.prototype.slice.call(box.querySelectorAll('[data-ld-combobox-option]:not(.ld-hide)'));
    var currentIndex = options.findIndex(function (o) { return o.getAttribute('data-ld-highlighted') === 'true'; });

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightComboboxOption(box, Math.min(options.length - 1, currentIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightComboboxOption(box, Math.max(0, currentIndex - 1));
    } else if (e.key === 'Enter') {
      var chosen = options[currentIndex];
      if (chosen) { e.preventDefault(); selectComboboxOption(chosen); }
    } else if (e.key === 'Escape') {
      closeCombobox(box);
    }
  }

  /* ---------------------------------------------------------------------
     Roving tabindex — tabs and segmented control
     Only the active item in each group is a tab stop; Tab key jumps
     straight to the panel content, arrow keys move between options
     within the group (the same pattern browsers use for native radio
     buttons, and what the ARIA tabs/toolbar authoring practice expects).
     ------------------------------------------------------------------- */

  function initRovingTabindex(root) {
    (root || document).querySelectorAll('[data-ld-tabs]').forEach(function (group) {
      var triggers = Array.prototype.slice.call(group.querySelectorAll('[data-ld-toggle="tab"]'));
      triggers.forEach(function (t) {
        t.setAttribute('tabindex', t.getAttribute('data-ld-active') === 'true' ? '0' : '-1');
      });
    });
    (root || document).querySelectorAll('[data-ld-segmented]').forEach(function (group) {
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
    (root || document).querySelectorAll('[data-ld-scrollspy]').forEach(function (nav) {
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
    (root || document).querySelectorAll('[data-ld-carousel]').forEach(function (carousel) {
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
    (root || document).querySelectorAll('[data-ld-input-clear]').forEach(function (clearBtn) {
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
    (root || document).querySelectorAll('[data-ld-autosize]').forEach(function (el) {
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
        if (comboboxEl) { openCombobox(comboboxEl); filterCombobox(comboboxEl, ''); }
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

    var tagRemoveEl = e.target.closest('.ld-tag-remove');
    if (tagRemoveEl) {
      var tagEl = tagRemoveEl.closest('.ld-tag');
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
      var box = comboboxInput.closest('[data-ld-combobox]');
      openCombobox(box);
      filterCombobox(box, comboboxInput.value);
      highlightComboboxOption(box, 0);
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

  /* ---------------------------------------------------------------------
     Public re-init API — for content added after DOMContentLoaded
     (fetch results, tab lazy-load, framework-patched DOM, etc).
     Delegated listeners (clicks, keydown, dropzone change/drag) already
     work on new elements automatically — only the one-time attribute/DOM
     sweeps below need to be re-run, scoped to whatever you just added.
     ------------------------------------------------------------------- */
  window.ldcss = window.ldcss || {};
  window.ldcss.refresh = function (root) {
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
  };

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
  };

  initTheme();
})();
