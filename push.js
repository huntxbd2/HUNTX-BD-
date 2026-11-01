/* HuntX BD — Push notification option (add-on).
   - Users: toggle in Profile page to allow notifications.
   - Admin: "Send Push" box inside Admin → App Control.
   Delivery: admin message is stored in Firestore config/pushMessage; every
   device with the toggle ON shows a system notification when it arrives
   (works while the app/browser is open or running in background).
   Fully-closed-app push needs a server (FCM) — see note in the reply. */
(function () {
    'use strict';
    var LS_ON = 'hx_push_on';
    var LS_SEEN = 'hx_push_seen';
    var swReg = null;

    function supported() { return 'Notification' in window; }
    function isOn() {
        try { return localStorage.getItem(LS_ON) === '1' && supported() && Notification.permission === 'granted'; }
        catch (e) { return false; }
    }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function say(m) { try { if (typeof toast === 'function') toast(m); } catch (e) {} }

    function registerSW() {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('./sw.js').then(function (r) { swReg = r; }).catch(function () {});
    }

    function showNote(title, body, id) {
        var opts = {
            body: body || '',
            icon: 'logo.png', badge: 'logo.png',
            tag: 'hx-' + (id || Date.now()),
            vibrate: [120, 60, 120],
            data: { url: './' }
        };
        try {
            if (swReg && swReg.showNotification) { swReg.showNotification(title, opts); return; }
            if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready.then(function (r) { r.showNotification(title, opts); }).catch(function () { new Notification(title, opts); });
                return;
            }
        } catch (e) {}
        try { new Notification(title, opts); } catch (e2) {}
    }

    // ---- listen for admin messages ----
    var listening = false;
    function listen() {
        if (listening) return;
        if (typeof firebaseReady === 'undefined' || !firebaseReady || typeof db === 'undefined' || !db) return;
        listening = true;
        var first = true;
        db.collection('config').doc('pushMessage').onSnapshot(function (snap) {
            if (!snap.exists) return;
            var m = snap.data().value !== undefined ? snap.data().value : snap.data();
            if (!m || !m.id) return;
            var seen = '';
            try { seen = localStorage.getItem(LS_SEEN) || ''; } catch (e) {}
            if (String(m.id) === seen) return;
            // On first load only show if message is fresh (< 24h)
            if (first) {
                first = false;
                var age = Date.now() - (Number(m.ts) || 0);
                if (age > 24 * 3600 * 1000) { try { localStorage.setItem(LS_SEEN, String(m.id)); } catch (e) {} return; }
            }
            try { localStorage.setItem(LS_SEEN, String(m.id)); } catch (e) {}
            if (isOn()) showNote(m.title || 'HuntX BD', m.body || '', m.id);
        }, function () {});
    }

    // ---- user toggle (Profile page) ----
    function injectUserToggle() {
        var page = document.getElementById('profile-page');
        if (!page || document.getElementById('hx-push-toggle-card')) return;
        var menu = page.querySelector('.profile-menu');
        if (!menu) return;
        var card = document.createElement('div');
        card.id = 'hx-push-toggle-card';
        card.className = 'hx-push-card';
        card.innerHTML =
            '<i class="fas fa-bell hx-ic"></i>' +
            '<div class="hx-push-txt"><strong>পুশ নোটিফিকেশন</strong><span>ম্যাচ ও অফারের আপডেট ফোনে পান</span></div>' +
            '<label class="hx-switch"><input type="checkbox" id="hx-push-chk"><span class="hx-knob"></span></label>';
        menu.parentNode.insertBefore(card, menu);
        var chk = card.querySelector('#hx-push-chk');
        chk.checked = isOn();
        chk.addEventListener('change', function () {
            if (!supported()) { chk.checked = false; say('এই ডিভাইস/ব্রাউজারে নোটিফিকেশন সাপোর্ট নেই'); return; }
            if (chk.checked) {
                Notification.requestPermission().then(function (p) {
                    if (p === 'granted') {
                        try { localStorage.setItem(LS_ON, '1'); } catch (e) {}
                        registerSW(); listen();
                        say('পুশ নোটিফিকেশন চালু হয়েছে');
                        showNote('HuntX BD', 'নোটিফিকেশন সফলভাবে চালু হয়েছে ✓', 'welcome');
                    } else {
                        chk.checked = false;
                        try { localStorage.setItem(LS_ON, '0'); } catch (e) {}
                        say('পারমিশন দেওয়া হয়নি — ফোন সেটিংস থেকে অনুমতি দিন');
                    }
                });
            } else {
                try { localStorage.setItem(LS_ON, '0'); } catch (e) {}
                say('পুশ নোটিফিকেশন বন্ধ');
            }
        });
    }

    // ---- admin send box (App Control module) ----
    function injectAdminBox() {
        var c = document.getElementById('admin-content');
        if (!c || document.getElementById('hx-admin-push')) return;
        if (!c.querySelector('#set-app-theme')) return; // only on App Control
        var box = document.createElement('div');
        box.id = 'hx-admin-push';
        box.className = 'admin-section';
        box.innerHTML =
            '<h3>🔔 Send Push Notification</h3>' +
            '<p style="font-size:12px;color:#8b93a7;margin-bottom:10px;line-height:1.45;">যাদের পুশ চালু আছে তাদের ফোনে নোটিফিকেশন যাবে।</p>' +
            '<div class="form-group"><label>টাইটেল</label><input type="text" id="hx-push-title" placeholder="যেমন: নতুন ম্যাচ শুরু!" maxlength="60"></div>' +
            '<div class="form-group"><label>মেসেজ</label><textarea id="hx-push-body" rows="3" maxlength="200" style="width:100%;padding:10px;border:2px solid #dfe6e9;border-radius:10px;font-family:inherit;" placeholder="নোটিফিকেশনের লেখা..."></textarea></div>' +
            '<button type="button" class="btn-primary" id="hx-push-send">🔔 Send Push</button>';
        c.insertBefore(box, c.firstChild);
        box.querySelector('#hx-push-send').addEventListener('click', function () {
            if (!currentUser || !currentUser.isAdmin) return say('শুধু অ্যাডমিন');
            var title = (box.querySelector('#hx-push-title').value || '').trim();
            var body = (box.querySelector('#hx-push-body').value || '').trim();
            if (!title && !body) return say('টাইটেল বা মেসেজ লিখুন');
            var msg = { id: 'p' + Date.now(), title: title || 'HuntX BD', body: body, ts: Date.now() };
            cloudSetConfig('pushMessage', msg).then(function () {
                say('Push পাঠানো হয়েছে ✓');
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
        new MutationObserver(function () {
            injectUserToggle();
            injectAdminBox();
        }).observe(document.body, { childList: true, subtree: true });
        injectUserToggle();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
