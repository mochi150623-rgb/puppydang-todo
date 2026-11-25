/* 퍼피댕 아이들 관리 — 전용 서비스 워커
   - puppies.html 범위(scope)만 담당해요. 퍼피댕 할일(sw.js)과 겹치지 않습니다.
   - 캐시를 쓰지 않는 패스스루(network-first). Supabase 실시간·로그인 요청은 건드리지 않아요.
   - 인터넷이 끊겼을 때만 아주 가벼운 안내 화면을 보여 줍니다.
   - 잠금화면 알림(Web Push): 다른 직원이 활동을 기록하면 서버(send-push)가 이 워커로 알림을 보내요. */
self.addEventListener('install', function(){ self.skipWaiting(); });

self.addEventListener('activate', function(e){
  e.waitUntil(self.clients.claim());
});

var OFFLINE_HTML = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>퍼피댕 노트 — 오프라인</title>' +
  '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FAF6F0;color:#5C4033;' +
  'font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;text-align:center;padding:24px}' +
  'h1{font-size:19px;margin:0 0 8px}p{font-size:14px;color:#7E6957;margin:0;line-height:1.6}</style></head>' +
  '<body><div><div style="font-size:42px">🐾</div><h1>인터넷 연결을 확인해 주세요</h1>' +
  '<p>연결되면 자동으로 최신 노트를 불러옵니다.<br>이 화면에서 아래로 당겨 새로고침해도 돼요.</p></div></body></html>';

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;                 // 저장·수정 요청은 그대로 통과
  var url;
  try { url = new URL(req.url); } catch(err){ return; }
  if (url.origin !== self.location.origin) return;  // Supabase 등 외부 통신은 손대지 않아요

  e.respondWith(
    fetch(req).catch(function(){
      if (req.mode === 'navigate') {
        return new Response(OFFLINE_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }
      return new Response('', { status: 503, statusText: 'offline' });
    })
  );
});

/* ================= 🔔 잠금화면 알림 (Web Push) ================= */
var PUSH_ICON = '/puppydang-todo/puppies-icon-192.png';
var PUSH_BADGE = '/puppydang-todo/puppies-icon-192.png';
var PUSH_URL = '/puppydang-todo/puppies.html';

/* 서버(send-push)가 { title, body, url } JSON 을 보내면 잠금화면에 알림을 띄워요.
   같은 tag 로 묶어서 새 활동이 오면 이전 알림을 최신 내용으로 바꿉니다. */
self.addEventListener('push', function(event){
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(err){
    try { data = { body: event.data ? event.data.text() : '' }; } catch(err2){ data = {}; }
  }
  if (typeof data !== 'object' || data === null) data = {};
  var title = data.title || '퍼피댕 노트';
  var body = data.body || '새 활동이 기록됐어요';
  var url = data.url || PUSH_URL;

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: PUSH_ICON,
      badge: PUSH_BADGE,
      data: { url: url },
      tag: 'puppydang-activity',
      renotify: true
    })
  );
});

/* 알림을 누르면 이미 열려 있는 puppies.html 탭으로 이동하고, 없으면 새로 엽니다. */
self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || PUSH_URL;
  var targetPath = String(target);
  try { targetPath = new URL(target, self.location.origin).pathname; } catch(err){}
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
      for (var i = 0; i < list.length; i++){
        var win = list[i];
        var winPath = String(win.url || '');
        try { winPath = new URL(winPath, self.location.origin).pathname; } catch(err){}
        if (winPath.indexOf('puppies.html') >= 0){
          if (winPath === targetPath) return Promise.resolve(win.focus()).catch(function(){});
          var shown = Promise.resolve(win.focus()).catch(function(){});
          if (win.navigate) return shown.then(function(){ return win.navigate(target); }).catch(function(){});
          return shown;
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
