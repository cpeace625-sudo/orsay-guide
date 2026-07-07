// ══════════════════════════════════════════
//  유틸
// ══════════════════════════════════════════
function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  return `${Math.floor(sec/60)}:${Math.floor(sec%60).toString().padStart(2,'0')}`;
}

function starsSVG(rating, size=10) {
  return [1,2,3,4,5].map(i => {
    const fill = rating >= i ? '#FF9500' : (rating >= i-0.5 ? '#FF9500' : '#E5E5EA');
    const opacity = (rating >= i-0.5 && rating < i) ? '0.5' : '1';
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="opacity:${opacity}">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="${fill}" stroke="none"/>
    </svg>`;
  }).join('');
}

// ══════════════════════════════════════════
//  LocalStorage
// ══════════════════════════════════════════
const LS = {
  getFavs : ()  => JSON.parse(localStorage.getItem('orsay_favs') || '[]'),
  getDone : ()  => JSON.parse(localStorage.getItem('orsay_done') || '[]'),
  setFavs : v   => localStorage.setItem('orsay_favs', JSON.stringify(v)),
  setDone : v   => localStorage.setItem('orsay_done', JSON.stringify(v)),
  isFav   : id  => LS.getFavs().includes(String(id)),
  isDone  : id  => LS.getDone().includes(String(id)),
  toggleFav(id) {
    let a = LS.getFavs(); const s = String(id);
    LS.setFavs(a.includes(s) ? a.filter(x=>x!==s) : [...a, s]);
  },
  toggleDone(id) {
    let a = LS.getDone(); const s = String(id);
    LS.setDone(a.includes(s) ? a.filter(x=>x!==s) : [...a, s]);
  }
};

// ══════════════════════════════════════════
//  전역 상태
// ══════════════════════════════════════════
let allArtworks   = [];
let filtered      = [];
let currentFloor  = null;
let currentRoom   = 'all';
let searchQuery   = '';
let currentTab    = 'home';
let detailIndex   = -1;
const playbackSpeeds = [1.0, 1.25, 1.5, 2.0]; // 배속 목록
let currentSpeedIndex = 0; // 현재 배속 인덱스

// ══════════════════════════════════════════
//  데이터 로드
// ══════════════════════════════════════════
async function loadData() {
  try {
    const res = await fetch('./artworks.json');
    if (!res.ok) throw new Error('fetch fail');
    allArtworks = await res.json();
  } catch {
    console.error('artworks.json 불러오기 실패');
    document.getElementById('cardList').innerHTML = `<div class="state-box"><div class="emoji">😥</div>데이터를 불러오지 못했습니다.</div>`;
  }
  init();
}

// ══════════════════════════════════════════
//  초기화
// ══════════════════════════════════════════
function init() {
  buildFloorTabs();
  updateProgress();
  applyFiltersAndRender();
  addEventListeners();
}

// ══════════════════════════════════════════
//  탭 생성
// ══════════════════════════════════════════
function buildFloorTabs() {
  const floors = [...new Set(allArtworks.map(a => a.floor))].sort((a,b) => Number(b) - Number(a));
  currentFloor = floors.includes('5') ? '5' : floors[0];
  const container = document.getElementById('floorTabs');
  container.innerHTML = floors.map(f =>
    `<button class="floor-tab ${f === currentFloor ? 'active' : ''}" data-floor="${f}">[${f}층]</button>`
  ).join('');
  buildRoomTabs();
}

function buildRoomTabs() {
  const rooms = [...new Set(allArtworks.filter(a => a.floor === currentFloor).map(a => a.room))]
    .sort((a,b) => {
      const na = parseInt(a), nb = parseInt(b);
      return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb;
    });
  const container = document.getElementById('roomTabs');
  let html = `<button class="room-tab ${currentRoom === 'all' ? 'active' : ''}" data-room="all">전체</button>`;
  html += rooms.map(r => `<button class="room-tab" data-room="${r}">${r}실</button>`).join('');
  container.innerHTML = html;
}

// ══════════════════════════════════════════
//  필터 & 렌더링
// ══════════════════════════════════════════
function applyFiltersAndRender() {
  const q = searchQuery.trim().toLowerCase();
  let source;

  if (q) {
    source = allArtworks.filter(a =>
      a.title_ko.toLowerCase().includes(q) || a.title_original.toLowerCase().includes(q) ||
      a.artist_ko.toLowerCase().includes(q) || a.artist_original.toLowerCase().includes(q) ||
      String(a.room).toLowerCase().includes(q)
    );
  } else {
    source = allArtworks;
    if (currentTab === 'favorites') {
      source = allArtworks.filter(a => LS.isFav(a.id));
    } else if (currentTab === 'done') {
      source = allArtworks.filter(a => LS.isDone(a.id));
    } else {
      if (currentFloor) source = source.filter(a => a.floor === currentFloor);
      if (currentRoom !== 'all') source = source.filter(a => a.room === currentRoom);
    }
  }
  filtered = source;
  renderList();
  updateSectionHeader();
}

function renderList() {
  const container = document.getElementById('cardList');
  if (filtered.length === 0) {
    container.innerHTML = `<div class="state-box"><div class="emoji">🔍</div>작품을 찾을 수 없습니다.</div>`;
    return;
  }
  const isGrouped = !searchQuery && currentTab === 'home';
  if (isGrouped) {
    const roomMap = {};
    filtered.forEach((a, i) => {
      if (!roomMap[a.room]) roomMap[a.room] = [];
      roomMap[a.room].push({ a, i });
    });
    container.innerHTML = Object.keys(roomMap)
      .sort((a,b) => { const na=parseInt(a), nb=parseInt(b); return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb; })
      .map(room => `
        <div class="card-group">
          <div class="card-group-label">${currentFloor}층 · ${room}실</div>
          ${roomMap[room].map(({a, i}) => cardHTML(a, i)).join('')}
        </div>
      `).join('');
  } else {
    container.innerHTML = `<div class="card-group">${filtered.map((a, i) => cardHTML(a, i)).join('')}</div>`;
  }
}

function cardHTML(aw, idx) {
  const done = LS.isDone(aw.id);
  const fav = LS.isFav(aw.id);
  return `
  <div class="artwork-card ${done ? 'is-done' : ''}" data-id="${aw.id}" data-idx="${idx}">
    <div class="card-thumb">
      <img src="./images/${aw.id}.jpg" alt="${aw.title_ko}" onerror="this.src='https://placehold.co/88x88/F2F2F7/8E8E93?text=No'" />
      <div class="done-badge"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
    </div>
    <div class="card-body">
      <div class="card-title-ko">${aw.title_ko}</div>
      <div class="card-title-orig">${aw.title_original}</div>
      <div class="card-artist-ko">${aw.artist_ko}</div>
      <div class="card-artist-orig">${aw.artist_original}</div>
      <div class="card-meta">
        <span class="card-room">${aw.floor}F · ${aw.room}실</span>
        <!-- 목록에서 오디오 시간 숨김 처리 (주석 처리됨) -->
        <!-- <span class="card-duration"><svg viewBox="0 0 24 24" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${aw.audio_duration}</span> -->
        <span class="card-stars">${starsSVG(aw.rating, 10)}</span>
      </div>
    </div>
    <button class="card-fav-btn ${fav ? 'active' : ''}" data-id="${aw.id}">
      <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    </button>
    <div class="card-chevron"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div>
  </div>`;
}

function updateSectionHeader() {
  const titles = { home: '작품 목록', favorites: '즐겨찾기', done: '감상 완료' };
  document.getElementById('sectionTitle').textContent = searchQuery ? '검색 결과' : titles[currentTab];
  document.getElementById('sectionCount').textContent = `${filtered.length}점`;
}

function updateProgress() {
  document.getElementById('progressDone').textContent = LS.getDone().length;
  document.getElementById('progressTotal').textContent = allArtworks.length;
}

// ══════════════════════════════════════════
//  이벤트 리스너
// ══════════════════════════════════════════
function addEventListeners() {
  const cardList = document.getElementById('cardList');
  cardList.addEventListener('click', e => {
    const card = e.target.closest('.artwork-card');
    if (!card) return;
    if (e.target.closest('.card-fav-btn')) {
      const id = card.dataset.id;
      LS.toggleFav(id);
      card.querySelector('.card-fav-btn').classList.toggle('active', LS.isFav(id));
      if (currentTab === 'favorites') applyFiltersAndRender();
    } else {
      openDetail(Number(card.dataset.idx));
    }
  });

  document.getElementById('floorTabs').addEventListener('click', e => {
    if (e.target.matches('.floor-tab')) {
      currentFloor = e.target.dataset.floor;
      currentRoom = 'all';
      document.querySelector('.floor-tab.active').classList.remove('active');
      e.target.classList.add('active');
      buildRoomTabs();
      applyFiltersAndRender();
    }
  });

  document.getElementById('roomTabs').addEventListener('click', e => {
    if (e.target.matches('.room-tab')) {
      currentRoom = e.target.dataset.room;
      document.querySelector('.room-tab.active').classList.remove('active');
      e.target.classList.add('active');
      applyFiltersAndRender();
    }
  });

  document.querySelector('.tab-bar').addEventListener('click', e => {
    const tab = e.target.closest('.tab-item');
    if (tab) {
      currentTab = tab.dataset.tab;
      document.querySelector('.tab-item.active').classList.remove('active');
      tab.classList.add('active');
      const isHome = currentTab === 'home';
      document.getElementById('floorWrap').style.display = isHome ? '' : 'none';
      document.getElementById('roomWrap').style.display = isHome ? '' : 'none';
      applyFiltersAndRender();
    }
  });

  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    searchClear.classList.toggle('visible', searchQuery.length > 0);
    applyFiltersAndRender();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.remove('visible');
    applyFiltersAndRender();
  });
  
  // 상세 페이지 상단 버튼 이벤트
  document.getElementById('detailBack').addEventListener('click', closeDetail);
  document.getElementById('detailFavBtn').addEventListener('click', () => {
    const id = filtered[detailIndex].id; LS.toggleFav(id); refreshDetailState(id);
    const card = cardList.querySelector(`.artwork-card[data-id='${id}']`);
    if(card) card.querySelector('.card-fav-btn').classList.toggle('active', LS.isFav(id));
  });
  document.getElementById('detailDoneBtn').addEventListener('click', () => {
    const id = filtered[detailIndex].id; LS.toggleDone(id); refreshDetailState(id); updateProgress();
    const card = cardList.querySelector(`.artwork-card[data-id='${id}']`);
    if(card) card.classList.toggle('is-done', LS.isDone(id));
  });

  // 미니플레이어 클릭 이벤트 (상세 페이지로 이동)
  document.getElementById('miniPlayer').addEventListener('click', e => {
    if (e.target.closest('.mini-controls')) return; 
    const currentPlayingIndex = filtered.findIndex(aw => aw.id === audioId);
    if (currentPlayingIndex > -1) {
      openDetail(currentPlayingIndex);
    }
  });

  // 배속 버튼 클릭 이벤트
  document.getElementById('speedControlBtn').addEventListener('click', () => {
    currentSpeedIndex = (currentSpeedIndex + 1) % playbackSpeeds.length;
    const newSpeed = playbackSpeeds[currentSpeedIndex];
    audioEl.playbackRate = newSpeed;
    document.getElementById('speedControlBtn').textContent = `${newSpeed.toFixed(1)}x`;
  });
}

// ══════════════════════════════════════════
//  오디오 엔진 & 미니 플레이어 (재생바 드래그 로직 포함)
// ══════════════════════════════════════════
const audioEl = document.getElementById('audioEl');
let audioId = null;

function loadAudio(aw) {
  // 배속 1.0x 초기화
  currentSpeedIndex = 0;
  audioEl.playbackRate = playbackSpeeds[0];
  document.getElementById('speedControlBtn').textContent = `${playbackSpeeds[0].toFixed(1)}x`;

  if (audioId === aw.id) return;
  
  audioId = aw.id;
  const wasPlaying = !audioEl.paused;
  audioEl.src = `./audio/${aw.id}.mp3`;
  audioEl.load();
  if (wasPlaying) audioEl.play().catch(()=>{});
  
  updateMiniPlayer(aw);
  setMediaSession(aw);
}

function togglePlay() { audioEl.paused ? audioEl.play().catch(()=>{}) : audioEl.pause(); }

function syncAudioUI() {
  const playing = !audioEl.paused;
  document.getElementById('audioPlayBtn').classList.toggle('playing', playing);
  const miniBtn = document.getElementById('miniPlayBtn');
  miniBtn.classList.toggle('playing', playing);
  miniBtn.querySelector('.icon-play').style.display  = playing ? 'none' : 'block';
  miniBtn.querySelector('.icon-pause').style.display = playing ? 'block' : 'none';
  document.getElementById('miniPlayer').classList.toggle('visible', audioId !== null && (playing || audioEl.currentTime > 0));
}

function updateMiniPlayer(aw) {
  document.getElementById('miniTitle').textContent = aw.title_ko;
  document.getElementById('miniArtist').textContent = aw.artist_ko;
  document.getElementById('miniThumb').src = `./images/${aw.id}.jpg`;
}

function setMediaSession(aw) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: aw.title_ko, artist: aw.artist_ko, album: "Musée d'Orsay 오디오 가이드" });
  ['play', 'pause'].forEach(action => {
      try { navigator.mediaSession.setActionHandler(action, () => { togglePlay(); }); }
      catch (e) { console.warn(`Media Session action '${action}' not supported.`); }
  });
}

audioEl.addEventListener('timeupdate', () => {
  const cur = audioEl.currentTime, dur = audioEl.duration || 0;
  const pct = dur ? (cur/dur*100) : 0;
  document.getElementById('audioCurrent').textContent = fmtTime(cur);
  document.getElementById('audioProgressBar').style.width = `${pct}%`;
  document.getElementById('miniProgressBar').style.width = `${pct}%`;
});

audioEl.addEventListener('loadedmetadata', () => { 
  document.getElementById('audioTotal').textContent = fmtTime(audioEl.duration); 
});
audioEl.addEventListener('play', syncAudioUI);
audioEl.addEventListener('pause', syncAudioUI);
audioEl.addEventListener('ended', () => {
  if (audioId && !LS.isDone(audioId)) { LS.toggleDone(audioId); updateProgress(); refreshDetailState(audioId); renderList(); }
  syncAudioUI();
});

document.getElementById('miniPlayBtn').addEventListener('click', togglePlay);
document.getElementById('audioPlayBtn').addEventListener('click', togglePlay);

// --- 재생바 클릭 및 드래그(끌기) 로직 ---
const progressBar = document.getElementById('audioProgressWrap');
let isSeeking = false;

const startSeeking = (e) => {
  if (!audioEl.duration) return;
  isSeeking = true;
  seek(e);
};

const stopSeeking = () => {
  isSeeking = false;
};

const seek = (e) => {
  if (!isSeeking || !audioEl.duration) return;
  const rect = progressBar.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  let newTime = ((clientX - rect.left) / rect.width) * audioEl.duration;
  
  if (newTime < 0) newTime = 0;
  if (newTime > audioEl.duration) newTime = audioEl.duration;
  
  audioEl.currentTime = newTime;
};

// PC 마우스 이벤트
progressBar.addEventListener('mousedown', startSeeking);
window.addEventListener('mousemove', seek);
window.addEventListener('mouseup', stopSeeking);

// 모바일 터치 이벤트
progressBar.addEventListener('touchstart', startSeeking, {passive: true});
window.addEventListener('touchmove', seek, {passive: false});
window.addEventListener('touchend', stopSeeking);

// ══════════════════════════════════════════
//  상세 페이지
// ══════════════════════════════════════════
function openDetail(idx) {
  detailIndex = idx;
  const aw = filtered[idx];
  if (!aw) return;
  document.getElementById('detailPage').classList.add('open');
  document.body.style.overflow = 'hidden';

  document.getElementById('detailImage').src = `./images/${aw.id}.jpg`;
  document.getElementById('detailRoom').textContent = `${aw.floor}층 · ${aw.room}실`;
  document.getElementById('detailTitleKo').textContent = aw.title_ko;
  document.getElementById('detailTitleOrig').textContent = aw.title_original;
  document.getElementById('detailArtistKo').textContent = aw.artist_ko;
  document.getElementById('detailArtistOrig').textContent = aw.artist_original;
  document.getElementById('detailStars').innerHTML = starsSVG(aw.rating, 14);
  document.getElementById('detailDesc').textContent = aw.description;

  refreshDetailState(aw.id);
  loadAudio(aw);
  renderRelatedWorks(aw);
}

function closeDetail() {
  document.getElementById('detailPage').classList.remove('open');
  document.body.style.overflow = '';
}

function refreshDetailState(id) {
  document.getElementById('detailFavBtn').classList.toggle('fav-active', LS.isFav(id));
  document.getElementById('detailDoneBtn').classList.toggle('done-active', LS.isDone(id));
  document.getElementById('detailDoneBadge').classList.toggle('visible', LS.isDone(id));
}

function renderRelatedWorks(currentAw) {
  const container = document.getElementById('relatedWorks');
  const related = allArtworks.filter(a =>
    a.room === currentAw.room && a.id !== currentAw.id && !LS.isDone(a.id)
  );
  if (related.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <div class="related-title">이 방의 다른 작품</div>
    ${related.map(a => `
      <div class="related-card" data-id="${a.id}">
        <div class="related-thumb"><img src="./images/${a.id}.jpg" loading="lazy"></div>
        <div class="related-info">
          <div class="title">${a.title_ko}</div>
          <div class="artist">${a.artist_ko}</div>
        </div>
      </div>
    `).join('')}`;
    
  container.querySelectorAll('.related-card').forEach(card => {
      card.addEventListener('click', () => {
          const newIdx = filtered.findIndex(item => item.id === card.dataset.id);
          if (newIdx > -1) {
              openDetail(newIdx);
          }
      });
  });
}

// App Start
loadData();
