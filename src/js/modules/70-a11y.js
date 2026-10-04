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
    var dd = e.target.closest && closestOf(e.target, '[data-ld-dropdown]');
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
    else if ((e.key || '').length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
    var th = e.target.closest && closestOf(e.target, 'th[data-ld-sort]');
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

  /* Only the top dialog is reachable. Recomputed on every open and close, so with stacked
     dialogs the one underneath is inert while another sits on top of it, and becomes
     reachable again, with the page still locked out, when the top one closes. */
  function syncInert() {
    var top = topOverlay();
    if (top) makeRestInert(top.el); else releaseInert();
  }

  ['modal', 'offcanvas', 'command'].forEach(function (kind) {
    document.addEventListener('ld:' + kind + ':show', function (e) {
      var host = e.target;
      // wait a tick: the component marks its box role=dialog while opening
      setTimeout(function () {
        var d = host.matches && host.matches('[role="dialog"]') ? host : (host.querySelector && host.querySelector('[role="dialog"]')) || host;
        labelDialog(d);
        syncInert();
      }, 0);
    });
    document.addEventListener('ld:' + kind + ':hide', function () { setTimeout(syncInert, 0); });
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

