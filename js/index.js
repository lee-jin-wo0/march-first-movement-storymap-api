/* =======================================================
   1. 스마트서울맵 OpenAPI V5 동적 로드 (Leaflet 확장팩)
======================================================= */
function loadSeoulMapAPI() {
    return new Promise((resolve, reject) => {
        if (typeof CONFIG === 'undefined' || !CONFIG.MAP_API_KEY) {
            console.warn("API 키가 없습니다. config.js를 확인하세요.");
            resolve();
            return;
        }

        const key = CONFIG.MAP_API_KEY;

        // 1. 서울맵 전용 CSS 로드
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://map.seoul.go.kr/openapi/v5/${key}/public/map/css/5.0`;
        document.head.appendChild(link);

        // 2. 서울맵 메인 JS (Leaflet + V5 코어) 로드
        const script1 = document.createElement('script');
        script1.src = `https://map.seoul.go.kr/openapi/v5/${key}/public/map/js/5.0`;
        document.head.appendChild(script1);

        // 메인 JS가 로드된 후에 좌표계 확장 JS를 로드해야 에러가 안 납니다.
        script1.onload = () => {
            // 3. 한국 좌표계(5179) 확장 JS 로드
            const script2 = document.createElement('script');
            script2.src = `https://map.seoul.go.kr/openapi/v5/${key}/public/map/base/js/5179/5.0`;

            script2.onload = () => resolve(); // 모든 로드 완료!
            script2.onerror = () => reject(new Error("좌표계 스크립트 로드 실패"));

            document.head.appendChild(script2);
        };

        script1.onerror = () => reject(new Error("서울맵 V5 메인 스크립트 로드 실패"));
    });
}



/* =======================================================
   2. 전역 스크롤 및 UI 컨트롤 (기존 index.js)
======================================================= */
function initGlobalUI() {
    const dots = document.querySelectorAll('.global-dot');
    const sections = document.querySelectorAll('.scroll-section');

    const observerOptions = {
        root: null,
        rootMargin: '-40% 0px -40% 0px',
        threshold: 0
    };

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

    dots.forEach(dot => {
        dot.addEventListener('click', function () {
            const targetNum = this.getAttribute('data-target-section');
            const targetSection = document.querySelector(`.scroll-section[data-section="${targetNum}"]`);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

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
   3. 섹션별 지도 및 기능 초기화 (기존 section1~6.js 영역)
======================================================= */
/* =======================================================
   섹션 1: 4개의 개별 지도 초기화 (V5 리플렛 하이브리드)
======================================================= */
function initSection1Maps() {
    const mapConfigsS1 = [
        // Leaflet은 다시 [위도, 경도] 순서로 씁니다!
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
            scrollWheelZoom: false,
            attributionControl: false,
            crs: config.region === 'seoul' ? getCrsEx() : L.CRS.EPSG3857 // 서울은 5179 특수 좌표계, 해외는 표준 좌표계
        });

        // 2. 지역별 타일 레이어 분기
        if (config.region === 'seoul') {
            // 서울: V5 확장팩 (DAWULGIS_EX) 사용 - 드디어 {j}, {k} 에러가 사라집니다!
            const BASE_MAP = `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_normal/{z}/{j}/{k}/{x}/{y}/png`;
            const baseMapLayer = new L.TileLayer.DAWULGIS_EX(BASE_MAP, {
                minZoom: 1,
                maxZoom: 15
            });
            map.addLayer(baseMapLayer);
        } else {
            // 해외: 기존 글로벌 오픈스트리트맵 타일 사용
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19
            }).addTo(map);
        }

        // 3. 커스텀 마커(Pulse) 및 툴팁 추가
        const icon = L.divIcon({
            className: 'custom-marker-wrapper',
            html: '<div class="map-pulse"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });

        L.marker(config.center, { icon: icon })
            .addTo(map)
            .bindTooltip(config.title, {
                permanent: true,
                direction: 'top',
                offset: [0, -15],
                className: 'custom-tooltip'
            }).openTooltip();
    });

    // 스크롤 드러나기 애니메이션
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
   섹션 2: 거사의 맹세 (Leaflet + V5 확장팩)
======================================================= */
/* =======================================================
   도우미 함수: 곡선 생성 (섹션 2 용)
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
        const intensity = 0.2;
        const isTargetLine = (i === 0 || i === 1 || i === 4);
        const direction = isTargetLine ? 1 : -1;
        const offset = intensity * direction;
        const cpLat = midLat - (dLng * offset);
        const cpLng = midLng + (dLat * offset);
        const steps = 20;
        for (let step = 0; step <= steps; step++) {
            const t = step / steps;
            const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * cpLat + t * t * lat2;
            const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * cpLng + t * t * lng2;
            if (i > 0 && step === 0) continue;
            curvedCoords.push([lat, lng]);
        }
    }
    return curvedCoords;
}


async function initSection2() {
    const mapContainer = document.getElementById('map-s2');
    if (!mapContainer) return;

    // 💡 1. 서울시 전용 좌표계(crs: getCrsEx()) 적용
    const mapS2 = L.map('map-s2', {
        zoomControl: false,
        scrollWheelZoom: false,
        crs: getCrsEx()
    }).setView([37.5759 + 0.001, 126.9850 - 0.01], 10); // 줌 레벨 낮춤

    // 💡 2. 서울맵 V5 타일 적용 (DAWULGIS_EX)
    const BASE_MAP = `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_normal/{z}/{j}/{k}/{x}/{y}/png`;
    new L.TileLayer.DAWULGIS_EX(BASE_MAP, { minZoom: 1, maxZoom: 15 }).addTo(mapS2);

    const resizeObserverS2 = new ResizeObserver(() => {
        mapS2.invalidateSize();
    });
    resizeObserverS2.observe(mapContainer);

    const pathLine = L.polyline([], {
        color: '#000000', weight: 3, dashArray: '8, 8', opacity: 1, lineJoin: 'round'
    }).addTo(mapS2);

    const sc2RevealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('active');
            else entry.target.classList.remove('active');
        });
    }, { threshold: 0.4, rootMargin: "0px 0px -10% 0px" });

    try {
        const response = await fetch('./assets/data/data1_3·1운동시간여행.geojson');
        const geojsonData = await response.json();
        const targetIds = ["46", "13", "78", "20", "37", "42", "40", "8", "24"];
        const timelineData = [];
        const locationsS2 = [];

        targetIds.forEach(targetId => {
            const feature = geojsonData.features.find(f => String(f.id) === targetId);
            if (feature) {
                // ⭕ 수정된 코드 (덮어씌워주세요)
                let finalImgUrl = feature.properties.IMG_MAIN_URL || "";
                if (finalImgUrl && !finalImgUrl.startsWith("http")) {
                    finalImgUrl = finalImgUrl.startsWith("/")
                        ? "https://map.seoul.go.kr" + finalImgUrl
                        : "https://map.seoul.go.kr/" + finalImgUrl; // 슬래시가 없으면 강제로 넣어줍니다!
                }

                timelineData.push({
                    id: targetId,
                    date: feature.properties.DATE || feature.properties.ADDR_OLD || "날짜 없음",
                    title: feature.properties.TITLE || feature.properties.CONTENTS_NAME,
                    desc: feature.properties.DESC || feature.properties.VALUE_03 || "설명 정보가 없습니다.",
                    imgUrl: finalImgUrl
                });

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
                        pos: [coords[1], coords[0]], // [lat, lng]
                        label: feature.properties.CONTENTS_NAME
                    });
                }
            }
        });

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

        const initialCoords = targetIds.map(id => locationsS2.find(l => l.id === id)?.pos).filter(Boolean);
        pathLine.setLatLngs(generateCurvedPath(initialCoords));

        const markerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const activeId = String(entry.target.getAttribute('data-marker'));
                    const activeIndex = targetIds.indexOf(activeId);

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
                            if (id === activeId) { // 👈 조건 변경: 현재 카드의 id와 같을 때만!
                                container.classList.remove('sc2-marker-dimmed');
                                container.classList.add('sc2-marker-active');
                            } else {
                                container.classList.remove('sc2-marker-active');
                                container.classList.add('sc2-marker-dimmed');
                            }
                        }
                    });

                    const visibleCoords = targetIds.slice(0, activeIndex + 1).map(id => locationsS2.find(l => String(l.id) === id)?.pos).filter(Boolean);
                    pathLine.setLatLngs(generateCurvedPath(visibleCoords));

                    const activeLoc = locationsS2.find(l => String(l.id) === activeId);
                    if (activeLoc) {
                        mapS2.invalidateSize();
                        const zoom = mapS2.getZoom();
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
   섹션 3: 함성의 궤적 (Leaflet + V5 확장팩)
======================================================= */
async function initSection3() {
    const mapContainer = document.getElementById('map-s3');
    if (!mapContainer) return;

    // 1. 지도 생성
    const mapS3 = L.map('map-s3', {
        zoomControl: false,
        scrollWheelZoom: false,
        crs: getCrsEx()
    }).setView([37.5665, 126.9780], 9);

    // 2. 타일 로딩 (여기까지만 수행해도 고정된 높이 덕분에 지도가 바로 뜹니다)
    const BASE_MAP = `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_normal/{z}/{j}/{k}/{x}/{y}/png`;
    new L.TileLayer.DAWULGIS_EX(BASE_MAP, { minZoom: 9, maxZoom: 9 }).addTo(mapS3);

    // 3. 마지막으로 딱 한 번만 크기 갱신
    setTimeout(() => {
        mapS3.invalidateSize();
    }, 500);

    let activeGeoJsonLayer = null;
    let activeMarkers = [];
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

        // 💡 3. 원본 CSS 스크롤 애니메이션 완벽 부활!
        const mapUpdateObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const featureId = entry.target.getAttribute('data-feature-id');
                    const targetFeature = sc3Data.features.find(f => String(f.id) === featureId);

                    if (activeGeoJsonLayer) mapS3.removeLayer(activeGeoJsonLayer);
                    activeMarkers.forEach(m => mapS3.removeLayer(m));
                    activeMarkers = [];

                    if (targetFeature) {
                        mapS3.invalidateSize();

                        const tempLayer = L.geoJSON(targetFeature);
                        mapS3.invalidateSize();
                        const isMobile = window.innerWidth <= 768;
                        const padTopLeft = isMobile ? [30, 30] : [450, 50];
                        const padBottomRight = isMobile ? [30, 150] : [50, 50];

                        mapS3.fitBounds(tempLayer.getBounds(), {
                            paddingTopLeft: padTopLeft, paddingBottomRight: padBottomRight, maxZoom: 13, animate: true, duration: 0.5
                        });

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

                        setTimeout(() => {
                            activeGeoJsonLayer = L.geoJSON(targetFeature, {
                                style: {
                                    color: '#000000',
                                    weight: 6,
                                    opacity: 0.9,
                                    lineJoin: 'round',
                                    className: 'sc3-draw-path',
                                    fill: false
                                }
                            }).addTo(mapS3);

                            const paths = document.querySelectorAll('.sc3-draw-path');
                            paths.forEach(path => {
                                const length = path.getTotalLength();
                                path.style.strokeDasharray = length;
                                path.style.strokeDashoffset = length;
                                path.getBoundingClientRect();
                                path.style.transition = 'stroke-dashoffset 2.5s ease-in-out';
                                path.style.strokeDashoffset = '0';
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
   섹션 4: 역사의 현장 (Leaflet + V5 확장팩)
======================================================= */
async function initSection4() {
    const mapContainer = document.getElementById('map-s4');
    if (!mapContainer) return;

    // 💡 1. 서울시 전용 좌표계 및 줌 레벨 조정
    const mapS4 = L.map('map-s4', {
        zoomControl: false,
        scrollWheelZoom: false,
        crs: getCrsEx()
    }).setView([37.577613288258206, 126.97689786832184], 7);

    // 💡 2. 서울맵 V5 타일 적용
    const BASE_MAP = `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_normal/{z}/{j}/{k}/{x}/{y}/png`;
    new L.TileLayer.DAWULGIS_EX(BASE_MAP, { minZoom: 1, maxZoom: 15 }).addTo(mapS4);

    let mapTriggered = false;

    try {
        const response = await fetch('./assets/data/data1_3·1운동시간여행.geojson');
        const geojsonData = await response.json();

        const observerS4 = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !mapTriggered) {
                    mapTriggered = true;
                    mapS4.invalidateSize();

                    let delay = 0; // 마커 릴레이 딜레이

                    geojsonData.features.forEach((feature) => {
                        const props = feature.properties;
                        const subId = String(props.SUB_ID);
                        const name = props.CONTENTS_NAME || "알 수 없는 장소";

                        if (!props.COORD_Y || !props.COORD_X) return;

                        const lat = parseFloat(props.COORD_Y);
                        const lng = parseFloat(props.COORD_X);
                        const latlng = [lat, lng];

                        let pulseClass = '';
                        if (subId === '3') pulseClass = 'sc4-pulse-hub';
                        else if (subId === '4') pulseClass = 'sc4-pulse-site';

                        if (pulseClass !== '') {
                            setTimeout(() => {
                                // 💡 3. 원본 CSS 애니메이션 완벽 적용
                                const icon = L.divIcon({
                                    className: 'sc4-marker-wrapper',
                                    html: `<div class="${pulseClass}"></div>`,
                                    iconSize: [24, 24],
                                    iconAnchor: [12, 12]
                                });

                                L.marker(latlng, { icon: icon })
                                    .addTo(mapS4)
                                    .bindTooltip(name, {
                                        direction: 'top',
                                        offset: [0, -10],
                                        className: 'custom-tooltip'
                                    });
                            }, delay);
                            delay += 150; // 0.15초 간격으로 팟! 팟! 등장
                        }
                    });
                }
            });
        }, { threshold: 0.3 });

        observerS4.observe(mapContainer);

    } catch (error) {
        console.error('Section 4 GeoJSON 로드 에러:', error);
    }

    const sc4RevealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('active');
        });
    }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });

    document.querySelectorAll('.sc4-reveal').forEach(el => sc4RevealObserver.observe(el));
}


/* =======================================================
   섹션 5: 독립의 별들 (Leaflet + V5 확장팩)
======================================================= */
async function initSection5() {
    const mapContainer = document.getElementById('map-s5');
    if (!mapContainer) return;

    // 💡 1. 서울시 전용 좌표계 및 줌 레벨 조정
    const mapS5 = L.map('map-s5', {
        zoomControl: false,
        scrollWheelZoom: false,
        crs: getCrsEx()
    }).setView([37.577613288258206, 126.97689786832184], 10);

    // 💡 2. 서울맵 V5 타일 적용
    const BASE_MAP = `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_normal/{z}/{j}/{k}/{x}/{y}/png`;
    new L.TileLayer.DAWULGIS_EX(BASE_MAP, { minZoom: 10, maxZoom: 10 }).addTo(mapS5);

    let activeMarkerS5 = null;

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

            // ⭕ 수정된 코드 (덮어씌워주세요)
            let imgUrl = props.IMG_MAIN_URL || "";
            if (imgUrl && !imgUrl.startsWith("http")) {
                imgUrl = imgUrl.startsWith("/")
                    ? "https://map.seoul.go.kr" + imgUrl
                    : "https://map.seoul.go.kr/" + imgUrl;
            }

            const shortAddr = props.ADDR_OLD || "활동 지역 불명";
            const detailDesc = props.VALUE_03 || props.VALUE_01 || "상세한 기록이 남아있지 않습니다.";

            // 4. HTML 카드 생성
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

            card.addEventListener('click', () => {
                document.querySelectorAll('.sc5-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                if (activeMarkerS5) mapS5.removeLayer(activeMarkerS5);

                // 1. 마커 먼저 생성
                const icon = L.divIcon({
                    className: 'sc5-marker-wrapper',
                    html: `<div class="sc5-custom-pin"></div>`,
                    iconSize: [16, 44],
                    iconAnchor: [8, 44]
                });
                activeMarkerS5 = L.marker([lat, lng], { icon: icon }).addTo(mapS5);

                // 2. [핵심] 팝업이 지도를 강제로 움직이지 않게 설정 (autoPan: false)
                const popupContent = `
                    <div class="sc5-popup-inner">
                        <h3>${name}</h3>
                        <span class="sc5-pop-addr">${props.ADDR_OLD || '주소 정보 없음'}</span>
                        <div class="sc5-pop-desc">${detailDesc}</div>
                    </div>
                `;

                activeMarkerS5.bindPopup(popupContent, {
                    offset: [0, -35],
                    className: 'sc5-leaflet-popup',
                    autoPan: false // 🚨 팝업이 지도를 강제로 흔드는 것을 차단!
                }).openPopup();

                // 3. [핵심] 지도 중심을 화면상 중앙(카드를 제외한 부분의 중앙)으로 명확히 이동
                // 카드가 하단에 고정되어 있으므로, 위쪽 여백을 20% 정도 줍니다.
                const zoom = 13;
                // lat에서 살짝 위쪽으로 중심을 옮겨야 마커가 중앙에 보임
                const centerLatLng = [lat, lng];

                mapS5.setView(centerLatLng, zoom, { animate: true, duration: 1.0 });

                setTimeout(() => { mapS5.invalidateSize(); }, 600);
            });

            trackContainer.appendChild(card);
        });

        const btnPrev = document.getElementById('sc5-btn-prev');
        const btnNext = document.getElementById('sc5-btn-next');

        btnPrev.addEventListener('click', () => {
            trackContainer.scrollBy({ left: -300, behavior: 'smooth' });
        });
        btnNext.addEventListener('click', () => {
            trackContainer.scrollBy({ left: 300, behavior: 'smooth' });
        });

    } catch (error) {
        console.error('Section 5 GeoJSON 로드 에러:', error);
    }

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
                // 화면에 요소가 들어오면 'active' 클래스를 추가하여 애니메이션 실행
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
======================================================= */
async function initApp() {
    try {
        console.log("지도 API 부팅 시작...");

        // 1. 서울맵 API가 모두 다운로드될 때까지 기다립니다.
        await loadSeoulMapAPI();
        console.log("✅ 스마트서울맵 API 로드 완료! 화면을 그립니다.");

        // 2. 부팅이 끝나면 UI와 모든 섹션의 지도를 차례대로 깨웁니다.
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

// 브라우저 렌더링이 준비되면 initApp 함수 실행
document.addEventListener('DOMContentLoaded', initApp);