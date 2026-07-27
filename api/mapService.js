/* =======================================================
   API 엔드포인트(URL) 관리 객체
   - 서울맵의 배경 타일 이미지와 테마 데이터를 불러오기 위한 주소 모음
======================================================= */
const MAP_ENDPOINTS = {
  // 1. 서울맵 배경 타일 지도 (국문 기본 지도)
  // {z}, {j}, {k}, {x}, {y}는 Leaflet V5 확장팩에서 자동으로 현재 화면의 좌표와 줌 레벨에 맞게 변환해 줍니다.
  seoulBaseMap_kor: `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_normal/{z}/{j}/{k}/{x}/{y}/png`,

  // 2. 서울맵 배경 타일 지도 (영문 기본 지도)
  seoulBaseMap_eng: `https://map.seoul.go.kr/openapi/v5/${CONFIG.MAP_API_KEY}/public/map/base/dawul_eng_normal/{z}/{j}/{k}/{x}/{y}/png`,

  // 3. 특정 테마 데이터 호출 (테마 ID: 11100550)
  // 지정된 중심 좌표(coord_x: 126.974695, coord_y: 37.564150 - 서울시청 부근)를 기준으로 
  // 광범위한 반경(distance=999999) 내의 데이터를 한 번에 최대 999개(page_size)까지 불러옵니다.
  themeData_11100550: `https://map.seoul.go.kr/openapi/v5/${CONFIG.THEMA_API_KEY}/public/themes/contents/ko?page_size=999&page_no=1&coord_x=126.974695&coord_y=37.564150&distance=999999&search_type=0&search_name=&theme_id=11100550&content_id=&subcate_id=`,

  // 4. 특정 테마 데이터 호출 (테마 ID: 100173)
  // 위와 동일한 검색 조건으로 다른 테마 ID(100173)에 해당하는 콘텐츠 데이터를 불러옵니다.
  themeData_100173: `https://map.seoul.go.kr/openapi/v5/${CONFIG.THEMA_API_KEY}/public/themes/contents/ko?page_size=999&page_no=1&coord_x=126.974695&coord_y=37.564150&distance=999999&search_type=0&search_name=&theme_id=100173&content_id=&subcate_id=`
};