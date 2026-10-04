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
    var item = e.target.closest && closestOf(e.target, '.ld-context-item');
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
    else if ((e.key || '').length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var ch = e.key.toLowerCase(), ordered = items.slice(index + 1).concat(items.slice(0, index + 1));
      var hit = ordered.filter(function (it) { return it.textContent.trim().toLowerCase().indexOf(ch) === 0; })[0];
      if (hit) focusContextItem(menu, hit);
    }
  }, true);

  document.addEventListener('mouseover', function (e) {
    var item = e.target.closest && closestOf(e.target, '.ld-context-item');
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

