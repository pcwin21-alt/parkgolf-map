/* 광주·전남 파크골프장 지도 - app.js (카카오맵) */

let map;
let overlays = [];
let infoWindow;
let courses = [];
let activeCardId = null;
let currentFilter = 'all';

// ===== 초기화 =====
async function init() {
  courses = await loadCourses();

  const container = document.getElementById('map');
  map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(35.0, 126.9),
    level: 10
  });

  infoWindow = new kakao.maps.InfoWindow({ removable: true });

  createMarkers();
  renderList(courses);
  updateCount(courses.length);
  bindEvents();
}

// ===== 데이터 로드 =====
async function loadCourses() {
  const res = await fetch('data/courses.json');
  return res.json();
}

// ===== 마커 생성 =====
function createMarkers() {
  overlays.forEach(o => o.setMap(null));
  overlays = [];

  courses.forEach(course => {
    const isGwangju = course.region === '광주광역시';
    const color = isGwangju ? '#2d7a3a' : '#1565c0';
    const position = new kakao.maps.LatLng(course.lat, course.lng);

    const content = document.createElement('div');
    content.style.cssText = `
      background:${color};color:#fff;font-size:11px;font-weight:700;
      padding:4px 8px;border-radius:12px;white-space:nowrap;
      box-shadow:0 2px 6px rgba(0,0,0,0.25);cursor:pointer;
      border:2px solid rgba(255,255,255,0.7);
      font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;
    `;
    content.textContent = `${course.holes}H`;

    const overlay = new kakao.maps.CustomOverlay({
      position,
      content,
      yAnchor: 0.5,
      xAnchor: 0.5,
      map
    });

    content.addEventListener('click', () => {
      openInfoWindow(position, course);
      scrollToCard(course.id);
      setActiveCard(course.id);
    });

    overlay._courseId = course.id;
    overlays.push(overlay);
  });
}

// ===== 인포윈도우 =====
function buildInfoContent(course) {
  const phone = course.phone
    ? `<a href="tel:${course.phone}">${course.phone}</a>`
    : `<span class="iw-empty">미등록</span>`;
  const hours = course.hours || `<span class="iw-empty">미등록</span>`;
  const fee   = course.fee   || `<span class="iw-empty">미등록</span>`;

  return `
    <div class="info-window">
      <div class="iw-name">⛳ ${course.name}</div>
      <div class="iw-row"><span class="iw-label">주소</span><span>${course.address}</span></div>
      <div class="iw-row"><span class="iw-label">홀수</span><span>${course.holes}홀</span></div>
      <div class="iw-row iw-phone"><span class="iw-label">전화</span><span>${phone}</span></div>
      <div class="iw-row"><span class="iw-label">운영</span><span>${hours}</span></div>
      <div class="iw-row"><span class="iw-label">요금</span><span>${fee}</span></div>
    </div>
  `;
}

function openInfoWindow(position, course) {
  infoWindow.setContent(buildInfoContent(course));
  infoWindow.open(map, position);

  if (window.innerWidth <= 768) {
    openSheet(course);
  }
}

// ===== 코스 목록 렌더링 =====
function renderList(list) {
  const container = document.getElementById('courseList');

  if (list.length === 0) {
    container.innerHTML = '<div class="no-result">검색 결과가 없습니다.</div>';
    return;
  }

  container.innerHTML = list.map(c => `
    <div class="course-card${c.id === activeCardId ? ' active' : ''}" data-id="${c.id}">
      <div class="card-header">
        <div class="card-name">${c.name}</div>
        <div class="card-holes">${c.holes}H</div>
      </div>
      <div class="card-address">${c.address}</div>
      ${c.phone ? `<div class="card-phone">📞 <a href="tel:${c.phone}">${c.phone}</a></div>` : ''}
    </div>
  `).join('');

  container.querySelectorAll('.course-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const course = courses.find(c => c.id === id);
      if (!course) return;

      const position = new kakao.maps.LatLng(course.lat, course.lng);
      map.setCenter(position);
      map.setLevel(4);
      openInfoWindow(position, course);
      setActiveCard(id);
    });
  });
}

function updateCount(n) {
  document.getElementById('headerCount').textContent = `총 ${n}개`;
}

function setActiveCard(id) {
  activeCardId = id;
  document.querySelectorAll('.course-card').forEach(c => {
    c.classList.toggle('active', c.dataset.id === id);
  });
}

function scrollToCard(id) {
  const card = document.querySelector(`.course-card[data-id="${id}"]`);
  if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ===== 필터 로직 =====
function applyFilter(filterValue, searchText = '') {
  currentFilter = filterValue;
  const query = searchText.trim().toLowerCase();
  const gwangjuDistricts = ['동구','서구','남구','북구','광산구'];

  const filtered = courses.filter(c => {
    if (query && !c.name.toLowerCase().includes(query) && !c.address.toLowerCase().includes(query)) {
      return false;
    }
    switch (filterValue) {
      case 'all': return true;
      case '광주전체': return c.region === '광주광역시';
      case '전남전체': return c.region === '전라남도';
      default:
        if (gwangjuDistricts.includes(filterValue)) return c.district === filterValue;
        return c.district === filterValue;
    }
  });

  overlays.forEach(o => {
    const visible = filtered.some(c => c.id === o._courseId);
    o.setMap(visible ? map : null);
  });

  renderList(filtered);
  updateCount(filtered.length);

  if (filtered.length > 0) fitMapToCourses(filtered);
}

function fitMapToCourses(list) {
  if (list.length === 1) {
    map.setCenter(new kakao.maps.LatLng(list[0].lat, list[0].lng));
    map.setLevel(4);
    return;
  }
  const bounds = new kakao.maps.LatLngBounds();
  list.forEach(c => bounds.extend(new kakao.maps.LatLng(c.lat, c.lng)));
  map.setBounds(bounds);
}

// ===== 이벤트 바인딩 =====
function bindEvents() {
  document.getElementById('filterTabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const filter = tab.dataset.filter;
    const select = document.getElementById('jeonnamSelect');
    const isJeonnam = filter === '전남전체';
    select.classList.toggle('visible', isJeonnam);
    if (!isJeonnam) select.value = '';

    applyFilter(filter, document.getElementById('searchInput').value);
  });

  document.getElementById('jeonnamSelect').addEventListener('change', e => {
    const val = e.target.value;
    applyFilter(val || '전남전체', document.getElementById('searchInput').value);
  });

  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      applyFilter(currentFilter, e.target.value);
    }, 200);
  });

  document.getElementById('btnLocation').addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('이 브라우저에서는 위치 기능을 지원하지 않습니다.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        map.setCenter(new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude));
        map.setLevel(4);
      },
      () => alert('위치 정보를 가져올 수 없습니다. 브라우저 권한을 확인하세요.')
    );
  });

  kakao.maps.event.addListener(map, 'click', () => {
    infoWindow.close();
    closeSheet();
  });

  document.getElementById('sheetOverlay').addEventListener('click', closeSheet);
}

// ===== 모바일 bottom sheet =====
function openSheet(course) {
  const phone = course.phone
    ? `<a href="tel:${course.phone}" style="color:#2d7a3a;font-weight:700;">${course.phone}</a>`
    : '미등록';

  document.getElementById('sheetContent').innerHTML = `
    <div style="margin-bottom:12px;">
      <div style="font-size:17px;font-weight:700;color:#2d7a3a;margin-bottom:8px;">⛳ ${course.name}</div>
      <div style="font-size:13px;color:#666;line-height:2;">
        <div>📍 ${course.address}</div>
        <div>🏌️ ${course.holes}홀</div>
        <div>📞 ${phone}</div>
        ${course.hours ? `<div>🕐 ${course.hours}</div>` : ''}
        ${course.fee   ? `<div>💴 ${course.fee}</div>` : ''}
      </div>
    </div>
  `;
  document.getElementById('detailSheet').classList.add('open');
  document.getElementById('sheetOverlay').classList.add('visible');
}

function closeSheet() {
  document.getElementById('detailSheet').classList.remove('open');
  document.getElementById('sheetOverlay').classList.remove('visible');
}

// ===== 시작 =====
window.addEventListener('load', init);
