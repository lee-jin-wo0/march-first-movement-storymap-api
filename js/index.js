/* =======================================================
   [모듈 가져오기]
   - api/mapService.js에서 API 주소(MAP_ENDPOINTS)와 데이터 호출 함수들을 가져옵니다.
   - 🚨 주의: 이 파일을 HTML에서 불러올 때는 반드시 <script type="module" src="index.js"></script> 형태로 선언해야 합니다.
======================================================= */
import { MAP_ENDPOINTS, fetchTimeTravelData, fetchDailyLifeData } from '../api/mapService.js';

/* =======================================================
   1. 스마트서울맵 OpenAPI V5 동적 로드 (Leaflet 확장팩)
   - 역할: 페이지 진입 시 config.js의 MAP_API_KEY를 이용해 서울시 지도 스크립트와 CSS를 <head>에 주입합니다.
======================================================= */
function loadSeoulMapAPI() {
  return new Promise((resolve, reject) => {
    // API 키 존재 여부 확인
    if (typeof CONFIG === 'undefined' || !CONFIG.MAP_API_KEY) {
      console.warn("API 키가 없습니다. config.js를 확인하세요.");
      resolve();
      return;
    }

    const key = CONFIG.MAP_API_KEY;

    // 1-1. 서울맵 전용 CSS 동적 로드
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://map.seoul.go.kr/openapi/v5/${key}/public/map/css/5.0`;
    document.head.appendChild(link);

    // 1-2. 서울맵 메인 JS (Leaflet + V5 코어) 로드
    const script1 = document.createElement('script');
    script1.src = `https://map.seoul.go.kr/openapi/v5/${key}/public/map/js/5.0`;
    document.head.appendChild(script1);

    // 1-3. 메인 JS 로드 완료 후, 한국 전용 좌표계(EPSG:5179) 확장 JS 순차 로드
    script1.onload = () => {
      const script2 = document.createElement('script');
      script2.src = `https://map.seoul.go.kr/openapi/v5/${key}/public/map/base/js/5179/5.0`;

      script2.onload = () => resolve(); // 스크립트가 모두 불러와지면 Promise 완료 처리
      script2.onerror = () => reject(new Error("좌표계 스크립트 로드 실패"));

      document.head.appendChild(script2);
    };

    script1.onerror = () => reject(new Error("서울맵 V5 메인 스크립트 로드 실패"));
  });
}

/* =======================================================
   2. 전역 스크롤 및 UI 컨트롤
   - 역할: 화면 우측의 네비게이션 도트(점)와 우측 하단의 Top 버튼 동작을 제어합니다.
======================================================= */
function initGlobalUI() {
  const dots = document.querySelectorAll('.global-dot');
  const sections = document.querySelectorAll('.scroll-section');

  // 화면 중앙 영역에 섹션이 들어왔는지 감지하기 위한 옵션
  const observerOptions = { root: null, rootMargin: '-40% 0px -40% 0px', threshold: 0 };

  // 스크롤 시 현재 보고 있는 섹션과 일치하는 네비게이션 도트 활성화
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const currentNum = entry.target.getAttribute('data-section');
        dots.forEach(dot => {
          dot.classList.remove('active');
          if (dot.getAttribute('data-target-section') === currentNum) dot.classList.add('active');
        });
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));

  // 네비게이션 도트 클릭 시 해당 섹션으로 부드럽게 스크롤 이동
  dots.forEach(dot => {
    dot.addEventListener('click', function () {
      const targetNum = this.getAttribute('data-target-section');
      const targetSection = document.querySelector(`.scroll-section[data-section="${targetNum}"]`);
      if (targetSection) targetSection.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // 스크롤이 일정량(300px) 내려가면 Top 버튼 표시
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) backToTopBtn.classList.add('show');
      else backToTopBtn.classList.remove('show');
    });
    // Top 버튼 클릭 시 최상단으로 이동
    backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
}

/* =======================================================
   섹션 1: 4개의 배경 설명 (자동 슬라이드 및 정적 지도)
======================================================= */
function initSection1Maps() {
  const mapConfigsS1 = [
    { id: 'map-s1-1', center: [37.5562, 126.9850], zoom: 11, title: '남산 통감관저 터', region: 'seoul' },
    { id: 'map-s1-2', center: [37.5658, 126.9751], zoom: 11, title: '덕수궁 함녕전', region: 'seoul' },
    { id: 'map-s1-3', center: [48.8566, 2.3522], zoom: 8, title: '프랑스 파리', region: 'global' },
    { id: 'map-s1-4', center: [35.6989, 139.7544], zoom: 15, title: '도쿄 YMCA', region: 'global' }
  ];

  const mapInstances = []; // 지도 객체 저장용 배열

  // 1. 지도 4개 생성
  mapConfigsS1.forEach(config => {
    const mapElement = document.getElementById(config.id);
    if (!mapElement) return;

    const map = L.map(config.id, {
      center: config.center, zoom: config.zoom, zoomControl: false, scrollWheelZoom: false,
      attributionControl: false, crs: config.region === 'seoul' ? getCrsEx() : L.CRS.EPSG3857
    });

    if (config.region === 'seoul') {
      const baseMapLayer = new L.TileLayer.DAWULGIS_EX(MAP_ENDPOINTS.seoulBaseMap_kor, { minZoom: 1, maxZoom: 15 });
      map.addLayer(baseMapLayer);
    } else {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    }

    const icon = L.divIcon({ className: 'custom-marker-wrapper', html: '<div class="map-pulse"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
    L.marker(config.center, { icon: icon }).addTo(map).bindTooltip(config.title, { permanent: true, direction: 'top', offset: [0, -15], className: 'custom-tooltip' }).openTooltip();

    mapInstances.push(map);
  });

  // 2. 슬라이드 및 타이머 제어
  const slides = document.querySelectorAll('.sc1-slide');
  const dots = document.querySelectorAll('.sc1-dot');
  const playPauseBtn = document.getElementById('sc1-play-pause');
  const playPauseIcon = playPauseBtn.querySelector('.material-symbols-outlined');

  let currentIdx = 0;
  let slideInterval;
  let isPlaying = true; // 현재 자동재생 상태

  // 슬라이드 이동 함수
  function goToSlide(index) {
    slides[currentIdx].classList.remove('active');
    dots[currentIdx].classList.remove('active');

    currentIdx = index;

    slides[currentIdx].classList.add('active');
    dots[currentIdx].classList.add('active');

    // 숨겨져 있던 지도가 나타나면 사이즈를 다시 계산 (화면 깨짐 방지)
    setTimeout(() => {
      if (mapInstances[currentIdx]) {
        mapInstances[currentIdx].invalidateSize();
      }
    }, 500);
  }

  // 자동 슬라이드 시작 함수
  function startAutoSlide() {
    slideInterval = setInterval(() => {
      let nextIdx = (currentIdx + 1) % slides.length;
      goToSlide(nextIdx);
    }, 5000);
    isPlaying = true;
    playPauseIcon.textContent = '||'; // 일시정지 아이콘으로 변경
  }

  // 자동 슬라이드 정지 함수
  function stopAutoSlide() {
    clearInterval(slideInterval);
    isPlaying = false;
    playPauseIcon.textContent = '▶'; // 재생 아이콘으로 변경
  }

  // 재생/일시정지 버튼 클릭 이벤트
  playPauseBtn.addEventListener('click', () => {
    if (isPlaying) {
      stopAutoSlide();
    } else {
      startAutoSlide();
    }
  });

  // 하단 점(인디케이터) 클릭 이벤트
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      goToSlide(index);

      // 수동으로 점을 클릭했을 때 재생 중이었다면 타이머 리셋
      if (isPlaying) {
        clearInterval(slideInterval);
        startAutoSlide();
      }
    });
  });

  // 최초 로드 시 자동 슬라이드 시작
  startAutoSlide();
}

/* =======================================================
   도우미 함수: 곡선 경로 생성기 (섹션 2 용)
   - 역할: 마커와 마커를 이을 때 직선이 아닌 부드러운 베지어 곡선 형태의 좌표 배열을 반환합니다.
======================================================= */
function generateCurvedPath(coords) {
  if (coords.length < 2) return coords;
  let curvedCoords = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i], end = coords[i + 1];
    const lat1 = start[0], lng1 = start[1], lat2 = end[0], lng2 = end[1];
    const midLat = (lat1 + lat2) / 2, midLng = (lng1 + lng2) / 2;
    const intensity = 0.2, direction = (i === 0 || i === 1 || i === 4) ? 1 : -1;
    const cpLat = midLat - ((lng2 - lng1) * (intensity * direction));
    const cpLng = midLng + ((lat2 - lat1) * (intensity * direction));

    // 선을 부드럽게 만들기 위해 좌표를 20개로 쪼갬
    for (let step = 0; step <= 20; step++) {
      const t = step / 20;
      const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * cpLat + t * t * lat2;
      const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * cpLng + t * t * lng2;
      if (i > 0 && step === 0) continue; // 이전 선분과의 중복 좌표 제거
      curvedCoords.push([lat, lng]);
    }
  }
  return curvedCoords;
}

/* =======================================================
   섹션 2: 거사의 맹세 (타임라인 스크롤 동기화)
   - 테마 API의 "3.1운동 준비" 카테고리 데이터만 추출하여 시간순으로 렌더링
======================================================= */
async function initSection2() {
  const mapContainer = document.getElementById('map-s2');
  if (!mapContainer) return;

  const mapS2 = L.map('map-s2', { zoomControl: false, scrollWheelZoom: false, crs: getCrsEx() }).setView([37.5759, 126.9850], 10);
  new L.TileLayer.DAWULGIS_EX(MAP_ENDPOINTS.seoulBaseMap_kor, { minZoom: 1, maxZoom: 15 }).addTo(mapS2);

  const resizeObserverS2 = new ResizeObserver(() => mapS2.invalidateSize());
  resizeObserverS2.observe(mapContainer);

  const pathLine = L.polyline([], { color: '#000000', weight: 3, dashArray: '8, 8', opacity: 1, lineJoin: 'round' }).addTo(mapS2);

  const sc2RevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => entry.isIntersecting ? entry.target.classList.add('active') : entry.target.classList.remove('active'));
  }, { threshold: 0.4, rootMargin: "0px 0px -10% 0px" });

  try {
    const geojsonData = await fetchTimeTravelData();

    // 💡 [핵심] "3.1운동 준비" 카테고리에 해당하는 장소들의 실제 API ID (COT_CONTS_ID)
    // 이 배열에 적힌 순서대로 좌측 타임라인 카드와 우측 맵의 경로가 연결됩니다.
    const targetIds = [
      "start_01", // 중앙고보 숙직실 터 (2.8 독립선언서 전달)
      "start_02", // 김성수 숙소 터 (단일화 합의)
      "start_03", // 손병희 집터 (거사 전날 회합)
      "start_04", // 옛 천도교 중앙총부 터 (거사 추진 거점)
      "start_08", // 승동교회 (학생단 간부회)
      "start_05", // 보성사 터 (독립선언서 인쇄)
      "start_09", // 이종일 집터 (독립선언서 배포)
      "start_07", // 태화관 터 (민족대표 33인 독립선언식)
      "start_13"  // 탑골공원 (학생/시민 만세운동 시작)
    ];

    const timelineData = [];
    const locationsS2 = [];

    // 설정한 ID 순서대로 API 데이터에서 값을 뽑아옵니다.
    targetIds.forEach(targetId => {
      const feature = geojsonData.features.find(f => f.properties.COT_CONTS_ID === targetId);

      if (feature) {
        const props = feature.properties;
        let finalImgUrl = props.COT_IMG_MAIN_URL || "";
        if (finalImgUrl && !finalImgUrl.startsWith("http")) {
          finalImgUrl = "https://map.seoul.go.kr" + (finalImgUrl.startsWith("/") ? "" : "/") + finalImgUrl;
        }

        timelineData.push({
          id: targetId,
          date: props.COT_ADDR_FULL_OLD || "위치 정보 없음", // API에 날짜가 없으므로 옛날 주소를 표기
          title: props.COT_CONTS_NAME || "제목 없음",
          desc: props.COT_VALUE_03 || props.COT_VALUE_01 || "설명 정보가 없습니다.", // 상세 설명은 COT_VALUE_03에 들어있습니다.
          imgUrl: finalImgUrl
        });

        if (feature.geometry.type === 'Point' && feature.geometry.coordinates) {
          locationsS2.push({
            id: targetId,
            pos: [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
            label: props.COT_CONTS_NAME
          });
        }
      }
    });

    // 1. 투명 스크롤 스텝 생성, 내비게이션 메뉴 생성 및 카드 내용 업데이트 로직
    const scrollTrack = document.getElementById('sc2-scroll-track');
    const cardContent = document.getElementById('sc2-card-content');
    const sideNav = document.getElementById('sc2-side-nav'); // 🌟 내비게이션 영역

    scrollTrack.innerHTML = '';
    sideNav.innerHTML = '';

    // 데이터 개수만큼 투명한 스크롤 스텝과 내비게이션 버튼(1~9)을 생성합니다.
    timelineData.forEach((item, index) => {
      const stepNum = index + 1;

      // 스크롤 트랙 추가 (id 부여)
      scrollTrack.insertAdjacentHTML('beforeend', `<div class="sc2-scroll-step" data-marker="${item.id}" id="step-${item.id}"></div>`);

      // 사이드 내비게이션 버튼 추가
      sideNav.insertAdjacentHTML('beforeend', `<button class="sc2-nav-btn" data-marker="${item.id}" aria-label="${stepNum}번째 장소">${stepNum}</button>`);
    });

    const navBtns = document.querySelectorAll('.sc2-nav-btn');
    let currentCardId = null;

    // 카드의 내용을 페이드인/아웃 애니메이션과 함께 교체하는 함수
    function updateCardContent(activeId) {
      if (currentCardId === activeId) return;
      currentCardId = activeId;

      const item = timelineData.find(d => d.id === activeId);
      if (!item) return;

      // 🌟 현재 활성화된 ID와 일치하는 사이드 버튼에 'active' 클래스 부여
      navBtns.forEach(btn => {
        if (btn.getAttribute('data-marker') === activeId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // 1. 내용 투명화 (fade-out)
      cardContent.classList.add('fade-out');

      // 2. 0.3초 후 내용 교체 및 다시 표시 (fade-in)
      setTimeout(() => {
        const imageHTML = item.imgUrl ? `<img src="${item.imgUrl}" alt="${item.title}" class="sc2-item-img">` : "";
        cardContent.innerHTML = `
          <span class="sc2-item-date">${item.date}</span>
          <h3 class="sc2-item-title">${item.title}</h3>
          ${imageHTML} 
          <p class="sc2-item-desc">${item.desc}</p>
        `;
        cardContent.classList.remove('fade-out');
      }, 300);
    }

    // 🌟 사이드 내비게이션 버튼 클릭 이벤트 추가
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-marker');
        const targetStep = document.getElementById(`step-${targetId}`);

        // 클릭 시 해당 영역의 스크롤 위치로 부드럽게 이동시킵니다.
        // 스크롤이 이동하면 자연스럽게 기존의 IntersectionObserver가 감지하여 지도와 카드를 업데이트합니다.
        if (targetStep) {
          targetStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });


    // 2. 우측 지도 위에 순서대로 번호 마커 그리기
    const markers = {};
    locationsS2.forEach(loc => {
      const stepNumber = targetIds.indexOf(loc.id) + 1;
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class='sc2-marker-wrapper sc2-marker-dimmed' id='map-marker-container-${loc.id}'><div class='sc2-marker-circle'>${stepNumber}</div></div>`,
        iconSize: [30, 30], iconAnchor: [15, 15]
      });
      const marker = L.marker(loc.pos, { icon }).addTo(mapS2);
      marker.bindTooltip(`<div style="text-align: center; font-weight: bold;">${loc.label}</div>`, { permanent: true, direction: 'top', className: 'sc2-marker-tooltip', offset: [0, -15] });
      markers[loc.id] = { marker, tooltip: marker.getTooltip() };
    });

    const initialCoords = targetIds.map(id => locationsS2.find(l => l.id === id)?.pos).filter(Boolean);
    pathLine.setLatLngs(generateCurvedPath(initialCoords));

    // 3. 스크롤 감지 (마커 하이라이트 및 카메라 이동)
    const markerObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const activeId = String(entry.target.getAttribute('data-marker'));
          const activeIndex = targetIds.indexOf(activeId);

          updateCardContent(activeId);

          Object.keys(markers).forEach(key => {
            const tooltipEl = markers[key]?.tooltip?.getElement();
            if (tooltipEl) {
              if (key === activeId) { tooltipEl.classList.remove('sc2-tooltip-dimmed'); tooltipEl.classList.add('sc2-tooltip-active'); }
              else { tooltipEl.classList.remove('sc2-tooltip-active'); tooltipEl.classList.add('sc2-tooltip-dimmed'); }
            }
          });

          targetIds.forEach((id) => {
            const container = document.getElementById(`map-marker-container-${id}`);
            if (container) {
              if (id === activeId) { container.classList.remove('sc2-marker-dimmed'); container.classList.add('sc2-marker-active'); }
              else { container.classList.remove('sc2-marker-active'); container.classList.add('sc2-marker-dimmed'); }
            }
          });

          const visibleCoords = targetIds.slice(0, activeIndex + 1).map(id => locationsS2.find(l => String(l.id) === id)?.pos).filter(Boolean);
          pathLine.setLatLngs(generateCurvedPath(visibleCoords));

          const activeLoc = locationsS2.find(l => String(l.id) === activeId);
          if (activeLoc) {
            mapS2.invalidateSize();
            const targetPoint = mapS2.project(activeLoc.pos, mapS2.getZoom());
            targetPoint.x -= (window.innerWidth <= 768 ? 0 : 300);
            mapS2.panTo(mapS2.unproject(targetPoint, mapS2.getZoom()), { animate: true, duration: 1.2 });
          }
        }
      });
    }, { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" });

    document.querySelectorAll('.sc2-scroll-step').forEach(item => markerObserver.observe(item));
  } catch (error) { console.error('Section 2 에러:', error); }
}

/* =======================================================
   섹션 3: 함성의 궤적 (경로 라인 애니메이션)
   - 역할: 스크롤을 내릴 때마다 지정된 이동경로(LineString)가 뱀이 기어가듯 그려지는 애니메이션 제공
======================================================= */
async function initSection3() {
  const mapContainer = document.getElementById('map-s3');
  if (!mapContainer) return;

  const mapS3 = L.map('map-s3', { zoomControl: false, scrollWheelZoom: false, crs: getCrsEx() });
  new L.TileLayer.DAWULGIS_EX(MAP_ENDPOINTS.seoulBaseMap_kor, { minZoom: 1, maxZoom: 15 }).addTo(mapS3);

  let activeMarkers = [];
  const routeLayers = {}; // 🌟 생성된 모든 경로(Layer)를 저장할 객체

  const sc3Groups = [
    { id: 'east-1', targetIds: ["22"] }, { id: 'east-2', targetIds: ["14"] },
    { id: 'west-1', targetIds: ["21"] }, { id: 'west-2', targetIds: ["20"] },
    { id: 'west-3', targetIds: ["19"] }, { id: 'march5-1', targetIds: ["8"] },
    { id: 'march5-2', targetIds: ["4"] }
  ];

  try {
    const sc3Data = await fetchTimeTravelData();
    const scrollTrack = document.getElementById('sc3-scroll-track');
    const cardContent = document.getElementById('sc3-card-content');
    const sideNav = document.getElementById('sc3-side-nav');

    scrollTrack.innerHTML = '';
    sideNav.innerHTML = '';

    const targetFeatures = [];
    const allBounds = L.latLngBounds();

    // 1. 필요한 경로를 모두 지도에 렌더링하고, routeLayers 객체에 저장합니다.
    sc3Groups.forEach(group => {
      const feature = sc3Data.features.find(f => String(f.id) === group.targetIds[0] || String(f.properties.RNUM) === group.targetIds[0]);
      if (feature) {
        targetFeatures.push(feature);
        const featureId = String(feature.id || feature.properties.RNUM);

        if (feature.geometry.type === 'LineString') {
          // 초기 상태는 모두 흐릿한 검은색(투명도 0.15)으로 세팅
          const layer = L.geoJSON(feature, {
            style: { color: '#000000', weight: 4, opacity: 0.15 }
          }).addTo(mapS3);

          routeLayers[featureId] = layer;
          allBounds.extend(layer.getBounds());
        }
      }
    });

    // 화면이 렌더링 된 후 전체 경로가 다 보이도록 지도 카메라를 고정시킵니다.
    setTimeout(() => {
      mapS3.invalidateSize();
      const isMobile = window.innerWidth <= 768;
      mapS3.fitBounds(allBounds, {
        paddingTopLeft: isMobile ? [30, 30] : [450, 50],
        paddingBottomRight: isMobile ? [30, 150] : [50, 50],
        maxZoom: 13
      });
    }, 500);

    const timelineData = [];

    // 2. HTML 구조(사이드 버튼 및 스크롤 트랙) 생성
    targetFeatures.forEach((feature, index) => {
      const props = feature.properties;
      const stepNum = index + 1;
      const featureId = String(feature.id || props.RNUM);

      timelineData.push({
        id: featureId,
        title: props.COT_CONTS_NAME || "제목 없음",
        val1: props.COT_VALUE_01 || "",
        val2: props.COT_VALUE_03 ? String(props.COT_VALUE_03).replace(/\n/g, '<br>') : ""
      });

      scrollTrack.insertAdjacentHTML('beforeend', `<div class="sc3-scroll-step" data-feature-id="${featureId}" id="sc3-step-${featureId}"></div>`);
      sideNav.insertAdjacentHTML('beforeend', `<button class="sc3-nav-btn" data-feature-id="${featureId}">${stepNum}</button>`);
    });

    const navBtns = document.querySelectorAll('.sc3-nav-btn');
    let currentFeatureId = null;

    // 3. 뷰포트 내 데이터가 바뀔 때 호출될 메인 업데이트 함수
    function updateSection3(activeId) {
      if (currentFeatureId === activeId) return;
      currentFeatureId = activeId;

      // 사이드 버튼 활성화 처리
      navBtns.forEach(btn => {
        if (btn.getAttribute('data-feature-id') === activeId) btn.classList.add('active');
        else btn.classList.remove('active');
      });

      // 카드 내용 페이드인/아웃 교체
      const item = timelineData.find(d => d.id === activeId);
      if (item) {
        cardContent.classList.add('fade-out');
        setTimeout(() => {
          cardContent.innerHTML = `
            <h3 class="sc3-item-title">${item.title}</h3>
            ${item.val1 ? `<div class="sc3-route-box"><p class="sc3-route-val">${item.val1}</p></div>` : ''}
            ${item.val2 ? `<div class="sc3-desc-box"><p class="sc3-item-desc">${item.val2}</p></div>` : ''}
          `;
          cardContent.classList.remove('fade-out');
        }, 300);
      }

      // 🌟 핵심: 모든 선의 투명도와 색상을 동적으로 조절합니다.
      Object.keys(routeLayers).forEach(id => {
        if (id === activeId) {
          // 활성화된 선: 굵은 빨간색, 불투명도 1, 점선(15px 긋고 15px 띄움) 적용 및 애니메이션 클래스 추가
          routeLayers[id].setStyle({
            color: '#ff0000',
            weight: 7,
            opacity: 1,
            dashArray: '15, 15',
            className: 'sc3-draw-path-active'
          });
          routeLayers[id].bringToFront(); // 맨 위로 끌어올림
        } else {
          // 비활성화된 선: 얇은 검은 실선, 투명도 0.35, 점선 및 클래스 제거
          routeLayers[id].setStyle({
            color: '#000000',
            weight: 4,
            opacity: 0.2,
            dashArray: null,
            className: ''
          });
        }
      });

      // 기존 출발/도착 마커 지우기
      activeMarkers.forEach(m => mapS3.removeLayer(m));
      activeMarkers = [];

      // 출발/도착 마커 새로 그리기
      const targetFeature = targetFeatures.find(f => String(f.id) === activeId || String(f.properties.RNUM) === activeId);
      if (targetFeature && targetFeature.geometry.type === 'LineString') {
        const lineCoords = targetFeature.geometry.coordinates;
        if (lineCoords.length > 0) {
          const startCoord = [lineCoords[0][1], lineCoords[0][0]];
          const endCoord = [lineCoords[lineCoords.length - 1][1], lineCoords[lineCoords.length - 1][0]];

          const startIcon = L.divIcon({ className: 'sc3-point-marker start', html: '<div class="sc3-point-label">출발</div><div class="sc3-point-dot"></div>', iconSize: [40, 40], iconAnchor: [20, 40] });
          const endIcon = L.divIcon({ className: 'sc3-point-marker end', html: '<div class="sc3-point-label">도착</div><div class="sc3-point-dot"></div>', iconSize: [40, 40], iconAnchor: [20, 40] });

          activeMarkers.push(L.marker(startCoord, { icon: startIcon }).addTo(mapS3));
          activeMarkers.push(L.marker(endCoord, { icon: endIcon }).addTo(mapS3));
        }
      }
    }

    // 4. 스크롤 감지
    const mapUpdateObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          updateSection3(entry.target.getAttribute('data-feature-id'));
        }
      });
    }, { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" });

    document.querySelectorAll('.sc3-scroll-step').forEach(item => mapUpdateObserver.observe(item));

    // 5. 사이드 버튼 클릭 시 스크롤 이동
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-feature-id');
        const targetStep = document.getElementById(`sc3-step-${targetId}`);
        if (targetStep) targetStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

  } catch (error) { console.error('Section 3 에러:', error); }
}

/* =======================================================
   섹션 4: 역사의 현장 (릴레이 펄스 렌더링 + 마커 필터링)
======================================================= */
async function initSection4() {
  const mapContainer = document.getElementById('map-s4');
  if (!mapContainer) return;

  const mapS4 = L.map('map-s4', { zoomControl: false, scrollWheelZoom: false, crs: getCrsEx() }).setView([37.577613 - 0.015, 126.976897], 7);
  new L.TileLayer.DAWULGIS_EX(MAP_ENDPOINTS.seoulBaseMap_kor, { minZoom: 1, maxZoom: 15 }).addTo(mapS4);

  let mapTriggered = false;

  const hubLayer = L.layerGroup().addTo(mapS4);
  const siteLayer = L.layerGroup().addTo(mapS4);

  // 🌟 추가: 전체 보기 버튼 동작 로직
  const resetBtn = document.getElementById('sc4-reset-btn');
  const defaultCenter = [37.577613, 126.976897];
  const defaultZoom = 7;

  // 지도의 줌 레벨이 변할 때마다 감지하여 버튼 표시/숨김
  mapS4.on('zoomend', () => {
    if (mapS4.getZoom() > defaultZoom) {
      resetBtn.classList.add('show');
    } else {
      resetBtn.classList.remove('show');
    }
  });

  // 버튼 클릭 시 원래 배율로 돌아가기
  resetBtn.addEventListener('click', () => {
    mapS4.setView(defaultCenter, defaultZoom, { animate: true, duration: 0.8 });
    mapS4.closePopup(); // 열려있는 팝업도 함께 닫아줍니다
  });

  try {
    const geojsonData = await fetchTimeTravelData();
    const observerS4 = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !mapTriggered) {
          mapTriggered = true;
          mapS4.invalidateSize();

          // 🌟 기존의 1개였던 delay를 중요지점용, 시위장소용 2개로 분리합니다.
          let hubDelay = 0;
          let siteDelay = 0;

          geojsonData.features.forEach((feature) => {
            const props = feature.properties;
            const subId = String(props.COT_THEME_SUB_ID);
            const name = props.COT_CONTS_NAME || "알 수 없는 장소";
            const address = props.COT_ADDR_FULL_NEW || props.COT_ADDR_FULL_OLD || "주소 정보 없음";
            const desc = props.COT_VALUE_03 || props.COT_VALUE_01 || "상세 설명이 없습니다.";

            if (!props.COT_COORD_Y || !props.COT_COORD_X) return;
            const latlng = [parseFloat(props.COT_COORD_Y), parseFloat(props.COT_COORD_X)];

            let pulseClass = '';
            let targetLayer = null;
            let currentDelay = 0; // 현재 마커가 사용할 딜레이 시간

            if (subId === '3') {
              pulseClass = 'sc4-pulse-site';
              targetLayer = siteLayer;
              // 시위 장소 딜레이 적용 후 150ms 증가
              currentDelay = siteDelay;
              siteDelay += 150;
            } else if (subId === '4') {
              pulseClass = 'sc4-pulse-hub';
              targetLayer = hubLayer;
              // 중요 지점 딜레이 적용 후 150ms 증가
              currentDelay = hubDelay;
              hubDelay += 150;
            }

            if (pulseClass !== '' && targetLayer) {
              // 🌟 분리된 currentDelay 시간을 적용합니다.
              setTimeout(() => {
                // 🌟 iconSize와 iconAnchor를 40으로 키워 이미지가 잘 보이게 합니다.
                const icon = L.divIcon({
                  className: 'sc4-marker-wrapper',
                  html: `<div class="${pulseClass}"></div>`,
                  iconSize: [40, 40],
                  iconAnchor: [20, 20]
                });

                // 마커 생성
                const marker = L.marker(latlng, { icon: icon });

                // 팝업 추가
                const popupContent = `
                  <div class="sc4-popup-inner">
                    <h3>${name}</h3>
                    <span class="sc4-pop-addr">${address}</span>
                    <div class="sc4-pop-desc">${desc.replace(/\n/g, '<br>')}</div>
                  </div>
                `;
                marker.bindPopup(popupContent, { offset: [0, -15], className: 'sc4-leaflet-popup' });

                // 마커 클릭 시 해당 위치로 줌인
                marker.on('click', () => {
                  mapS4.setView(latlng, 11, { animate: true, duration: 0.8 });
                });

                // 타겟 레이어 그룹에 마커 추가
                marker.addTo(targetLayer);
              }, currentDelay);
            }
          });
        }
      });
    }, { threshold: 0.3 });
    observerS4.observe(mapContainer);

    // 🌟 3. 범례 필터 버튼 클릭 이벤트 연동
    const filterItems = document.querySelectorAll('#sc4-filter-list li');
    filterItems.forEach(item => {
      item.addEventListener('click', () => {
        const filterType = item.getAttribute('data-filter');
        const isActive = item.classList.contains('active');

        if (isActive) {
          // 켜져 있던 버튼을 끄면(active 제거) -> 지도에서 해당 레이어 숨김
          item.classList.remove('active');
          if (filterType === 'hub') mapS4.removeLayer(hubLayer);
          if (filterType === 'site') mapS4.removeLayer(siteLayer);
        } else {
          // 꺼져 있던 버튼을 켜면(active 추가) -> 지도에서 해당 레이어 보임
          item.classList.add('active');
          if (filterType === 'hub') mapS4.addLayer(hubLayer);
          if (filterType === 'site') mapS4.addLayer(siteLayer);
        }
      });
    });

  } catch (error) { console.error('Section 4 에러:', error); }

  const sc4RevealObserver = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); }); }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll('.sc4-reveal').forEach(el => sc4RevealObserver.observe(el));
}

/* =======================================================
   도우미 함수: 한글 문자열에서 첫 글자의 초성 추출
======================================================= */
function getInitialConsonant(word) {
  if (!word) return '';
  const consonants = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const firstChar = word.charCodeAt(0);

  // 한글 음절 영역(가~힣)인지 확인
  if (firstChar >= 44032 && firstChar <= 55203) {
    const index = Math.floor((firstChar - 44032) / 588);
    let cho = consonants[index];
    // 이름 검색의 편의를 위해 쌍자음은 기본 자음으로 매핑 (예: ㄲ -> ㄱ)
    const mapDouble = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' };
    return mapDouble[cho] || cho;
  }
  return '';
}

/* =======================================================
   섹션 5: 독립의 별들 (초성 필터링 + 하단 캐러셀 & 팝업)
======================================================= */
async function initSection5() {
  const mapContainer = document.getElementById('map-s5');
  if (!mapContainer) return;

  const mapS5 = L.map('map-s5', { zoomControl: false, scrollWheelZoom: false, crs: getCrsEx() }).setView([37.577613, 126.976897], 10);
  new L.TileLayer.DAWULGIS_EX(MAP_ENDPOINTS.seoulBaseMap_kor, { minZoom: 1, maxZoom: 15 }).addTo(mapS5);

  try {
    const geojsonData = await fetchDailyLifeData();
    const trackContainer = document.getElementById('sc5-activist-list');

    // DOM 요소 가져오기
    const searchToggle = document.getElementById('sc5-search-toggle');
    const searchPanel = document.getElementById('sc5-search-panel');
    const searchInput = document.getElementById('sc5-search-input');
    const filterBtns = document.querySelectorAll('.sc5-filter-btn');

    const activists = geojsonData.features.filter(f => String(f.properties.COT_THEME_SUB_ID) === '5');

    // 이름순 정렬
    activists.sort((a, b) => {
      const nameA = a.properties.COT_CONTS_NAME || "";
      const nameB = b.properties.COT_CONTS_NAME || "";
      return nameA.localeCompare(nameB, 'ko-KR');
    });

    const activistItems = [];
    const allLatLngs = [];

    activists.forEach((feature) => {
      const props = feature.properties;
      if (!props.COT_COORD_Y || !props.COT_COORD_X) return;

      const lat = parseFloat(props.COT_COORD_Y);
      const lng = parseFloat(props.COT_COORD_X);
      const name = props.COT_CONTS_NAME || "무명 열사";
      const shortAddr = props.COT_ADDR_FULL_NEW || props.COT_ADDR_FULL_OLD || "활동 지역 불명";
      const detailDesc = props.COT_VALUE_03 || props.COT_VALUE_01 || "상세한 기록이 남아있지 않습니다.";
      let imgUrl = props.COT_IMG_MAIN_URL || "";
      if (imgUrl && !imgUrl.startsWith("http")) imgUrl = "https://map.seoul.go.kr" + (imgUrl.startsWith("/") ? "" : "/") + imgUrl;

      const initial = getInitialConsonant(name);
      allLatLngs.push([lat, lng]);

      // 카드 및 마커 생성 로직 (이전과 동일)
      const card = document.createElement('div');
      card.className = 'sc5-card';
      card.innerHTML = `
        <div class="sc5-card-img"><img src="${imgUrl}" alt="${name} 사진" onerror="this.style.display='none';"></div>
        <div class="sc5-card-info"><h4>${name}</h4><p>${shortAddr.split(' ')[0]} ${shortAddr.split(' ')[1] || ''}</p></div>
      `;
      trackContainer.appendChild(card);

      const icon = L.divIcon({
        className: 'sc5-marker-wrapper',
        html: `<div class="sc5-custom-pin"></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      });
      const marker = L.marker([lat, lng], { icon: icon }).addTo(mapS5);

      const popupContent = `<div class="sc5-popup-inner"><h3>${name}</h3><span class="sc5-pop-addr">${shortAddr}</span><div class="sc5-pop-desc">${detailDesc}</div></div>`;
      marker.bindPopup(popupContent, { offset: [0, -35], className: 'sc5-leaflet-popup', autoPan: false });

      const activateItem = () => {
        document.querySelectorAll('.sc5-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        marker.openPopup();
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        mapS5.setView([lat, lng], 12, { animate: true, duration: 1.0 });
      };

      card.addEventListener('click', activateItem);
      marker.on('click', activateItem);

      // 🌟 배열에 데이터 저장 시 name 속성 추가 (텍스트 검색용)
      activistItems.push({ name, initial, card, marker, latlng: [lat, lng] });
    });

    let defaultBounds = null; // 초기 전체 마커 영역을 저장할 변수

    if (allLatLngs.length > 0) {
      defaultBounds = L.latLngBounds(allLatLngs);
      setTimeout(() => {
        mapS5.invalidateSize();
        mapS5.fitBounds(defaultBounds, { padding: [50, 50], maxZoom: 11 });
      }, 500);
    }

    // 🌟 추가: 전체 보기 버튼 로직
    const resetBtn = document.getElementById('sc5-reset-btn');

    // 맵 줌 레벨 감지 (마커 클릭 시 줌 레벨이 12가 되므로, 11보다 클 때 버튼 표시)
    mapS5.on('zoomend', () => {
      if (mapS5.getZoom() > 11) {
        resetBtn.classList.add('show');
      } else {
        resetBtn.classList.remove('show');
      }
    });

    // 전체 보기 버튼 클릭 시 맵 초기화
    resetBtn.addEventListener('click', () => {
      if (defaultBounds) {
        mapS5.fitBounds(defaultBounds, { padding: [50, 50], maxZoom: 11, animate: true });
      }
      mapS5.closePopup(); // 열려있는 팝업 닫기
      document.querySelectorAll('.sc5-card').forEach(c => c.classList.remove('active')); // 활성화된 카드 초기화
    });

    // 🌟 검색 패널 토글 기능
    searchToggle.addEventListener('click', () => {
      searchPanel.classList.toggle('show');
    });

    // 🌟 필터링 공통 실행 함수
    function applyFilters() {
      const searchText = searchInput.value.trim().toLowerCase();
      const activeFilterBtn = document.querySelector('.sc5-filter-btn.active');
      const filterValue = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'all';

      const visibleLatLngs = [];

      activistItems.forEach(item => {
        // 이름 검색 체크 (텍스트가 포함되어 있는지)
        const matchText = searchText === '' || item.name.toLowerCase().includes(searchText);
        // 초성 검색 체크
        const matchConsonant = filterValue === 'all' || item.initial === filterValue;

        if (matchText && matchConsonant) {
          item.card.style.display = 'block';
          if (!mapS5.hasLayer(item.marker)) mapS5.addLayer(item.marker);
          visibleLatLngs.push(item.latlng);
        } else {
          item.card.style.display = 'none';
          if (mapS5.hasLayer(item.marker)) mapS5.removeLayer(item.marker);
        }
      });

      trackContainer.scrollTo({ left: 0, behavior: 'smooth' });
      if (visibleLatLngs.length > 0) {
        mapS5.closePopup();
      }
    }

    // 텍스트 입력창 이벤트 (타이핑할 때마다 초성버튼은 '전체'로 초기화)
    searchInput.addEventListener('input', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      document.querySelector('.sc5-filter-btn[data-filter="all"]').classList.add('active');
      applyFilters();
    });

    // 초성 버튼 이벤트 (버튼 누를 때마다 텍스트 입력창은 지우기)
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        searchInput.value = ''; // 입력창 비우기
        applyFilters();
      });
    });

    document.getElementById('sc5-btn-prev').addEventListener('click', () => trackContainer.scrollBy({ left: -300, behavior: 'smooth' }));
    document.getElementById('sc5-btn-next').addEventListener('click', () => trackContainer.scrollBy({ left: 300, behavior: 'smooth' }));

  } catch (error) { console.error('Section 5 에러:', error); }

  const sc5RevealObserver = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); }); }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll('.sc5-reveal').forEach(el => sc5RevealObserver.observe(el));
}

/* =======================================================
   섹션 6: 남겨진 유산 (스크롤 페이드인 애니메이션)
   - 역할: 화면 진입 시 '.sc6-reveal' 요소들에 'active' 클래스를 붙여 CSS 애니메이션을 발동시킵니다.
======================================================= */
function initSection6() {
  const sc6RevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('active');
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });

  document.querySelectorAll('.sc6-reveal').forEach(el => sc6RevealObserver.observe(el));
}

/* =======================================================
   🚀 최종 메인 앱 실행 (App Initialization)
   - 역할: 모든 스크립트와 DOM이 준비되면, 순차적으로 위에서 정의한 기능들을 부팅시킵니다.
======================================================= */
async function initApp() {
  try {
    console.log("지도 API 부팅 시작...");

    await loadSeoulMapAPI();
    console.log("✅ 스마트서울맵 API 로드 완료! 화면을 그립니다.");

    initGlobalUI();
    initSection1Maps();
    initSection2();
    initSection3();
    initSection4();
    initSection5();
    initSection6();

    console.log("🎉 모든 히스토리맵 섹션 로딩 완료!");

  } catch (error) {
    console.error("❌ 앱 초기화 에러:", error);
  }
}

// 웹 브라우저가 HTML 문서를 완전히 읽고 준비가 끝나면 initApp 함수 실행
document.addEventListener('DOMContentLoaded', initApp);