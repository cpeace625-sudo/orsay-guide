// ══════════════════════════════════════════
//  유틸리티 & 시계
// ══════════════════════════════════════════
function updateClock() {
  const now = new Date();
  document.getElementById('statusTime').textContent =
    `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}
updateClock(); setInterval(updateClock, 10000);

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
//  저장소 (LocalStorage)
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

// 전역 상태
let allArtworks   = [];
let filtered      = [];
let currentFloor  = null;
let currentRoom   = 'all';
let searchQuery   = '';
let currentTab    = 'home';
let detailIndex   = -1;

// 데이터 로드
async function loadData() {
  try {
    const res = await fetch('artworks.json');
    if (!res.ok) throw new Error('fail');
    allArtworks = await res.json();
    init();
  } catch (e) {
    document.getElementById('cardList').innerHTML = `<div class="state-box"><div class="emoji">⚠️</div>artworks.json 파일을 읽지 못했습니다.</div>`;
  }
}

function init() {
  buildFloorTabs();
  updateProgress();
  applyFilters();
  setupAudioEvents();
}

// 층 탭 생성
function buildFloorTabs() {
  const floors = [...new Set(allArtworks.map(a => a.floor))].sort((a,b) => Number(b) - Number(a));
  currentFloor = floors.includes('5') ? '5' : floors[0];

  const container = document.getElementById('floorTabs');
  container.innerHTML = '';
  floors.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'floor-tab' + (f === currentFloor ? ' active' : '');
    btn.dataset.floor = f;
    btn.textContent = `${f}층`;
    btn.addEventListener('click', () => selectFloor(f));
    container.appendChild(btn);
  });
  buildRoomTabs();
}

function selectFloor(floor) {
  currentFloor = floor;
  currentRoom  = 'all';
  document.querySelectorAll('.floor-tab').forEach(b => b.classList.toggle('active', b.dataset.floor === floor));
  buildRoomTabs();
  applyFilters();
}

// 방 탭 생성
function buildRoomTabs() {
  const rooms = [...new Set(allArtworks.filter(a => a.floor === currentFloor).map(a => a.room))].sort((a,b) => parseInt(a) - parseInt(b));
  const container = document.getElementById('roomTabs');
  container.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'room-tab' + (currentRoom === 'all' ? ' active' : '');
  allBtn.textContent = '전체';
  allBtn.addEventListener('click', () => selectRoom('all'));
  container.appendChild(allBtn);

  rooms.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'room-tab' + (r === currentRoom ? ' active' : '');
    btn.textContent = `${r}실`;
    btn.addEventListener('click', () => selectRoom(r));
    container.appendChild(btn);
  });
}

function selectRoom(room) {
  currentRoom = room;
  document.querySelectorAll('.room-tab').forEach(b => b.classList.toggle('active', b.textContent === (room === 'all' ? '전체' : `${room}실`)));
  applyFilters();
}

// 필터 적용
function applyFilters() {
  let source = allArtworks;
  if (currentFloor) source = source.filter(a => a.floor === currentFloor);
  if (currentRoom !== 'all') source = source.filter(a => a.room === currentRoom);
  filtered = source;
  renderList();
  updateSectionHeader();
}

function updateSectionHeader() {
  document.getElementById('sectionCount').textContent = `총 ${filtered.length}개`;
}

function updateProgress() {
  document.getElementById('progressTotal').textContent = allArtworks.length;
  document.getElementById('progressDone').textContent = LS.getDone().length;
}

// 리스트 렌더링
function renderList() {
  const container = document.getElementById('cardList');
  if (filtered.length === 0) {
    container.innerHTML = `<div class="state-box">작품이 없습니다.</div>`;
    return;
  }

  container.innerHTML = filtered.map((a, i) => `
    <div class="artwork-card${LS.isDone(a.id) ? ' is-done' : ''}" data-idx="${i}">
      <div class="card-thumb">
        <img src="images/${a.id}.jpg" onerror="this.src='https://placehold.co/88x88/F2F2F7/8E8E93?text=No'" />
      </div>
      <div class="card-body">
        <div class="card-title-ko">${a.title_ko}</div>
        <div class="card-artist-ko">${a.artist_ko}</div>
        <div class="card-meta">
          <span class="card-room">${a.floor}F · ${a.room}실</span>
          <span class="card-duration">⏱ ${a.duration}</span>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.artwork-card').forEach(card => {
    card.addEventListener('click', () => openDetail(Number(card.dataset.idx)));
  });
}

// 상세 페이지 열기
function openDetail(idx) {
  if (idx < 0 || idx >= filtered.length) return;
  detailIndex = idx;
  const aw = filtered[idx];

  document.getElementById('detailImage').src = `images/${aw.id}.jpg`;
  document.getElementById('detailTitleKo').textContent = aw.title_ko;
  document.getElementById('detailTitleOrig').textContent = aw.title_original;
  document.getElementById('detailArtistKo').textContent = aw.artist_ko;
  document.getElementById('detailArtistOrig').textContent = aw.artist_original;
  document.getElementById('detailRoom').textContent = `${aw.floor}F · ${aw.room}실`;
  document.getElementById('detailDesc').textContent = aw.description;

  const audioEl = document.getElementById('audioEl');
  audioEl.src = `audio/${aw.id}.mp3`;
  audioEl.load();

  // 오디오 플레이어 UI 초기화
  document.getElementById('audioPlayBtn').classList.remove('playing');
  document.getElementById('audioCurrent').textContent = "0:00";
  document.getElementById('audioProgressBar').style.width = "0%";

  document.getElementById('detailPage').classList.add('open');
}

// 닫기 버튼
document.getElementById('detailBack').addEventListener('click', () => {
  document.getElementById('detailPage').classList.remove('open');
  document.getElementById('audioEl').pause();
});

// ══════════════════════════════════════════
//  오디오 작동 관련 기능 (추가된 부분)
// ══════════════════════════════════════════
function setupAudioEvents() {
  const audioEl = document.getElementById('audioEl');
  const playBtn = document.getElementById('audioPlayBtn');
  const progressBar = document.getElementById('audioProgressBar');
  const progressWrap = document.getElementById('audioProgressWrap');

  // 재생, 일시정지 토글
  playBtn.addEventListener('click', () => {
    if (audioEl.paused) {
      audioEl.play().catch(() => alert("오디오 파일을 찾을 수 없거나 로드에 실패했습니다. (audio 폴더 확인 필요)"));
      playBtn.classList.add('playing');
    } else {
      audioEl.pause();
      playBtn.classList.remove('playing');
    }
  });

  // 재생 시간 업데이트에 맞춰서 바 움직이기
  audioEl.addEventListener('timeupdate', () => {
    document.getElementById('audioCurrent').textContent = fmtTime(audioEl.currentTime);
    if (audioEl.duration) {
      const pct = (audioEl.currentTime / audioEl.duration) * 100;
      progressBar.style.width = `${pct}%`;
    }
  });

  // 오디오 파일 로딩 완료 시 총 시간 표시
  audioEl.addEventListener('loadedmetadata', () => {
    document.getElementById('audioTotal').textContent = fmtTime(audioEl.duration);
  });

  // 재생 바 클릭해서 원하는 구간으로 이동하기
  progressWrap.addEventListener('click', (e) => {
    const rect = progressWrap.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    if (audioEl.duration) {
      audioEl.currentTime = (clickX / width) * audioEl.duration;
    }
  });
}

// 이전 / 다음 버튼 작동
document.getElementById('btnPrev').addEventListener('click', () => { if (detailIndex > 0) openDetail(detailIndex - 1); });
document.getElementById('btnNext').addEventListener('click', () => { if (detailIndex < filtered.length - 1) openDetail(detailIndex + 1); });
document.getElementById('btnList').addEventListener('click', () => document.getElementById('detailBack').click());

// 실행
loadData();
