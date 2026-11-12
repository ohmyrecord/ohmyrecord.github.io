/* =========================================================
   설정값 모음 — 속도, 길이, 색은 여기서만 바꾸면 됩니다.
   (숫자만 바꾸고 저장 → 브라우저 새로고침)
   ========================================================= */
window.MD_CONFIG = {

  /* 색 (팀 무드보드) */
  colors: {
    bg:      "#FFFDF4",   // 배경
    point:   "#F2D94B",   // 포인트 (빛, 주 버튼)
    ink:     "#2F312B",   // 중요한 글자
    sub:     "#61645D",   // 부가 설명
    // 예전 Design DNA에서 보조로 빌려 온 색
    dnaCharcoal: "#646661",
    dnaPale:     "#F5E7B6",
    dnaIvory:    "#F7F5E8",
    // 지도·거리 그림에 쓰는 색
    building:    "#EFE9D6",
    roof:        "#E6DFC8",
    street:      "#FFFDF4",
    crowd:       "#2F312B",
    night:       "#2F312B"
  },

  /* 스크롤 길이 (화면 몇 장 분량인지) */
  scroll: {
    sceneA: 8,            // 인트로 → 시간 흐름 → 거리로 내려앉기
    relayPerPerson: 2.6,  // 릴레이: 한 사람(제품)당
    relayIntro: 0.6,      // 릴레이 시작 전 제목 구간
    sceneD: 4.2           // 도시 전체로
  },

  /* 스크롤을 따라가는 부드러움 (0.05 느림 ~ 0.3 빠름) */
  smoothing: 0.12,

  /* 지도 위 사람 점 개수 */
  agents: { desktop: 720, mobile: 280 },

  /* 시간 흐름 속도 (클수록 점들이 빨리 움직임) */
  timelapseSpeed: 3200,

  /* 연도 */
  yearStart: 2026,
  yearEnd: 2030,

  /* 사이트 전체에서 쓰는 움직임 곡선 (3가지로 통일) */
  //  - linear : 스크롤에 붙어 움직이는 장면
  //  - inOut  : 카메라 이동, 장면 전환
  //  - out    : 요소가 나타날 때
  easing: {
    inOut: [0.65, 0, 0.35, 1],
    out:   [0.22, 0.61, 0.36, 1]
  },

  /* 릴레이 장면을 '영상 프레임'으로 바꾸기 (README 6번 참고)
     count 에 이미지 장수를 적으면, 그 제품 장면 대신 이미지들이 스크롤에 맞춰 넘어갑니다.
     예) 01번에 120장: { count: 120, ... } → assets/sequence/product-01/001.jpg ~ 120.jpg */
  sequences: [
    { count: 0, path: "assets/sequence/product-01/", digits: 3, ext: ".jpg" },
    { count: 0, path: "assets/sequence/product-02/", digits: 3, ext: ".jpg" },
    { count: 0, path: "assets/sequence/product-03/", digits: 3, ext: ".jpg" },
    { count: 0, path: "assets/sequence/product-04/", digits: 3, ext: ".jpg" }
  ],

  /* 모바일로 보는 화면 폭 기준 (px) */
  mobileWidth: 768
};
