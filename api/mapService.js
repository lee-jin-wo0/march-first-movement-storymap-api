/* =======================================================
   API 엔드포인트(URL) 관리 객체
======================================================= */
export const MAP_ENDPOINTS = {
  seoulBaseMap_normal: `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_normal/{z}/{j}/{k}/{x}/{y}/png`,
  seoulBaseMap_air: `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_air/{z}/{j}/{k}/{x}/{y}/png`,
  seoulBaseMap_onlyair: `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_onlyair/{z}/{j}/{k}/{x}/{y}/png`,
  seoulBaseMap_kor: `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_normal/{z}/{j}/{k}/{x}/{y}/png`,
  seoulBaseMap_big_kor: `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_bigfontnormal/{z}/{j}/{k}/{x}/{y}/png`,
  seoulBaseMap_kor_air: `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_air/{z}/{j}/{k}/{x}/{y}/png`,
  seoulBaseMap_eng: `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_eng_normal/{z}/{j}/{k}/{x}/{y}/png`,
  seoulBaseMap_eng_air: `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_eng_air/{z}/{j}/{k}/{x}/{y}/png`,
  themeData_11100550: `https://map.seoul.go.kr/openapi/v5/${CONFIG.THEMA_API_KEY}/public/themes/contents/ko?page_size=999&page_no=1&coord_x=126.974695&coord_y=37.564150&distance=999999&search_type=0&search_name=&theme_id=11100550&content_id=&subcate_id=`,
  themeData_100173: `https://map.seoul.go.kr/openapi/v5/${CONFIG.THEMA_API_KEY}/public/themes/contents/ko?page_size=999&page_no=1&coord_x=126.974695&coord_y=37.564150&distance=999999&search_type=0&search_name=&theme_id=100173&content_id=&subcate_id=`
};

/* =======================================================
   도우미 함수: API 응답 데이터(JSON)를 GeoJSON 형식으로 완벽 변환
======================================================= */
function transformToGeoJSON(apiData) {
  const items = apiData.body || [];

  const features = items.map(item => {
    let geomType = "Point";
    let coords = [parseFloat(item.COT_COORD_X || 0), parseFloat(item.COT_COORD_Y || 0)];

    if (item.COT_COORD_DATA && item.COT_COORD_DATA !== "[]") {
      try {
        const parsedPath = JSON.parse(item.COT_COORD_DATA);

        if (Array.isArray(parsedPath) && parsedPath.length > 0) {
          // 💡 수정된 부분: 배열 안의 첫 번째 요소가 배열인지 확인하여 '선'과 '점'을 정확히 구분합니다.
          if (Array.isArray(parsedPath[0])) {
            geomType = "LineString";
            coords = parsedPath;
          } else {
            geomType = "Point";
            // 점 데이터일 경우 기본 좌표값을 그대로 사용
          }
        }
      } catch (e) {
        console.warn("경로 데이터 파싱 실패:", e);
      }
    }

    return {
      type: "Feature",
      id: item.COT_CONTS_ID,
      properties: item,
      geometry: {
        type: geomType,
        coordinates: coords
      }
    };
  });

  return { type: "FeatureCollection", features };
}

/* =======================================================
   데이터 호출 함수 
======================================================= */
export async function fetchTimeTravelData() {
  try {
    const response = await fetch(MAP_ENDPOINTS.themeData_11100550);
    if (!response.ok) throw new Error("시간여행 테마 API 통신 에러");
    const data = await response.json();
    return transformToGeoJSON(data);
  } catch (error) {
    console.error("데이터 로드 실패:", error);
    return { type: "FeatureCollection", features: [] };
  }
}

export async function fetchDailyLifeData() {
  try {
    const response = await fetch(MAP_ENDPOINTS.themeData_100173);
    if (!response.ok) throw new Error("생활속현장 테마 API 통신 에러");
    const data = await response.json();
    return transformToGeoJSON(data);
  } catch (error) {
    console.error("데이터 로드 실패:", error);
    return { type: "FeatureCollection", features: [] };
  }
}