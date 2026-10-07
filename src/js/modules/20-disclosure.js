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

  defineComponent('disclosure', '[data-ld-disclosure], .ld-disclosure', function (el) {
    if (el.hasAttribute('data-ld-disclosure')) {
      var panel = disclosurePanel(el);
      if (!panel) return;
      el.setAttribute('aria-controls', ensureId(panel, 'ld-disclosure'));
      if (el.tagName !== 'BUTTON' && !el.hasAttribute('tabindex')) { el.setAttribute('tabindex', '0'); el._ldAddedTabindex = true; }
      if (el.tagName !== 'BUTTON' && !el.hasAttribute('role')) { el.setAttribute('role', 'button'); el._ldAddedRole = true; }
      paintDisclosure(panel, panel.getAttribute('data-ld-open') === 'true');
    }
    if (el.classList.contains('ld-disclosure')) {
      paintDisclosure(el, el.getAttribute('data-ld-open') === 'true');
    }
  }, function (el) {
    if (el.classList.contains('ld-disclosure')) {
      el.removeAttribute('inert'); // an open or closed panel stays as it is, but must be reachable
    }
    if (el.hasAttribute('data-ld-disclosure')) {
      if (el._ldAddedTabindex) { el.removeAttribute('tabindex'); el._ldAddedTabindex = false; }
      if (el._ldAddedRole) { el.removeAttribute('role'); el._ldAddedRole = false; }
    }
  }, { gate: true });

  delegate('click', function (e) {
    var trigger = e.target.closest && closestOf(e.target, '[data-ld-disclosure]');
    if (!trigger || trigger.disabled || trigger.getAttribute('aria-disabled') === 'true') return;
    var panelOf = disclosurePanel(trigger);
    if (panelOf && isDestroyed(panelOf)) return;
    if (trigger.tagName === 'A') e.preventDefault();
    setDisclosure(trigger, !isDisclosureOpen(trigger), trigger);
  });

  // non-button triggers (role="button") need Enter / Space themselves
  delegate('keydown', function (e) {
    var trigger = e.target.closest && closestOf(e.target, '[data-ld-disclosure]');
    if (!trigger || trigger.tagName === 'BUTTON' || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    setDisclosure(trigger, !isDisclosureOpen(trigger), trigger);
  });

  window.ldcss.disclosure = {
    show: function (ref) { return setDisclosure(ref, true); },
    hide: function (ref) { return setDisclosure(ref, false); },
    toggle: function (ref, force) { return setDisclosure(ref, force == null ? !isDisclosureOpen(ref) : force); },
    isOpen: isDisclosureOpen
  };

