/* =======================================================
   1. 스마트서울맵 OpenAPI V5 동적 로드 (Leaflet 확장팩)
   - 웹페이지 로드 시 API 스크립트를 순차적으로 불러오는 역할
======================================================= */
function loadSeoulMapAPI() {
  return new Promise((resolve, reject) => {
    // API 키가 없으면 경고창 띄우고 종료
    if (typeof CONFIG === 'undefined' || !CONFIG.MAP_API_KEY) {
      console.warn("API 키가 없습니다. config.js를 확인하세요.");
      resolve();
      return;
    }

    const key = CONFIG.MAP_API_KEY;

    // 1-1. 서울맵 전용 CSS 로드 (동적으로 <head>에 추가)
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://map.seoul.go.kr/openapi/v5/${key}/public/map/css/5.0`;
    document.head.appendChild(link);

    // 1-2. 서울맵 메인 JS (Leaflet + V5 코어) 로드
    const script1 = document.createElement('script');
    script1.src = `https://map.seoul.go.kr/openapi/v5/${key}/public/map/js/5.0`;
    document.head.appendChild(script1);

    // [중요] 메인 JS가 완전히 로드된 후에 좌표계 확장 JS를 로드해야 에러가 안 납니다.
    script1.onload = () => {
      // 1-3. 한국 전용 좌표계(EPSG:5179) 확장 JS 로드
      const script2 = document.createElement('script');
      script2.src = `https://map.seoul.go.kr/openapi/v5/${key}/public/map/base/js/5179/5.0`;

      // 모든 스크립트가 성공적으로 로드되면 Promise 완료(resolve) 처리
      script2.onload = () => resolve();
      script2.onerror = () => reject(new Error("좌표계 스크립트 로드 실패"));

      document.head.appendChild(script2);
    };

    script1.onerror = () => reject(new Error("서울맵 V5 메인 스크립트 로드 실패"));
  });
}


/* =======================================================
   2. 전역 스크롤 및 UI 컨트롤 (기존 index.js)
   - 우측 네비게이션 도트(점)와 Top 버튼의 동작 제어
======================================================= */
function initGlobalUI() {
  const dots = document.querySelectorAll('.global-dot');
  const sections = document.querySelectorAll('.scroll-section');

  // 스크롤 감지기(IntersectionObserver) 옵션 설정
  const observerOptions = {
    root: null,
    rootMargin: '-40% 0px -40% 0px', // 화면 중앙 20% 영역에 들어올 때 감지
    threshold: 0
  };

  // 섹션이 화면에 들어오면 해당 섹션 번호와 일치하는 도트에 'active' 클래스 부여
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const currentNum = entry.target.getAttribute('data-section');
        dots.forEach(dot => {
          dot.classList.remove('active');
          if (dot.getAttribute('data-target-section') === currentNum) {
            dot.classList.add('active');
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));

  // 도트 클릭 시 해당 섹션으로 부드럽게 스크롤 이동
  dots.forEach(dot => {
    dot.addEventListener('click', function () {
      const targetNum = this.getAttribute('data-target-section');
      const targetSection = document.querySelector(`.scroll-section[data-section="${targetNum}"]`);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // 하단 Top 버튼 스크롤 감지 및 클릭 이벤트
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        backToTopBtn.classList.add('show');
      } else {
        backToTopBtn.classList.remove('show');
      }
    });

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}


/* =======================================================
   섹션 1: 4개의 개별 지도 초기화 (V5 리플렛 하이브리드)
======================================================= */
function initSection1Maps() {
  // 섹션 1에 들어갈 4개 지도의 설정값 (위도, 경도, 줌, 지역 구분 등)
  const mapConfigsS1 = [
    { id: 'map-s1-1', center: [37.5562, 126.9850], zoom: 11, title: '남산 통감관저 터 (한일병합조약)', region: 'seoul' },
    { id: 'map-s1-2', center: [37.5658, 126.9751], zoom: 11, title: '덕수궁 함녕전 (고종 승하)', region: 'seoul' },
    { id: 'map-s1-3', center: [48.8566, 2.3522], zoom: 8, title: '프랑스 파리 (파리강화회의)', region: 'global' },
    { id: 'map-s1-4', center: [35.6989, 139.7544], zoom: 15, title: '도쿄 YMCA (2·8 독립선언지)', region: 'global' }
  ];

  mapConfigsS1.forEach(config => {
    const mapElement = document.getElementById(config.id);
    if (!mapElement) return;

    // 1. 공통 Leaflet 맵 객체 생성
    const map = L.map(config.id, {
      center: config.center,
      zoom: config.zoom,
      zoomControl: false,
      scrollWheelZoom: false, // 마우스 휠 스크롤로 지도 확대 방지
      attributionControl: false,
      // 서울은 특수 좌표계(5179), 해외는 글로벌 표준 좌표계(3857) 적용
      crs: config.region === 'seoul' ? getCrsEx() : L.CRS.EPSG3857
    });

    // 2. 지역별 타일 레이어(배경 지도) 분기
    if (config.region === 'seoul') {
      // 서울 지역: V5 확장팩(DAWULGIS_EX) 타일 호출
      const BASE_MAP = `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_normal/{z}/{j}/{k}/{x}/{y}/png`;
      const baseMapLayer = new L.TileLayer.DAWULGIS_EX(BASE_MAP, {
        minZoom: 1,
        maxZoom: 15
      });
      map.addLayer(baseMapLayer);
    } else {
      // 해외 지역: 글로벌 오픈스트리트맵 기반 타일 사용
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(map);
    }

    // 3. 지도 위에 펄스(파동) 애니메이션 마커와 툴팁 추가
    const icon = L.divIcon({
      className: 'custom-marker-wrapper',
      html: '<div class="map-pulse"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    L.marker(config.center, { icon: icon })
      .addTo(map)
      .bindTooltip(config.title, {
        permanent: true, // 툴팁 항상 표시
        direction: 'top',
        offset: [0, -15],
        className: 'custom-tooltip'
      }).openTooltip();
  });

  // 섹션 내 텍스트/요소가 스크롤할 때 스르륵 나타나는 애니메이션 감지
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active', 'visible');
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });

  document.querySelectorAll('.sc1-reveal').forEach(el => revealObserver.observe(el));
}


/* =======================================================
   도우미 함수: 두 지점 간의 곡선 경로 생성 (섹션 2 용)
   - 직선이 아닌 약간 휘어진 형태의 베지어 곡선 좌표 배열을 반환
======================================================= */
function generateCurvedPath(coords) {
  if (coords.length < 2) return coords;
  let curvedCoords = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];
    const lat1 = start[0], lng1 = start[1];
    const lat2 = end[0], lng2 = end[1];
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    const intensity = 0.2; // 곡선의 휘어짐 정도

    // 특정 구간마다 곡선의 방향(위/아래)을 다르게 줌
    const isTargetLine = (i === 0 || i === 1 || i === 4);
    const direction = isTargetLine ? 1 : -1;
    const offset = intensity * direction;
    const cpLat = midLat - (dLng * offset);
    const cpLng = midLng + (dLat * offset);

    // 곡선을 부드럽게 만들기 위해 20단계로 쪼개어 좌표 계산
    const steps = 20;
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * cpLat + t * t * lat2;
      const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * cpLng + t * t * lng2;
      if (i > 0 && step === 0) continue; // 중복 지점 방지
      curvedCoords.push([lat, lng]);
    }
  }
  return curvedCoords;
}


/* =======================================================
   섹션 2: 거사의 맹세 (타임라인 스크롤 & 맵 마커 동기화)
======================================================= */
async function initSection2() {
  const mapContainer = document.getElementById('map-s2');
  if (!mapContainer) return;

  // 1. 지도 기본 세팅 (서울 좌표계)
  const mapS2 = L.map('map-s2', {
    zoomControl: false,
    scrollWheelZoom: false,
    crs: getCrsEx()
  }).setView([37.5759 + 0.001, 126.9850 - 0.01], 10);

  // 2. 서울맵 V5 배경 타일 추가
  const BASE_MAP = `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_normal/{z}/{j}/{k}/{x}/{y}/png`;
  new L.TileLayer.DAWULGIS_EX(BASE_MAP, { minZoom: 1, maxZoom: 15 }).addTo(mapS2);

  // 브라우저 리사이즈 시 맵 크기 재조정 방어 코드
  const resizeObserverS2 = new ResizeObserver(() => mapS2.invalidateSize());
  resizeObserverS2.observe(mapContainer);

  // 점선 형태의 경로 선(Polyline) 껍데기 미리 생성
  const pathLine = L.polyline([], {
    color: '#000000', weight: 3, dashArray: '8, 8', opacity: 1, lineJoin: 'round'
  }).addTo(mapS2);

  // 타임라인 카드 스크롤 등장 애니메이션 감지기
  const sc2RevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('active');
      else entry.target.classList.remove('active');
    });
  }, { threshold: 0.4, rootMargin: "0px 0px -10% 0px" });

  try {
    // 3. 외부 GeoJSON 데이터 불러오기
    const response = await fetch('./assets/data/data1_3·1운동시간여행.geojson');
    const geojsonData = await response.json();

    // 표시할 마커 순서 ID
    const targetIds = ["46", "13", "78", "20", "37", "42", "40", "8", "24"];
    const timelineData = [];
    const locationsS2 = [];

    // GeoJSON에서 필요한 데이터만 추출하여 배열에 담기
    targetIds.forEach(targetId => {
      const feature = geojsonData.features.find(f => String(f.id) === targetId);
      if (feature) {
        let finalImgUrl = feature.properties.IMG_MAIN_URL || "";

        // 이미지 URL이 상대경로면 서울맵 도메인 붙여주기
        if (finalImgUrl && !finalImgUrl.startsWith("http")) {
          finalImgUrl = finalImgUrl.startsWith("/")
            ? "https://map.seoul.go.kr" + finalImgUrl
            : "https://map.seoul.go.kr/" + finalImgUrl;
        }

        timelineData.push({
          id: targetId,
          date: feature.properties.DATE || feature.properties.ADDR_OLD || "날짜 없음",
          title: feature.properties.TITLE || feature.properties.CONTENTS_NAME,
          desc: feature.properties.DESC || feature.properties.VALUE_03 || "설명 정보가 없습니다.",
          imgUrl: finalImgUrl
        });

        // 좌표계 파싱 (Point 또는 GeometryCollection 지원)
        let coords = null;
        if (feature.geometry.type === 'Point') {
          coords = feature.geometry.coordinates;
        } else if (feature.geometry.type === 'GeometryCollection') {
          const pointGeo = feature.geometry.geometries.find(g => g.type === 'Point');
          if (pointGeo) coords = pointGeo.coordinates;
        }

        if (coords) {
          locationsS2.push({
            id: targetId,
            pos: [coords[1], coords[0]], // Leaflet은 [lat, lng] 순서 요구
            label: feature.properties.CONTENTS_NAME
          });
        }
      }
    });

    // 4. 추출한 데이터를 바탕으로 HTML 타임라인 리스트 생성
    const timelineList = document.getElementById('sc2-timeline-list');
    timelineList.innerHTML = '';
    timelineData.forEach(item => {
      const imageHTML = item.imgUrl ? `<img src="${item.imgUrl}" alt="${item.title}" class="sc2-item-img">` : "";
      const cardHTML = `
        <div class="sc2-timeline-item sc2-scroll-reveal" data-marker="${item.id}">
            <span class="sc2-item-date">${item.date}</span>
            <h3 class="sc2-item-title">${item.title}</h3>
            ${imageHTML} <p class="sc2-item-desc">${item.desc}</p>
        </div>
      `;
      timelineList.insertAdjacentHTML('beforeend', cardHTML);
    });

    document.querySelectorAll('.sc2-scroll-reveal').forEach(el => sc2RevealObserver.observe(el));

    // 5. 추출한 좌표를 바탕으로 지도 위에 번호 마커 그리기
    const markers = {};
    locationsS2.forEach(loc => {
      const stepNumber = targetIds.indexOf(loc.id) + 1;
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class='sc2-marker-wrapper sc2-marker-dimmed' id='map-marker-container-${loc.id}'>
                  <div class='sc2-marker-circle'>${stepNumber}</div>
               </div>`,
        iconSize: [30, 30], iconAnchor: [15, 15]
      });

      const marker = L.marker(loc.pos, { icon }).addTo(mapS2);
      marker.bindTooltip(`<div style="text-align: center; font-weight: bold;">${loc.label}</div>`, {
        permanent: true, direction: 'top', className: 'sc2-marker-tooltip', offset: [0, -15]
      });
      markers[loc.id] = { marker, tooltip: marker.getTooltip() };
    });

    // 초기 선 렌더링
    const initialCoords = targetIds.map(id => locationsS2.find(l => l.id === id)?.pos).filter(Boolean);
    pathLine.setLatLngs(generateCurvedPath(initialCoords));

    // 6. 스크롤 감지에 따른 지도/마커 인터랙션 제어
    const markerObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const activeId = String(entry.target.getAttribute('data-marker'));
          const activeIndex = targetIds.indexOf(activeId);

          // 현재 활성화된 마커와 툴팁 하이라이트 (나머지는 어둡게 처리)
          Object.keys(markers).forEach(key => {
            const tooltipEl = markers[key]?.tooltip?.getElement();
            if (tooltipEl) {
              if (key === activeId) {
                tooltipEl.classList.remove('sc2-tooltip-dimmed');
                tooltipEl.classList.add('sc2-tooltip-active');
              } else {
                tooltipEl.classList.remove('sc2-tooltip-active');
                tooltipEl.classList.add('sc2-tooltip-dimmed');
              }
            }
          });

          targetIds.forEach((id) => {
            const container = document.getElementById(`map-marker-container-${id}`);
            if (container) {
              if (id === activeId) {
                container.classList.remove('sc2-marker-dimmed');
                container.classList.add('sc2-marker-active');
              } else {
                container.classList.remove('sc2-marker-active');
                container.classList.add('sc2-marker-dimmed');
              }
            }
          });

          // 지나온 경로까지만 선(Path) 그리기 업데이트
          const visibleCoords = targetIds.slice(0, activeIndex + 1).map(id => locationsS2.find(l => String(l.id) === id)?.pos).filter(Boolean);
          pathLine.setLatLngs(generateCurvedPath(visibleCoords));

          // 현재 카드의 좌표로 지도 부드럽게 이동(PanTo)
          const activeLoc = locationsS2.find(l => String(l.id) === activeId);
          if (activeLoc) {
            mapS2.invalidateSize();
            const zoom = mapS2.getZoom();
            // 화면 좌측 카드에 가려지지 않게 데스크탑에서는 오프셋(offsetX) 적용
            const targetPoint = mapS2.project(activeLoc.pos, zoom);
            const isMobile = window.innerWidth <= 768;
            const offsetX = isMobile ? 0 : 300;
            targetPoint.x -= offsetX;
            mapS2.panTo(mapS2.unproject(targetPoint, zoom), { animate: true, duration: 1.2 });
          }
        }
      });
    }, { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" });

    document.querySelectorAll('.sc2-timeline-item').forEach(item => markerObserver.observe(item));

  } catch (error) { console.error(error); }
}


/* =======================================================
   섹션 3: 함성의 궤적 (경로 라인 애니메이션)
======================================================= */
async function initSection3() {
  const mapContainer = document.getElementById('map-s3');
  if (!mapContainer) return;

  const mapS3 = L.map('map-s3', {
    zoomControl: false,
    scrollWheelZoom: false,
    crs: getCrsEx()
  }).setView([37.5665, 126.9780], 9);

  const BASE_MAP = `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_normal/{z}/{j}/{k}/{x}/{y}/png`;
  new L.TileLayer.DAWULGIS_EX(BASE_MAP, { minZoom: 9, maxZoom: 9 }).addTo(mapS3);

  setTimeout(() => { mapS3.invalidateSize(); }, 500);

  let activeGeoJsonLayer = null;
  let activeMarkers = [];
  // 각 스크롤 카드별로 매칭될 GeoJSON 피처 ID
  const sc3Groups = [
    { id: 'east-1', targetIds: ["52"] }, { id: 'east-2', targetIds: ["50"] },
    { id: 'west-1', targetIds: ["51"] }, { id: 'west-2', targetIds: ["53"] },
    { id: 'west-3', targetIds: ["49"] }, { id: 'march5-1', targetIds: ["48"] },
    { id: 'march5-2', targetIds: ["47"] }
  ];

  const sc3RevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('active');
      else entry.target.classList.remove('active');
    });
  }, { threshold: 0.4, rootMargin: "0px 0px -10% 0px" });

  try {
    const response = await fetch('./assets/data/data1_3·1운동시간여행.geojson');
    const sc3Data = await response.json();
    const timelineList = document.getElementById('sc3-timeline-list');
    timelineList.innerHTML = '';

    // HTML 카드 생성 로직
    sc3Groups.forEach(group => {
      const feature = sc3Data.features.find(f => String(f.id) === group.targetIds[0]);
      if (feature) {
        const props = feature.properties;
        const title = props.CONTENTS_NAME || "제목 없음";
        const name1 = props.NAME_01 || "";
        const val1 = props.VALUE_01 || "";
        const name2 = props.NAME_02 || "";
        const val2 = props.VALUE_02 ? props.VALUE_02.replace(/\n/g, '<br>') : "";

        timelineList.insertAdjacentHTML('beforeend', `
          <div class="sc3-timeline-item sc3-scroll-reveal" data-feature-id="${group.targetIds[0]}">
              <h3 class="sc3-item-title">${title}</h3>
              ${(name1 || val1) ? `<div class="sc3-route-box">${name1 ? `<strong class="sc3-route-label">${name1}</strong>` : ''}<p class="sc3-route-val">${val1}</p></div>` : ''}
              ${(name2 || val2) ? `<div class="sc3-desc-box">${name2 ? `<strong class="sc3-route-label">${name2}</strong>` : ''}<p class="sc3-item-desc">${val2}</p></div>` : ''}
          </div>
        `);
      }
    });

    document.querySelectorAll('.sc3-scroll-reveal').forEach(el => sc3RevealObserver.observe(el));

    // 스크롤 시 해당 ID의 GeoJSON 경로를 지도에 그리고 애니메이션(dash-offset) 적용
    const mapUpdateObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const featureId = entry.target.getAttribute('data-feature-id');
          const targetFeature = sc3Data.features.find(f => String(f.id) === featureId);

          // 이전 경로 및 마커 지우기
          if (activeGeoJsonLayer) mapS3.removeLayer(activeGeoJsonLayer);
          activeMarkers.forEach(m => mapS3.removeLayer(m));
          activeMarkers = [];

          if (targetFeature) {
            mapS3.invalidateSize();

            // 카메라(지도 뷰포트)를 그려질 경로 박스(bounds)에 맞춤
            const tempLayer = L.geoJSON(targetFeature);
            const isMobile = window.innerWidth <= 768;
            const padTopLeft = isMobile ? [30, 30] : [450, 50]; // UI 영역 확보 패딩
            const padBottomRight = isMobile ? [30, 150] : [50, 50];

            mapS3.fitBounds(tempLayer.getBounds(), {
              paddingTopLeft: padTopLeft, paddingBottomRight: padBottomRight, maxZoom: 13, animate: true, duration: 0.5
            });

            // 시작점, 도착점 마커 추출
            let lineCoords = [];
            if (targetFeature.geometry.type === 'GeometryCollection') {
              const lineStringGeo = targetFeature.geometry.geometries.find(g => g.type === 'LineString');
              if (lineStringGeo) lineCoords = lineStringGeo.coordinates;
            } else if (targetFeature.geometry.type === 'LineString') {
              lineCoords = targetFeature.geometry.coordinates;
            }

            if (lineCoords.length > 0) {
              const startCoord = [lineCoords[0][1], lineCoords[0][0]];
              const endCoord = [lineCoords[lineCoords.length - 1][1], lineCoords[lineCoords.length - 1][0]];

              const startIcon = L.divIcon({ className: 'sc3-point-marker start', html: '<div class="sc3-point-label">출발</div><div class="sc3-point-dot"></div>', iconSize: [40, 40], iconAnchor: [20, 40] });
              const endIcon = L.divIcon({ className: 'sc3-point-marker end', html: '<div class="sc3-point-label">도착</div><div class="sc3-point-dot"></div>', iconSize: [40, 40], iconAnchor: [20, 40] });

              activeMarkers.push(L.marker(startCoord, { icon: startIcon }).addTo(mapS3));
              activeMarkers.push(L.marker(endCoord, { icon: endIcon }).addTo(mapS3));
            }

            // 카메라 이동 후 경로 그리기 애니메이션 실행 (CSS dash-offset 기법)
            setTimeout(() => {
              activeGeoJsonLayer = L.geoJSON(targetFeature, {
                style: {
                  color: '#000000', weight: 6, opacity: 0.9, lineJoin: 'round', className: 'sc3-draw-path', fill: false
                }
              }).addTo(mapS3);

              const paths = document.querySelectorAll('.sc3-draw-path');
              paths.forEach(path => {
                const length = path.getTotalLength();
                path.style.strokeDasharray = length;
                path.style.strokeDashoffset = length;
                path.getBoundingClientRect(); // 강제 렌더링(리플로우) 유발
                path.style.transition = 'stroke-dashoffset 2.5s ease-in-out';
                path.style.strokeDashoffset = '0'; // 선이 그려지는 애니메이션 발동
              });
            }, 600);
          }
        }
      });
    }, { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" });

    document.querySelectorAll('.sc3-timeline-item').forEach(item => mapUpdateObserver.observe(item));
  } catch (error) { console.error(error); }
}


/* =======================================================
   섹션 4: 역사의 현장 (릴레이 마커 렌더링)
======================================================= */
async function initSection4() {
  const mapContainer = document.getElementById('map-s4');
  if (!mapContainer) return;

  const mapS4 = L.map('map-s4', {
    zoomControl: false, scrollWheelZoom: false, crs: getCrsEx()
  }).setView([37.577613288258206, 126.97689786832184], 7);

  const BASE_MAP = `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_normal/{z}/{j}/{k}/{x}/{y}/png`;
  new L.TileLayer.DAWULGIS_EX(BASE_MAP, { minZoom: 1, maxZoom: 15 }).addTo(mapS4);

  let mapTriggered = false; // 중복 실행 방지 플래그

  try {
    const response = await fetch('./assets/data/data1_3·1운동시간여행.geojson');
    const geojsonData = await response.json();

    // 화면에 섹션 4가 등장할 때 마커를 하나씩 순차적으로(릴레이) 찍어주는 로직
    const observerS4 = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !mapTriggered) {
          mapTriggered = true;
          mapS4.invalidateSize();

          let delay = 0; // 마커 등장 딜레이

          geojsonData.features.forEach((feature) => {
            const props = feature.properties;
            const subId = String(props.SUB_ID);
            const name = props.CONTENTS_NAME || "알 수 없는 장소";

            if (!props.COORD_Y || !props.COORD_X) return;

            const lat = parseFloat(props.COORD_Y);
            const lng = parseFloat(props.COORD_X);
            const latlng = [lat, lng];

            // 데이터의 SUB_ID 값에 따라 마커 색상(클래스) 분기
            let pulseClass = '';
            if (subId === '3') pulseClass = 'sc4-pulse-hub';
            else if (subId === '4') pulseClass = 'sc4-pulse-site';

            if (pulseClass !== '') {
              setTimeout(() => {
                const icon = L.divIcon({
                  className: 'sc4-marker-wrapper',
                  html: `<div class="${pulseClass}"></div>`,
                  iconSize: [24, 24], iconAnchor: [12, 12]
                });

                L.marker(latlng, { icon: icon })
                  .addTo(mapS4)
                  .bindTooltip(name, {
                    direction: 'top', offset: [0, -10], className: 'custom-tooltip'
                  });
              }, delay);
              delay += 150; // 다음 마커는 0.15초 뒤에 등장
            }
          });
        }
      });
    }, { threshold: 0.3 });

    observerS4.observe(mapContainer);
  } catch (error) { console.error('Section 4 GeoJSON 로드 에러:', error); }

  const sc4RevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('active');
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });

  document.querySelectorAll('.sc4-reveal').forEach(el => sc4RevealObserver.observe(el));
}


/* =======================================================
   섹션 5: 독립의 별들 (하단 캐러셀 & 팝업 동기화)
======================================================= */
async function initSection5() {
  const mapContainer = document.getElementById('map-s5');
  if (!mapContainer) return;

  const mapS5 = L.map('map-s5', {
    zoomControl: false, scrollWheelZoom: false, crs: getCrsEx()
  }).setView([37.577613288258206, 126.97689786832184], 10);

  const BASE_MAP = `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_normal/{z}/{j}/{k}/{x}/{y}/png`;
  new L.TileLayer.DAWULGIS_EX(BASE_MAP, { minZoom: 10, maxZoom: 10 }).addTo(mapS5);

  let activeMarkerS5 = null; // 현재 띄워진 단일 마커 관리

  try {
    const response = await fetch('./assets/data/data2_3·1운동 생활 속 현장.geojson');
    const geojsonData = await response.json();

    const trackContainer = document.getElementById('sc5-activist-list');
    const activists = geojsonData.features.filter(f => String(f.properties.SUB_ID) === '5');

    activists.forEach((feature) => {
      const props = feature.properties;
      if (!props.COORD_Y || !props.COORD_X) return;
      const lat = parseFloat(props.COORD_Y);
      const lng = parseFloat(props.COORD_X);
      const name = props.CONTENTS_NAME || "무명 열사";

      let imgUrl = props.IMG_MAIN_URL || "";
      if (imgUrl && !imgUrl.startsWith("http")) {
        imgUrl = imgUrl.startsWith("/")
          ? "https://map.seoul.go.kr" + imgUrl
          : "https://map.seoul.go.kr/" + imgUrl;
      }

      const shortAddr = props.ADDR_OLD || "활동 지역 불명";
      const detailDesc = props.VALUE_03 || props.VALUE_01 || "상세한 기록이 남아있지 않습니다.";

      // 하단 인물 슬라이드(캐러셀) 카드 HTML 생성
      const card = document.createElement('div');
      card.className = 'sc5-card';
      card.innerHTML = `
        <div class="sc5-card-img">
            <img src="${imgUrl}" alt="${name} 사진" onerror="this.style.display='none';">
        </div>
        <div class="sc5-card-info">
            <h4>${name}</h4>
            <p>${shortAddr.split(' ')[0]} ${shortAddr.split(' ')[1] || ''}</p>
        </div>
      `;

      // 인물 카드를 클릭했을 때의 동작
      card.addEventListener('click', () => {
        document.querySelectorAll('.sc5-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        // 기존에 찍혀있던 마커가 있으면 제거
        if (activeMarkerS5) mapS5.removeLayer(activeMarkerS5);

        // 새 마커 생성
        const icon = L.divIcon({
          className: 'sc5-marker-wrapper',
          html: `<div class="sc5-custom-pin"></div>`,
          iconSize: [16, 44], iconAnchor: [8, 44]
        });
        activeMarkerS5 = L.marker([lat, lng], { icon: icon }).addTo(mapS5);

        // 상세 설명 팝업 연결
        const popupContent = `
          <div class="sc5-popup-inner">
              <h3>${name}</h3>
              <span class="sc5-pop-addr">${props.ADDR_OLD || '주소 정보 없음'}</span>
              <div class="sc5-pop-desc">${detailDesc}</div>
          </div>
        `;

        activeMarkerS5.bindPopup(popupContent, {
          offset: [0, -35], className: 'sc5-leaflet-popup',
          autoPan: false // 🚨 [핵심] 팝업이 열릴 때 지도가 덜컹거리며 강제 이동하는 것을 막아줌
        }).openPopup();

        // 팝업 생성 후 지도를 해당 마커 위치로 부드럽게 이동시킴
        const zoom = 13;
        const centerLatLng = [lat, lng];
        mapS5.setView(centerLatLng, zoom, { animate: true, duration: 1.0 });

        setTimeout(() => { mapS5.invalidateSize(); }, 600);
      });

      trackContainer.appendChild(card);
    });

    // 좌/우 슬라이드 버튼 이벤트 처리
    const btnPrev = document.getElementById('sc5-btn-prev');
    const btnNext = document.getElementById('sc5-btn-next');

    btnPrev.addEventListener('click', () => {
      trackContainer.scrollBy({ left: -300, behavior: 'smooth' });
    });
    btnNext.addEventListener('click', () => {
      trackContainer.scrollBy({ left: 300, behavior: 'smooth' });
    });

  } catch (error) { console.error('Section 5 GeoJSON 로드 에러:', error); }

  const sc5RevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('active');
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });

  document.querySelectorAll('.sc5-reveal').forEach(el => sc5RevealObserver.observe(el));
}


/* =======================================================
   섹션 6 (남겨진 유산) 전용 스크롤 애니메이션 로직
======================================================= */
function initSection6() {
  const sc6RevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // 화면에 요소가 들어오면 'active' 클래스를 추가하여 애니메이션(페이드인 등) 실행
        entry.target.classList.add('active');
      }
    });
  }, {
    threshold: 0.15, // 요소가 화면에 15% 이상 보일 때 작동
    rootMargin: "0px 0px -10% 0px"
  });

  // HTML에서 'sc6-reveal' 클래스를 가진 모든 요소를 찾아 감지기에 등록
  document.querySelectorAll('.sc6-reveal').forEach(el => {
    sc6RevealObserver.observe(el);
  });
}


/* =======================================================
   🚀 최종 메인 앱 실행 (App Initialization)
   - 스크립트 실행의 진입점(Entry Point)
======================================================= */
async function initApp() {
  try {
    console.log("지도 API 부팅 시작...");

    // 1. 서울맵 API가 모두 다운로드될 때까지 기다립니다.
    await loadSeoulMapAPI();
    console.log("✅ 스마트서울맵 API 로드 완료! 화면을 그립니다.");

    // 2. 부팅이 끝나면 UI와 모든 섹션의 지도를 차례대로 깨웁니다(초기화).
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