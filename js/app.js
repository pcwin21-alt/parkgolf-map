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
  renderTrustSummary(courses);
  renderList(courses);
  updateCount(courses.length);
  bindEvents();
  updateBottomBannerSpace();
  map.relayout();
}

// ===== 데이터 로드 =====
async function loadCourses() {
  const res = await fetch('data/courses.json');
  const data = await res.json();
  return sortCourses(data.map(normalizeCourse));
}

function normalizeCourse(course) {
  return {
    ...course,
    status: course.status || (course.phone ? '운영중' : '확인필요'),
    source: course.source || '정보 출처 확인 중',
    updatedAt: course.updatedAt || '',
    closedDays: course.closedDays || '',
    parking: course.parking || '',
    restroom: course.restroom || '',
    beginnerFriendly: course.beginnerFriendly || ''
  };
}

function sortCourses(list) {
  return [...list].sort((a, b) => {
    const statusGap = getStatusPriority(a) - getStatusPriority(b);
    if (statusGap !== 0) return statusGap;

    const phoneGap = getPhonePriority(a) - getPhonePriority(b);
    if (phoneGap !== 0) return phoneGap;

    const districtGap = a.district.localeCompare(b.district, 'ko');
    if (districtGap !== 0) return districtGap;

    return a.name.localeCompare(b.name, 'ko');
  });
}

function getStatusPriority(course) {
  return course.status === '운영중' ? 0 : 1;
}

function getPhonePriority(course) {
  return course.phone ? 0 : 1;
}

function formatUpdatedAt(dateText) {
  if (!dateText) return '확인 중';
  return dateText.replaceAll('-', '.');
}

function getUpdatedLabel(course) {
  return course.updatedAt
    ? `${formatUpdatedAt(course.updatedAt)} 기준`
    : '업데이트 확인 중';
}

function getSourceLabel(course) {
  return course.source || '정보 출처 확인 중';
}

function getStatusClass(course) {
  return course.status === '운영중' ? 'status-running' : 'status-checking';
}

function getStatusLabel(course) {
  return course.status || '확인필요';
}

function getPhoneButtonMarkup(course) {
  if (!course.phone) {
    return '<div class="card-phone-button disabled">전화번호 확인 필요</div>';
  }

  return `<a class="card-phone-button" href="tel:${course.phone}">전화 ${course.phone}</a>`;
}

function renderTrustSummary(list) {
  const latest = list
    .map(course => course.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  const sources = [...new Set(list.map(course => course.source).filter(Boolean))];
  const sourceSummary = sources.length > 2
    ? `${sources[0]} 외 ${sources.length - 1}건`
    : sources.join(', ');

  document.getElementById('lastUpdatedText').textContent = latest
    ? formatUpdatedAt(latest)
    : '확인 중';
  document.getElementById('sourceSummaryText').textContent = sourceSummary || '확인 중';
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
    content.style.cssText = `display:flex;flex-direction:column;align-items:center;cursor:pointer;`;
    content.innerHTML = `
      <div style="
        width:30px;height:30px;
        background:${color};
        border-radius:50%;
        border:2.5px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
        font-size:14px;
      ">⛳</div>
      <div style="
        width:0;height:0;
        border-left:5px solid transparent;
        border-right:5px solid transparent;
        border-top:8px solid ${color};
        margin-top:-1px;
        filter:drop-shadow(0 1px 1px rgba(0,0,0,0.2));
      "></div>
    `;

    const overlay = new kakao.maps.CustomOverlay({
      position,
      content,
      yAnchor: 1,
      xAnchor: 0.5,
      map
    });

    content.addEventListener('click', () => {
      openInfoWindow(overlay, course);
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
    ? `<div class="iw-row iw-phone"><span class="iw-label">전화</span><a href="tel:${course.phone}">${course.phone}</a></div>`
    : '<div class="iw-row"><span class="iw-label">전화</span><span class="iw-empty">전화번호 확인 필요</span></div>';

  return `
    <div class="info-window">
      <div class="iw-top">
        <span class="status-badge ${getStatusClass(course)}">${getStatusLabel(course)}</span>
        <span class="iw-date">${getUpdatedLabel(course)}</span>
      </div>
      <div class="iw-name">⛳ ${course.name}</div>
      <div class="iw-row"><span class="iw-label">지역</span><span>${course.region} ${course.district}</span></div>
      <div class="iw-row"><span class="iw-label">주소</span><span>${course.address}</span></div>
      ${phone}
      <div class="iw-source">출처: ${getSourceLabel(course)}</div>
    </div>
  `;
}

function openInfoWindow(anchor, course) {
  infoWindow.close();
  infoWindow = new kakao.maps.InfoWindow({
    position: anchor.getPosition(),
    content: buildInfoContent(course),
    removable: true
  });
  infoWindow.open(map);

  if (window.innerWidth <= 768) {
    openSheet(course);
  }
}

function getHolesLabel(course) {
  return typeof course.holes === 'number' && course.holes > 0
    ? `${course.holes}H`
    : '미상';
}

function getHolesText(course) {
  return typeof course.holes === 'number' && course.holes > 0
    ? `${course.holes}홀`
    : '홀수 미상';
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
      <div class="card-top">
        <span class="status-badge ${getStatusClass(c)}">${getStatusLabel(c)}</span>
        <span class="card-updated">${getUpdatedLabel(c)}</span>
      </div>
      <div class="card-name">${c.name}</div>
      <div class="card-meta">
        <span class="card-chip">${c.district}</span>
        <span class="card-chip">${getHolesText(c)}</span>
      </div>
      <div class="card-address">${c.address}</div>
      <div class="card-source">출처: ${getSourceLabel(c)}</div>
      <div class="card-actions">${getPhoneButtonMarkup(c)}</div>
    </div>
  `).join('');

  container.querySelectorAll('.card-phone-button').forEach(button => {
    button.addEventListener('click', e => e.stopPropagation());
  });

  container.querySelectorAll('.course-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const course = courses.find(c => c.id === id);
      if (!course) return;

      const position = new kakao.maps.LatLng(course.lat, course.lng);
      map.setCenter(position);
      map.setLevel(4);
      const overlay = overlays.find(o => o._courseId === id);
      if (overlay) openInfoWindow(overlay, course);
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

  const filtered = sortCourses(courses.filter(c => {
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
  }));

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

function buildDetailRows(course) {
  const rows = [
    ['지역', `${course.region} ${course.district}`],
    ['주소', course.address],
    ['홀수', getHolesText(course)],
    ['운영시간', course.hours],
    ['휴장일', course.closedDays],
    ['이용요금', course.fee],
    ['주차', course.parking],
    ['화장실', course.restroom],
    ['초보추천', course.beginnerFriendly]
  ];

  return rows
    .filter(([, value]) => value)
    .map(([label, value]) => `
      <div class="sheet-detail-row">
        <span class="sheet-detail-label">${label}</span>
        <span class="sheet-detail-value">${value}</span>
      </div>
    `)
    .join('');
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

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateBottomBannerSpace();
      map.relayout();
    }, 120);
  });
}

// ===== 모바일 bottom sheet =====
function openSheet(course) {
  document.getElementById('sheetContent').innerHTML = `
    <div class="sheet-status-row">
      <span class="status-badge ${getStatusClass(course)}">${getStatusLabel(course)}</span>
      <span class="sheet-updated">${getUpdatedLabel(course)}</span>
    </div>
    <div class="sheet-name">⛳ ${course.name}</div>
    <div class="sheet-source">출처: ${getSourceLabel(course)}</div>
    <div class="sheet-call-wrap">
      ${course.phone
        ? `<a class="sheet-phone-button" href="tel:${course.phone}">전화 ${course.phone}</a>`
        : '<div class="sheet-phone-button disabled">전화번호 확인 필요</div>'}
    </div>
    <div class="sheet-detail-list">
      ${buildDetailRows(course)}
    </div>
  `;
  document.getElementById('detailSheet').classList.add('open');
  document.getElementById('sheetOverlay').classList.add('visible');
}

function closeSheet() {
  document.getElementById('detailSheet').classList.remove('open');
  document.getElementById('sheetOverlay').classList.remove('visible');
}

function updateBottomBannerSpace() {
  const banner = document.getElementById('bottomBanner');
  if (!banner) return;

  const height = Math.ceil(banner.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--bottom-banner-space', `${height + 12}px`);
}

// ===== 시작 =====
window.addEventListener('load', init);
