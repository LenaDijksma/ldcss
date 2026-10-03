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

