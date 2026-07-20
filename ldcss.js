/*!
 * ldcss.js — Lena Dijksma CSS
 * Zero-dependency behavior for data-ld-* interactive components.
 * Components: theme toggle, dropdown, popover, tabs, accordion, modal,
 * offcanvas, command palette, toast, copy-to-clipboard, dropzone, rating,
 * tag input, progress bars.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ld-theme';
  var lastFocusedEl = null;

  /* ---------------------------------------------------------------------
     Theme
     ------------------------------------------------------------------- */

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved) {
      document.documentElement.setAttribute('data-ld-theme', saved);
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
      if (el !== except) el.classList.remove('ld-show');
    });
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
      trigger.setAttribute('aria-expanded', 'true');
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
  }

  function closeModal(backdrop) {
    backdrop.classList.remove('ld-show');
    returnFocus();
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
  }

  function closeOffcanvas(backdrop) {
    backdrop.classList.remove('ld-show');
    returnFocus();
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
  }

  function closeCommand(backdrop) {
    backdrop.classList.remove('ld-show');
    returnFocus();
  }

  function closeAllCommands() {
    document.querySelectorAll('.ld-command-backdrop.ld-show').forEach(closeCommand);
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
     Delegated event wiring
     ------------------------------------------------------------------- */

  document.addEventListener('click', function (e) {
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
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeAllDropdowns();
      closeAllPopovers();
      closeAllModals();
      closeAllOffcanvas();
      closeAllCommands();
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
    trapTab(e);
  });

  document.addEventListener('input', function (e) {
    var commandInput = e.target.closest('.ld-command-input');
    if (commandInput) {
      var backdrop = commandInput.closest('.ld-command-backdrop');
      if (backdrop) filterCommandList(backdrop, commandInput.value);
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
})();
