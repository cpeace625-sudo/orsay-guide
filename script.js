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
let currentDetailAw = null; // 현재 열린 작품 객체를 추적 (오류 방지용)

// ══════════════════════════════════════════
//  데이터 로드
// ══════════════════════════════════════════
async function loadData() {
  try {
    const res = await fetch('artworks.json');
    if (!res.ok) throw new Error('fetch fail');
    allArtworks = await res.json();
  } catch {
    console.error('artworks.json 불러오기 실패');
  }
  init();
}

// ══════════════════════════════════════════
//  초기화
// ══════════════════════════════════════════
function init() {
  buildFloorTabs();
  updateProgress();
  applyFilters();
}

// ══════════════════════════════════════════
//  층 탭 생성
// ══════════════════════════════════════════
function buildFloorTabs() {
  const floors = [...new Set(allArtworks.map(a => a.floor))]
    .sort((a,b) => Number(b) - Number(a));

  currentFloor = floors.includes('5') ? '5' : floors[0];

  const container = document.getElementById('floorTabs');
  if (container) {
    container.innerHTML = '';
    floors.forEach(f => {
      const btn = document.createElement('button');
      btn.className = 'floor-tab' + (f === currentFloor ? ' active' : '');
      btn.dataset.floor = f;
      btn.textContent = `[${f}층]`;
      btn.addEventListener('click', () => selectFloor(f));
      container.appendChild(btn);
    });
  }
  buildRoomTabs();
}

function selectFloor(floor) {
  currentFloor = floor;
  currentRoom  = 'all';
  document.querySelectorAll('.floor-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.floor === floor));
  buildRoomTabs();
  applyFilters();
}

// ══════════════════════════════════════════
//  방 탭 생성
// ══════════════════════════════════════════
function buildRoomTabs() {
  const rooms = [...new Set(
    allArtworks.filter(a => a.floor === currentFloor).map(a => a.room)
  )].sort((a,b) => {
    const na = parseInt(a), nb = parseInt(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.localeCompare(b);
  });

  const container = document.getElementById('roomTabs');
  if (!container) return;
  container.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'room-tab' + (currentRoom === 'all' ? ' active' : '');
  allBtn.dataset.room = 'all';
  allBtn.textContent = '전체';
  allBtn.addEventListener('click', () => selectRoom('all'));
  container.appendChild(allBtn);

  rooms.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'room-tab' + (r === currentRoom ? ' active' : '');
    btn.dataset.room = r;
    btn.textContent = `${r}실`;
    btn.addEventListener('click', () => selectRoom(r));
    container.appendChild(btn);
  });
}

function selectRoom(room) {
  currentRoom = room;
  document.querySelectorAll('.room-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.room === room));
  applyFilters();
}

// ══════════════════════════════════════════
//  필터 & 검색 (글로벌 검색 적용 완료)
// ══════════════════════════════════════════
function applyFilters() {
  const q = searchQuery.trim().toLowerCase();
  let source = allArtworks;

  // 요구사항 3: 검색바 입력 시 층/방 필터를 완전히 무시하고 전체 작품에서 검색
  if (q) {
    source = source.filter(a =>
      a.title_ko.toLowerCase().includes(q)       ||
      a.title_original.toLowerCase().includes(q) ||
      a.artist_ko.toLowerCase().includes(q)      ||
      a.artist_original.toLowerCase().includes(q)||
      String(a.room).toLowerCase().includes(q)   ||
      String(a.floor).includes(q)
    );
  } else {
    // 검색어가 없을 때만 기존 카테고리 탭 및 층/방 필터 적용
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

// ══════════════════════════════════════════
//  렌더링
// ══════════════════════════════════════════
function renderList() {
  const container = document.getElementById('cardList');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="state-box"><div class="emoji">🔍</div>작품을 찾을 수 없습니다.</div>`;
    return;
  }

  if (searchQuery || currentTab === 'favorites' || currentTab === 'done') {
    const group = document.createElement('div');
    group.className = 'card-group';
    group.innerHTML = filtered.map((a,i) => cardHTML(a, i)).join('');
    container.innerHTML = '';
    container.appendChild(group);
  } else {
    const roomMap = {};
    filtered.forEach((a,i) => {
      if (!roomMap[a.room]) roomMap[a.room] = [];
      roomMap[a.room].push({a, i});
    });

    container.innerHTML = '';
    Object.keys(roomMap)
      .sort((a,b) => { const na=parseInt(a),nb=parseInt(b); return isNaN(na)||isNaN(nb)?a.localeCompare(b):na-nb; })
      .forEach(room => {
        const group = document.createElement('div');
        group.className = 'card-group';
        const label = document.createElement('div');
        label.className = 'card-group-label';
        label.textContent = `${currentFloor}층 · ${room}실`;
        group.appendChild(label);
        roomMap[room].forEach(({a, i}) => {
          group.insertAdjacentHTML('beforeend', cardHTML(a, i));
        });
        container.appendChild(group);
      });
  }

  container.querySelectorAll('.artwork-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.card-fav-btn')) return;
      openDetailById(card.dataset.id); // 고유 ID 기반으로 상세창 열기
    });
  });

  container.querySelectorAll('.card-fav-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      LS.toggleFav(id);
      btn.classList.toggle('active', LS.isFav(id));
      if (currentTab === 'favorites') applyFilters();
    });
  });
}

function cardHTML(aw, idx) {
  const done = LS.isDone(aw.id);
  const fav  = LS.isFav(aw.id);
  return `
  <div class="artwork-card${done ? ' is-done' : ''}" data-id="${aw.id}" data-idx="${idx}">
    <div class="card-thumb">
      <img src="images/${aw.id}.jpg" alt="${aw.title_ko}" onerror="this.src='https://placehold.co/88x88/F2F2F7/8E8E93?text=No'" />
      <div class="done-badge"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
    </div>
    <div class="card-body">
      <div class="card-title-ko">${aw.title_ko}</div>
      <div class="card-title-orig">${aw.title_original}</div>
      <div class="card-artist-ko">${aw.artist_ko}</div>
      <div class="card-artist-orig">${aw.artist_original}</div>
      <div class="card-meta">
        <span class="card-room">${aw.floor}F · ${aw.room}실</span>
        <span class="card-duration">
          <svg viewBox="0 0 24 24" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${aw.audio_duration}
        </span>
        <span class="card-stars">${starsSVG(aw.rating, 10)}</span>
      </div>
    </div>
    <button class="card-fav-btn${fav ? ' active' : ''}" data-id="${aw.id}">
      <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    </button>
    <div class="card-chevron"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div>
  </div>`;
}

function updateSectionHeader() {
  const titles = { home:'작품 목록', favorites:'즐겨찾기', done:'감상 완료' };
  const titleEl = document.getElementById('sectionTitle');
  const countEl = document.getElementById('sectionCount');
  if (titleEl) titleEl.textContent = searchQuery ? '검색 결과' : titles[currentTab] || '작품 목록';
  if (countEl) countEl.textContent = `${filtered.length}점`;
}

function updateProgress() {
  const doneEl = document.getElementById('progressDone');
  const totalEl = document.getElementById('progressTotal');
  if (doneEl) doneEl.textContent = LS.getDone().length;
  if (totalEl) totalEl.textContent = allArtworks.length;
}

// ══════════════════════════════════════════
//  이벤트 연동
// ══════════════════════════════════════════
document.querySelectorAll('.tab-item').forEach(tab => {
  tab.addEventListener('click', () => {
    currentTab = tab.dataset.tab;
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const isHome = currentTab === 'home';
    const floorWrap = document.getElementById('floorWrap');
    const roomWrap = document.getElementById('roomWrap');
    if (floorWrap) floorWrap.style.display = isHome ? '' : 'none';
    if (roomWrap) roomWrap.style.display  = isHome ? '' : 'none';

    applyFilters();
  });
});

const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');

if (searchInput) {
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    if (searchClear) searchClear.classList.toggle('visible', searchQuery.length > 0);
    applyFilters();
  });
}
if (searchClear) {
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.remove('visible');
    applyFilters();
  });
}

// ══════════════════════════════════════════
//  오디오 엔진 & 미니 플레이어
// ══════════════════════════════════════════
const audioEl = document.getElementById('audioEl');
let audioId   = null;

function loadAudio(aw) {
  if (audioId === aw.id) return;
  audioId = aw.id;
  const wasPlaying = !audioEl.paused;
  audioEl.src = `audio/${aw.id}.mp3`;
  audioEl.load();
  if (wasPlaying) audioEl.play().catch(()=>{});
  syncAudioUI();
  updateMiniPlayer(aw);
  setMediaSession(aw);
}

function togglePlay() {
  audioEl.paused ? audioEl.play().catch(()=>{}) : audioEl.pause();
}

function syncAudioUI() {
  const playing = !audioEl.paused;
  const playBtn = document.getElementById('audioPlayBtn');
  const miniBtn = document.getElementById('miniPlayBtn');
  const miniPlayer = document.getElementById('miniPlayer');
  
  if (playBtn) playBtn.classList.toggle('playing', playing);
  
  if (miniBtn) {
    miniBtn.classList.toggle('playing', playing);
    const pIcon = miniBtn.querySelector('.icon-play');
    const sIcon = miniBtn.querySelector('.icon-pause');
    if (pIcon) pIcon.style.display  = playing ? 'none' : 'block';
    if (sIcon) sIcon.style.display = playing ? 'block' : 'none';
  }
  
  if (miniPlayer) miniPlayer.classList.toggle('visible', audioId !== null && (playing || audioEl.currentTime > 0));
}

audioEl.addEventListener('timeupdate', () => {
  const cur = audioEl.currentTime, dur = audioEl.duration || 0;
  const pct = dur ? (cur/dur*100) : 0;
  const curEl = document.getElementById('audioCurrent');
  const pBar = document.getElementById('audioProgressBar');
  const mBar = document.getElementById('miniProgressBar');
  
  if (curEl) curEl.textContent = fmtTime(cur);
  if (pBar) pBar.style.width = pct + '%';
  if (mBar) mBar.style.width  = pct + '%';
});

audioEl.addEventListener('loadedmetadata', () => {
  const totEl = document.getElementById('audioTotal');
  if (totEl) totEl.textContent = fmtTime(audioEl.duration);
});

audioEl.addEventListener('play',  syncAudioUI);
audioEl.addEventListener('pause', syncAudioUI);
audioEl.addEventListener('ended', () => {
  if (audioId && !LS.isDone(audioId)) {
    LS.toggleDone(audioId);
    updateProgress();
    renderList();
    refreshDetailState(audioId);
    // 요구사항 5: 재생 완료 시 미체크 목록 실시간 동적 업데이트
    if (currentDetailAw) renderRoomUncheckedList(currentDetailAw);
  }
  syncAudioUI();
});

const progressWrap = document.getElementById('audioProgressWrap');
if (progressWrap) {
  progressWrap.addEventListener('click', e => {
    if (!audioEl.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audioEl.currentTime = ((e.clientX - rect.left) / rect.width) * audioEl.duration;
  });
}

const miniPlayBtn = document.getElementById('miniPlayBtn');
const audioPlayBtn = document.getElementById('audioPlayBtn');
if (miniPlayBtn) miniPlayBtn.addEventListener('click', togglePlay);
if (audioPlayBtn) audioPlayBtn.addEventListener('click', togglePlay);

function updateMiniPlayer(aw) {
  const mTitle = document.getElementById('miniTitle');
  const mArtist = document.getElementById('miniArtist');
  const mThumb = document.getElementById('miniThumb');
  if (mTitle) mTitle.textContent   = aw.title_ko;
  if (mArtist) mArtist.textContent = aw.artist_ko;
  if (mThumb) mThumb.src = `images/${aw.id}.jpg`;
}

function setMediaSession(aw) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: aw.title_ko, artist: aw.artist_ko, album: "Musée d'Orsay 오디오 가이드" });
  navigator.mediaSession.setActionHandler('play',  () => audioEl.play());
  navigator.mediaSession.setActionHandler('pause', () => audioEl.pause());
}

// ══════════════════════════════════════════
//  상세 페이지 & 미체크 리스트 구현
// ══════════════════════════════════════════
function openDetailById(id) {
  const aw = allArtworks.find(a => a.id === String(id));
  if (!aw) return;

  currentDetailAw = aw;

  document.getElementById('detailPage').classList.add('open');
  // 요구사항 5: 뒷배경 스크롤 잠금 제거하여 자유롭게 스크롤 이동 가능하게 함

  document.getElementById('detailImage').src = `images/${aw.id}.jpg`;
  document.getElementById('detailRoom').textContent = `${aw.floor}층 · ${aw.room}실`;
  document.getElementById('detailTitleKo').textContent = aw.title_ko;
  document.getElementById('detailTitleOrig').textContent = aw.title_original;
  document.getElementById('detailArtistKo').textContent = aw.artist_ko;
  document.getElementById('detailArtistOrig').textContent = aw.artist_original;
  document.getElementById('detailStars').innerHTML = starsSVG(aw.rating, 14);
  document.getElementById('detailDesc').textContent = aw.description;

  refreshDetailState(aw.id);
  loadAudio(aw);

  // 요구사항 5: 해당 방의 미체크 작품 목록 띄우기 호출
  renderRoomUncheckedList(aw);
}

function closeDetail() {
  document.getElementById('detailPage').classList.remove('open');
}

// 요구사항 5: 해당 방의 감상완료 미체크 작품 목록 렌더링 함수
function renderRoomUncheckedList(currentAw) {
  const container = document.getElementById('roomUncheckedList');
  if (!container) return;

  // 전체 데이터 중 같은 층, 같은 방이면서 아직 감상완료(Done)되지 않은 작품만 필터링
  const list = allArtworks.filter(a => 
    a.floor === currentAw.floor && 
    a.room === currentAw.room && 
    !LS.isDone(a.id)
  );

  if (list.length === 0) {
    container.innerHTML = `<div style="padding:20px; text-align:center; color:#8e8e93;">🎉 이 방의 모든 작품을 감상하셨습니다!</div>`;
    return;
  }

  container.innerHTML = `
    <div style="padding: 15px 0 10px; font-weight: bold; border-top: 1px solid #e5e5ea; margin-top: 20px;">
      📍 ${currentAw.room}실의 미감상 작품 (${list.length}점)
    </div>
    <div class="card-group" style="display: flex; flex-direction: column; gap: 10px;">
      ${list.map(a => `
        <div class="unchecked-item-card" data-id="${a.id}" style="display: flex; align-items: center; gap: 12px; padding: 10px; background: #f8f8fa; border-radius: 8px; cursor: pointer;">
          <img src="images/${a.id}.jpg" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" onerror="this.src='https://placehold.co/50x50/F2F2F7/8E8E93?text=No'" />
          <div>
            <div style="font-size: 14px; font-weight: 600; color: #1c1c1e;">${a.title_ko}</div>
            <div style="font-size: 12px; color: #8e8e93;">${a.artist_ko}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // 미감상 카드 클릭 시 해당 작품 상세로 즉시 전환 및 플레이어 페이지 맨 위로 스크롤
  container.querySelectorAll('.unchecked-item-card').forEach(card => {
    card.addEventListener('click', () => {
      openDetailById(card.dataset.id);
      document.getElementById('detailPage').scrollTop = 0;
    });
  });
}

function refreshDetailState(id) {
  const fBtn = document.getElementById('detailFavBtn');
  const dBtn = document.getElementById('detailDoneBtn');
  const dBdg = document.getElementById('detailDoneBadge');
  if (fBtn) fBtn.classList.toggle('fav-active', LS.isFav(id));
  if (dBtn) dBtn.classList.toggle('done-active', LS.isDone(id));
  if (dBdg) dBdg.classList.toggle('visible', LS.isDone(id));
}

const detailBack = document.getElementById('detailBack');
if (detailBack) detailBack.addEventListener('click', closeDetail);

document.getElementById('detailFavBtn').addEventListener('click', () => {
  if (!currentDetailAw) return;
  const id = currentDetailAw.id;
  LS.toggleFav(id);
  refreshDetailState(id);
  renderList();
});

document.getElementById('detailDoneBtn').addEventListener('click', () => {
  if (!currentDetailAw) return;
  const id = currentDetailAw.id;
  LS.toggleDone(id);
  updateProgress();
  refreshDetailState(id);
  renderList();
  // 체크 토글 시 목록 새로고침
  renderRoomUncheckedList(currentDetailAw);
});

// App Start
loadData();
