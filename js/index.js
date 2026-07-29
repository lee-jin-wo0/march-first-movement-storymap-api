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
   섹션 1: 4개의 개별 지도 초기화 (정적 지도)
   - 역할: 남산, 덕수궁, 파리, 도쿄 4개의 소형 지도를 각각 띄우고 마커를 꽂습니다.
======================================================= */
function initSection1Maps() {
  // 각 지도별 중심 좌표와 줌 레벨, 국내/해외 구분 설정
  const mapConfigsS1 = [
    { id: 'map-s1-1', center: [37.5562, 126.9850], zoom: 11, title: '남산 통감관저 터', region: 'seoul' },
    { id: 'map-s1-2', center: [37.5658, 126.9751], zoom: 11, title: '덕수궁 함녕전', region: 'seoul' },
    { id: 'map-s1-3', center: [48.8566, 2.3522], zoom: 8, title: '프랑스 파리', region: 'global' },
    { id: 'map-s1-4', center: [35.6989, 139.7544], zoom: 15, title: '도쿄 YMCA', region: 'global' }
  ];

  mapConfigsS1.forEach(config => {
    const mapElement = document.getElementById(config.id);
    if (!mapElement) return;

    // 지도 객체 생성 (서울은 특수좌표계 EPSG:5179 적용)
    const map = L.map(config.id, {
      center: config.center, zoom: config.zoom, zoomControl: false, scrollWheelZoom: false,
      attributionControl: false, crs: config.region === 'seoul' ? getCrsEx() : L.CRS.EPSG3857
    });

    // 지역에 따라 서울맵 타일 또는 글로벌 오픈스트리트맵 타일 적용
    if (config.region === 'seoul') {
      const baseMapLayer = new L.TileLayer.DAWULGIS_EX(MAP_ENDPOINTS.seoulBaseMap_kor, { minZoom: 1, maxZoom: 15 });
      map.addLayer(baseMapLayer);
    } else {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    }

    // 마커 아이콘 설정 및 툴팁 바인딩
    const icon = L.divIcon({ className: 'custom-marker-wrapper', html: '<div class="map-pulse"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
    L.marker(config.center, { icon: icon }).addTo(map)
      .bindTooltip(config.title, { permanent: true, direction: 'top', offset: [0, -15], className: 'custom-tooltip' }).openTooltip();
  });

  // 스크롤 시 섹션 내 텍스트/지도 요소가 스르륵 나타나는 페이드인 애니메이션
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active', 'visible'); });
  }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll('.sc1-reveal').forEach(el => revealObserver.observe(el));
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

    // 1. 좌측 타임라인 HTML 동적 생성
    const timelineList = document.getElementById('sc2-timeline-list');
    timelineList.innerHTML = '';
    timelineData.forEach(item => {
      const imageHTML = item.imgUrl ? `<img src="${item.imgUrl}" alt="${item.title}" class="sc2-item-img">` : "";
      timelineList.insertAdjacentHTML('beforeend', `
        <div class="sc2-timeline-item sc2-scroll-reveal" data-marker="${item.id}">
            <span class="sc2-item-date">${item.date}</span>
            <h3 class="sc2-item-title">${item.title}</h3>
            ${imageHTML} 
            <p class="sc2-item-desc">${item.desc}</p>
        </div>
      `);
    });

    document.querySelectorAll('.sc2-scroll-reveal').forEach(el => sc2RevealObserver.observe(el));

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

    document.querySelectorAll('.sc2-timeline-item').forEach(item => markerObserver.observe(item));
  } catch (error) { console.error('Section 2 에러:', error); }
}

/* =======================================================
   섹션 3: 함성의 궤적 (경로 라인 애니메이션)
   - 역할: 스크롤을 내릴 때마다 지정된 이동경로(LineString)가 뱀이 기어가듯 그려지는 애니메이션 제공
======================================================= */
async function initSection3() {
  const mapContainer = document.getElementById('map-s3');
  if (!mapContainer) return;

  const mapS3 = L.map('map-s3', { zoomControl: false, scrollWheelZoom: false, crs: getCrsEx() }).setView([37.5665, 126.9780], 9);
  new L.TileLayer.DAWULGIS_EX(MAP_ENDPOINTS.seoulBaseMap_kor, { minZoom: 9, maxZoom: 9 }).addTo(mapS3);
  setTimeout(() => { mapS3.invalidateSize(); }, 500);

  let activeGeoJsonLayer = null;
  let activeMarkers = [];

  // 💡 매칭될 API 경로 데이터의 RNUM
  const sc3Groups = [
    { id: 'east-1', targetIds: ["22"] }, { id: 'east-2', targetIds: ["14"] },
    { id: 'west-1', targetIds: ["21"] }, { id: 'west-2', targetIds: ["20"] },
    { id: 'west-3', targetIds: ["19"] }, { id: 'march5-1', targetIds: ["8"] },
    { id: 'march5-2', targetIds: ["4"] }
  ];

  const sc3RevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => entry.isIntersecting ? entry.target.classList.add('active') : entry.target.classList.remove('active'));
  }, { threshold: 0.4, rootMargin: "0px 0px -10% 0px" });

  try {
    const sc3Data = await fetchTimeTravelData();
    const timelineList = document.getElementById('sc3-timeline-list');
    timelineList.innerHTML = '';

    // HTML 리스트 카드 생성
    sc3Groups.forEach(group => {
      const feature = sc3Data.features.find(f => String(f.id) === group.targetIds[0] || String(f.properties.RNUM) === group.targetIds[0]);
      if (feature) {
        const props = feature.properties;
        const title = props.COT_CONTS_NAME || "제목 없음";
        const val1 = props.COT_VALUE_01 || "";
        const val2 = props.COT_VALUE_03 ? String(props.COT_VALUE_03).replace(/\n/g, '<br>') : "";

        timelineList.insertAdjacentHTML('beforeend', `
          <div class="sc3-timeline-item sc3-scroll-reveal" data-feature-id="${group.targetIds[0]}">
              <h3 class="sc3-item-title">${title}</h3>
              ${val1 ? `<div class="sc3-route-box"><p class="sc3-route-val">${val1}</p></div>` : ''}
              ${val2 ? `<div class="sc3-desc-box"><p class="sc3-item-desc">${val2}</p></div>` : ''}
          </div>
        `);
      }
    });

    document.querySelectorAll('.sc3-scroll-reveal').forEach(el => sc3RevealObserver.observe(el));

    // 스크롤 시 경로 그리기 애니메이션 제어
    const mapUpdateObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const featureId = entry.target.getAttribute('data-feature-id');
          const targetFeature = sc3Data.features.find(f => String(f.id) === featureId || String(f.properties.RNUM) === featureId);

          // 이전 경로 및 마커 초기화
          if (activeGeoJsonLayer) mapS3.removeLayer(activeGeoJsonLayer);
          activeMarkers.forEach(m => mapS3.removeLayer(m));
          activeMarkers = [];

          if (targetFeature && targetFeature.geometry.type === 'LineString') {
            mapS3.invalidateSize();

            // 그려질 경로가 화면 중앙에 잘 보이도록 bounds(바운딩 박스) 맞춤
            const tempLayer = L.geoJSON(targetFeature);
            const isMobile = window.innerWidth <= 768;
            mapS3.fitBounds(tempLayer.getBounds(), { paddingTopLeft: isMobile ? [30, 30] : [450, 50], paddingBottomRight: isMobile ? [30, 150] : [50, 50], maxZoom: 13, animate: true, duration: 0.5 });

            const lineCoords = targetFeature.geometry.coordinates;
            if (lineCoords.length > 0) {
              const startCoord = [lineCoords[0][1], lineCoords[0][0]];
              const endCoord = [lineCoords[lineCoords.length - 1][1], lineCoords[lineCoords.length - 1][0]];

              const startIcon = L.divIcon({ className: 'sc3-point-marker start', html: '<div class="sc3-point-label">출발</div><div class="sc3-point-dot"></div>', iconSize: [40, 40], iconAnchor: [20, 40] });
              const endIcon = L.divIcon({ className: 'sc3-point-marker end', html: '<div class="sc3-point-label">도착</div><div class="sc3-point-dot"></div>', iconSize: [40, 40], iconAnchor: [20, 40] });

              activeMarkers.push(L.marker(startCoord, { icon: startIcon }).addTo(mapS3));
              activeMarkers.push(L.marker(endCoord, { icon: endIcon }).addTo(mapS3));
            }

            // CSS stroke-dashoffset 속성을 이용한 SVG 경로 그리기 애니메이션 기법
            setTimeout(() => {
              activeGeoJsonLayer = L.geoJSON(targetFeature, { style: { color: '#000000', weight: 6, opacity: 0.9, lineJoin: 'round', className: 'sc3-draw-path', fill: false } }).addTo(mapS3);
              document.querySelectorAll('.sc3-draw-path').forEach(path => {
                const length = path.getTotalLength();
                path.style.strokeDasharray = length;
                path.style.strokeDashoffset = length;
                path.getBoundingClientRect(); // 리플로우 유발 (애니메이션 강제 적용을 위해)
                path.style.transition = 'stroke-dashoffset 2.5s ease-in-out';
                path.style.strokeDashoffset = '0'; // 애니메이션 시작
              });
            }, 600);
          }
        }
      });
    }, { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" });

    document.querySelectorAll('.sc3-timeline-item').forEach(item => mapUpdateObserver.observe(item));
  } catch (error) { console.error('Section 3 에러:', error); }
}

/* =======================================================
   섹션 4: 역사의 현장 (릴레이 펄스 렌더링)
   - 3: 시위장소 (site), 4: 중요지점 (hub) 매칭 수정 완료!
======================================================= */
async function initSection4() {
  const mapContainer = document.getElementById('map-s4');
  if (!mapContainer) return;

  const mapS4 = L.map('map-s4', { zoomControl: false, scrollWheelZoom: false, crs: getCrsEx() }).setView([37.577613, 126.976897], 7);
  new L.TileLayer.DAWULGIS_EX(MAP_ENDPOINTS.seoulBaseMap_kor, { minZoom: 1, maxZoom: 15 }).addTo(mapS4);

  let mapTriggered = false;

  try {
    const geojsonData = await fetchTimeTravelData();
    const observerS4 = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !mapTriggered) {
          mapTriggered = true;
          mapS4.invalidateSize();
          let delay = 0;

          geojsonData.features.forEach((feature) => {
            const props = feature.properties;
            const subId = String(props.COT_THEME_SUB_ID);
            const name = props.COT_CONTS_NAME || "알 수 없는 장소";

            if (!props.COT_COORD_Y || !props.COT_COORD_X) return;
            const latlng = [parseFloat(props.COT_COORD_Y), parseFloat(props.COT_COORD_X)];

            let pulseClass = '';

            // 💡 [수정됨] 3번(시위장소)과 4번(중요지점)의 클래스를 올바르게 교체했습니다.
            if (subId === '3') pulseClass = 'sc4-pulse-site';      // 시위 장소
            else if (subId === '4') pulseClass = 'sc4-pulse-hub';  // 중요 지점

            if (pulseClass !== '') {
              setTimeout(() => {
                const icon = L.divIcon({ className: 'sc4-marker-wrapper', html: `<div class="${pulseClass}"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
                L.marker(latlng, { icon: icon }).addTo(mapS4).bindTooltip(name, { direction: 'top', offset: [0, -10], className: 'custom-tooltip' });
              }, delay);
              delay += 150;
            }
          });
        }
      });
    }, { threshold: 0.3 });
    observerS4.observe(mapContainer);
  } catch (error) { console.error('Section 4 에러:', error); }

  const sc4RevealObserver = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); }); }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll('.sc4-reveal').forEach(el => sc4RevealObserver.observe(el));
}

/* =======================================================
   섹션 5: 독립의 별들 (하단 캐러셀 & 팝업 양방향 동기화)
   - 초기 화면: 모든 마커가 보이도록 줌 아웃 (fitBounds)
   - 클릭 시: 해당 인물의 마커로 줌 인 (setView)
   - minZoom: 1 로 수정하여 축소 시 지도가 까맣게 변하는 현상 방지
======================================================= */
async function initSection5() {
  const mapContainer = document.getElementById('map-s5');
  if (!mapContainer) return;

  // 1. 지도 기본 생성 (기본 확대/축소 컨트롤 숨김)
  const mapS5 = L.map('map-s5', { zoomControl: false, scrollWheelZoom: false, crs: getCrsEx() }).setView([37.577613, 126.976897], 10);

  // 💡 minZoom을 1로 유지하여 지도가 까매지지 않도록 방지
  new L.TileLayer.DAWULGIS_EX(MAP_ENDPOINTS.seoulBaseMap_kor, { minZoom: 1, maxZoom: 15 }).addTo(mapS5);

  let activeMarkerS5 = null;

  try {
    const geojsonData = await fetchDailyLifeData();
    const trackContainer = document.getElementById('sc5-activist-list');

    // 서브 아이디 5번(인물) 데이터 필터링
    const activists = geojsonData.features.filter(f => String(f.properties.COT_THEME_SUB_ID) === '5');

    // 이름(가나다)순 정렬
    activists.sort((a, b) => {
      const nameA = a.properties.COT_CONTS_NAME || "";
      const nameB = b.properties.COT_CONTS_NAME || "";
      return nameA.localeCompare(nameB, 'ko-KR');
    });

    const cardElements = [];
    const allLatLngs = []; // 모든 마커의 좌표 수집용

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

      // 좌표 수집
      allLatLngs.push([lat, lng]);

      // 하단 슬라이드(캐러셀) 카드 생성
      const card = document.createElement('div');
      card.className = 'sc5-card';
      card.innerHTML = `
        <div class="sc5-card-img"><img src="${imgUrl}" alt="${name} 사진" onerror="this.style.display='none';"></div>
        <div class="sc5-card-info"><h4>${name}</h4><p>${shortAddr.split(' ')[0]} ${shortAddr.split(' ')[1] || ''}</p></div>
      `;
      cardElements.push(card);
      trackContainer.appendChild(card);

      // 지도 마커 생성
      const icon = L.divIcon({ className: 'sc5-marker-wrapper', html: `<div class="sc5-custom-pin"></div>`, iconSize: [16, 44], iconAnchor: [8, 44] });
      const marker = L.marker([lat, lng], { icon: icon }).addTo(mapS5);

      const popupContent = `<div class="sc5-popup-inner"><h3>${name}</h3><span class="sc5-pop-addr">${shortAddr}</span><div class="sc5-pop-desc">${detailDesc}</div></div>`;
      marker.bindPopup(popupContent, { offset: [0, -35], className: 'sc5-leaflet-popup', autoPan: false });

      // 클릭 시 줌인 될 적당한 레벨 (12 설정)
      const zoomLevel = 12;

      // A. 카드를 클릭했을 때
      card.addEventListener('click', () => {
        cardElements.forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        marker.openPopup();
        mapS5.setView([lat, lng], zoomLevel, { animate: true, duration: 1.0 });
      });

      // B. 지도 위 마커를 클릭했을 때
      marker.on('click', () => {
        cardElements.forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        // 클릭한 카드로 하단 슬라이드 자동 스크롤
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        mapS5.setView([lat, lng], zoomLevel, { animate: true, duration: 1.0 });
      });
    });

    // 모든 마커가 화면에 들어오도록 초기 카메라 자동 맞춤
    if (allLatLngs.length > 0) {
      setTimeout(() => {
        mapS5.invalidateSize();
        mapS5.fitBounds(L.latLngBounds(allLatLngs), {
          padding: [50, 50],
          maxZoom: 11
        });
      }, 500);
    }

    // 슬라이드 좌/우 이동 버튼
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