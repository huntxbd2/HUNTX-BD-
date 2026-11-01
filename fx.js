/* HuntX BD — FX layer: RGB lights, color grading overlay, click + touch animations.
   Add-on only. Touches no app logic. */
(function () {
    'use strict';
    function mk(tag, id, cls) {
        var e = document.createElement(tag);
        if (id) e.id = id;
        if (cls) e.className = cls;
        return e;
    }
    function init() {
        if (document.getElementById('hx-grade')) return;
        // color grading + aurora + top RGB line
        var aur = mk('div', 'hx-aurora');
        aur.innerHTML = '<span class="a1"></span><span class="a2"></span><span class="a3"></span>';
        document.body.appendChild(aur);
        document.body.appendChild(mk('div', 'hx-grade'));
        document.body.appendChild(mk('div', 'hx-rgb-top', 'hx-rgb-line'));

        var hue = 0;
        var lastTrail = 0;
        var PRESS_SEL = 'button, .nav-item, .category-card, .match-card, .menu-item, .tab, .tx-tab, .notif-card, .admin-mod, .wallet-learn-item, .wallet-quick-card, .home-support-card, .dep-tab, .notif-filter, .notif-tab, .pay-box';

        function ripple(x, y) {
            var r = mk('span', null, 'hx-ripple');
            r.style.left = x + 'px';
            r.style.top = y + 'px';
            document.body.appendChild(r);
            setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 700);
        }
        function trail(x, y) {
            var t = mk('span', null, 'hx-trail');
            hue = (hue + 18) % 360;
            t.style.left = x + 'px';
            t.style.top = y + 'px';
            t.style.background = 'radial-gradient(circle, hsla(' + hue + ',100%,70%,0.95), hsla(' + ((hue + 60) % 360) + ',100%,60%,0.35) 60%, transparent 72%)';
            t.style.boxShadow = '0 0 14px hsla(' + hue + ',100%,65%,0.7)';
            document.body.appendChild(t);
            setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 600);
        }

        var pressed = null;
        function release() {
            if (pressed) { pressed.classList.remove('hx-press'); pressed = null; }
        }
        document.addEventListener('pointerdown', function (e) {
            ripple(e.clientX, e.clientY);
            trail(e.clientX, e.clientY);
            var el = e.target.closest ? e.target.closest(PRESS_SEL) : null;
            if (el && !el.disabled) { pressed = el; el.classList.add('hx-press'); }
        }, { passive: true });
        document.addEventListener('pointermove', function (e) {
            if (e.pointerType === 'mouse' && e.buttons === 0) return;
            var now = Date.now();
            if (now - lastTrail < 45) return;
            lastTrail = now;
            trail(e.clientX, e.clientY);
        }, { passive: true });
        ['pointerup', 'pointercancel', 'pointerleave', 'scroll'].forEach(function (ev) {
            document.addEventListener(ev, release, { passive: true, capture: true });
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
