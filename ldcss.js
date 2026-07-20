/*!
 * ldcss.js — Lena Dijksma CSS
 * Zero-dependency behavior for data-ld-* interactive components.
 * Components: theme toggle, dropdown, tabs, modal.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ld-theme';

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

  function toggleFloating(trigger, panelAttr) {
    var targetSel = trigger.getAttribute('data-ld-target');
    var panel = targetSel ? document.querySelector(targetSel) : trigger.parentElement.querySelector('[' + panelAttr + ']');
    if (!panel) return;
    var isOpen = panel.classList.contains('ld-show');
    closeAllFloating(panelAttr);
    if (!isOpen) panel.classList.add('ld-show');
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
    });
    trigger.setAttribute('data-ld-active', 'true');

    if (panelGroup) {
      panelGroup.querySelectorAll('[data-ld-tab-panel]').forEach(function (p) {
        p.classList.remove('ld-show');
      });
    }
    panel.classList.add('ld-show');
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
      });
      wrapper.querySelectorAll('.ld-accordion-trigger').forEach(function (t) {
        t.setAttribute('data-ld-active', 'false');
      });
    }

    panel.classList.toggle('ld-show', !isOpen);
    trigger.setAttribute('data-ld-active', String(!isOpen));
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
     Modal
     ------------------------------------------------------------------- */

  function openModal(targetSel) {
    var backdrop = document.querySelector(targetSel);
    if (!backdrop) return;
    backdrop.classList.add('ld-show');
    var focusable = backdrop.querySelector('[data-ld-autofocus]') || backdrop.querySelector('button, input, a');
    if (focusable) focusable.focus();
  }

  function closeModal(backdrop) {
    backdrop.classList.remove('ld-show');
  }

  function closeAllModals() {
    document.querySelectorAll('.ld-modal-backdrop.ld-show').forEach(closeModal);
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
        toggleFloating(toggleEl, 'data-ld-dropdown-menu');
      } else if (kind === 'popover') {
        e.preventDefault();
        toggleFloating(toggleEl, 'data-ld-popover-content');
      } else if (kind === 'tab') {
        e.preventDefault();
        handleTabToggle(toggleEl);
      } else if (kind === 'modal') {
        e.preventDefault();
        openModal(toggleEl.getAttribute('data-ld-target'));
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

    var dismissEl = e.target.closest('[data-ld-dismiss="modal"]');
    if (dismissEl) {
      var backdrop = dismissEl.closest('.ld-modal-backdrop');
      if (backdrop) closeModal(backdrop);
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
    }
  });

  initTheme();
  initProgressBars();
})();
