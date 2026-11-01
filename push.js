/* HuntX BD — Push notifications (add-on). ADMIN-CONTROLLED.
   - Admin → App Control: master ON/OFF switch + title + details + "Send".
   - When ON, every user's device (that has granted permission) shows the
     notification. Users get a one-time permission prompt on their first tap;
     there is no user-side toggle.
   State lives in Firestore config/pushMessage = { value: {enabled,id,title,body,ts} }.
   Works while app/browser is open or in background; fully-closed push needs FCM. */
(function () {
    'use strict';
    var LS_SEEN = 'hx_push_seen';
    var swReg = null;
    var state = { enabled: false };
    var asked = false;
    var listening = false;
    var first = true;

    function supported() { return 'Notification' in window; }
    function say(m) { try { if (typeof toast === 'function') toast(m); } catch (e) {} }

    function registerSW() {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('./sw.js').then(function (r) { swReg = r; }).catch(function () {});
    }

    function showNote(title, body, id) {
        var opts = { body: body || '', icon: 'logo.png', badge: 'logo.png', tag: 'hx-' + (id || Date.now()), vibrate: [120, 60, 120], data: { url: './' } };
        try {
            if (swReg && swReg.showNotification) { swReg.showNotification(title, opts); return; }
            if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready.then(function (r) { r.showNotification(title, opts); }).catch(function () { try { new Notification(title, opts); } catch (e) {} });
                return;
            }
        } catch (e) {}
        try { new Notification(title, opts); } catch (e2) {}
    }

    // One-time permission request on the user's first tap (browsers require a gesture)
    function armPermission() {
        if (!supported() || asked) return;
        if (Notification.permission !== 'default') return;
        var h = function () {
            document.removeEventListener('pointerdown', h, true);
            if (asked || !state.enabled) return;
            asked = true;
            try { Notification.requestPermission(); } catch (e) {}
        };
        document.addEventListener('pointerdown', h, true);
    }

    function onState(snap) {
        var m = null;
        if (snap && snap.exists) { var d = snap.data(); m = d.value !== undefined ? d.value : d; }
        state = m || { enabled: false };
        syncAdminSwitch();
        if (!state.enabled) return;
        armPermission();
        if (!state.id) return;
        var seen = '';
        try { seen = localStorage.getItem(LS_SEEN) || ''; } catch (e) {}
        if (String(state.id) === seen) return;
        try { localStorage.setItem(LS_SEEN, String(state.id)); } catch (e) {}
        // On app open, skip messages older than 24h
        if (first) { first = false; if (Date.now() - (Number(state.ts) || 0) > 24 * 3600 * 1000) return; }
        first = false;
        if (supported() && Notification.permission === 'granted') showNote(state.title || 'HuntX BD', state.body || '', state.id);
    }

    function listen() {
        if (listening) return;
        if (typeof firebaseReady === 'undefined' || !firebaseReady || typeof db === 'undefined' || !db) return;
        listening = true;
        db.collection('config').doc('pushMessage').onSnapshot(onState, function () {});
    }

    // ---- admin box (App Control) ----
    function syncAdminSwitch() {
        var chk = document.getElementById('hx-push-master');
        if (chk) chk.checked = !!state.enabled;
    }
    function save(patch) {
        var next = {};
        for (var k in state) next[k] = state[k];
        for (var p in patch) next[p] = patch[p];
        return cloudSetConfig('pushMessage', next);
    }
    function injectAdminBox() {
        var c = document.getElementById('admin-content');
        if (!c || document.getElementById('hx-admin-push')) return;
        if (!c.querySelector('#set-app-theme')) return;
        var box = document.createElement('div');
        box.id = 'hx-admin-push';
        box.className = 'admin-section';
        box.innerHTML =
            '<h3>🔔 Push Notification</h3>' +
            '<div class="hx-push-card" style="margin:0 0 12px;">' +
                '<i class="fas fa-bell hx-ic"></i>' +
                '<div class="hx-push-txt"><strong>পুশ নোটিফিকেশন চালু</strong><span>চালু থাকলে সবার ফোনে নোটিফিকেশন যাবে</span></div>' +
                '<label class="hx-switch"><input type="checkbox" id="hx-push-master"><span class="hx-knob"></span></label>' +
            '</div>' +
            '<div class="form-group"><label>টাইটেল</label><input type="text" id="hx-push-title" placeholder="যেমন: নতুন ম্যাচ শুরু!" maxlength="60"></div>' +
            '<div class="form-group"><label>বিস্তারিত</label><textarea id="hx-push-body" rows="3" maxlength="200" style="width:100%;padding:10px;border:2px solid #dfe6e9;border-radius:10px;font-family:inherit;" placeholder="নোটিফিকেশনের বিস্তারিত লিখুন..."></textarea></div>' +
            '<button type="button" class="btn-primary" id="hx-push-send">🔔 Send to Everyone</button>';
        c.insertBefore(box, c.firstChild);
        syncAdminSwitch();
        box.querySelector('#hx-push-master').addEventListener('change', function (e) {
            if (!currentUser || !currentUser.isAdmin) { e.target.checked = !!state.enabled; return say('শুধু অ্যাডমিন'); }
            var on = e.target.checked;
            save({ enabled: on }).then(function () { say(on ? 'Push চালু হয়েছে' : 'Push বন্ধ হয়েছে'); })
                .catch(function () { e.target.checked = !on; say('ব্যর্থ হয়েছে'); });
        });
        box.querySelector('#hx-push-send').addEventListener('click', function () {
            if (!currentUser || !currentUser.isAdmin) return say('শুধু অ্যাডমিন');
            if (!state.enabled) return say('আগে উপরের সুইচ চালু করুন');
            var title = (box.querySelector('#hx-push-title').value || '').trim();
            var body = (box.querySelector('#hx-push-body').value || '').trim();
            if (!title && !body) return say('টাইটেল বা বিস্তারিত লিখুন');
            save({ enabled: true, id: 'p' + Date.now(), title: title || 'HuntX BD', body: body, ts: Date.now() }).then(function () {
                say('সবার কাছে পাঠানো হয়েছে ✓');
                box.querySelector('#hx-push-title').value = '';
                box.querySelector('#hx-push-body').value = '';
            }).catch(function () { say('পাঠানো ব্যর্থ'); });
        });
    }

    function boot() {
        registerSW();
        var tries = 0;
        var t = setInterval(function () {
            listen();
            if (listening || ++tries > 40) clearInterval(t);
        }, 500);
        var q = 0;
        new MutationObserver(function () {
            if (q) return;
            q = setTimeout(function () { q = 0; injectAdminBox(); }, 150);
        }).observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
