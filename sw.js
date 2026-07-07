const CACHE_NAME = 'orsay-guide-v1';

// 앱 구동에 필요한 기본 뼈대 파일들 (미리 저장)
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './artworks.json',
  './manifest.json'
];

// 1. 서비스 워커 설치 (기본 파일 캐싱)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. 오프라인에서 파일 꺼내주기 + 새 파일 자동 저장 (동적 캐싱)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // 1) 캐시(창고)에 파일이 있으면 인터넷 안 쓰고 바로 꺼내줌
      if (response) {
        return response;
      }

      // 2) 캐시에 없으면 인터넷(네트워크)에서 가져옴
      const fetchRequest = event.request.clone();
      return fetch(fetchRequest).then((response) => {
        // 유효하지 않은 응답은 그대로 패스
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // 정상적으로 가져온 사진/오디오 등은 다음 오프라인을 위해 캐시에 몰래 복사해둠
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});
