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
    sceneA: 9,            // 인트로 → 시간 흐름 → 거리로 내려앉기
    relayPerPerson: 5,  // 릴레이(2D): 한 사람(제품)당
    relay3dPer: 8,        // 릴레이(3D): 한 사람(제품)당 — 휠 한 번에 너무 많이 넘어가지 않게 길게
    relayFirst: 13,       // 릴레이 03 (실제 3D: 노점 → 커플 → 골목 테이블)
    relayIntro: 0.6,      // 릴레이 시작 전 제목 구간
    sceneD: 4.2           // 도시 전체로
  },

  /* 스크롤을 따라가는 부드러움 (0.05 느림 ~ 0.3 빠름) */
  smoothing: 0.12,

  /* 지도 위 사람 점 개수 / 3D 거리의 사람 수 */
  agents: { desktop: 300, mobile: 150 },
  agents3d: 190,

  /* 제품 고르기: 지도에서 골목까지 내려가는 시간 (초) */
  selectFly: 2.2,

  /* 시간 흐름 속도 (클수록 점들이 빨리 움직임) */
  timelapseSpeed: 3200,

  /* 연도 */
  yearStart: 2026,
  yearEnd: 2030,
  yearMove: 0.45,       // 한 해 구간 중 '다음 해로 넘어가는' 비율 (나머지는 그 해에 머묾)

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
     예) 01번에 120장: { count: 120, ... } → PRODUCT01/assets/images/sequence/001.jpg ~ 120.jpg */
  sequences: [
    { count: 0, path: "./PRODUCT01/assets/images/sequence/", digits: 3, ext: ".jpg" },
    { count: 0, path: "./PRODUCT02/assets/images/sequence/", digits: 3, ext: ".jpg" },
    { count: 0, path: "./PRODUCT03/assets/images/sequence/", digits: 3, ext: ".jpg" },
    { count: 0, path: "./PRODUCT04/assets/images/sequence/", digits: 3, ext: ".jpg" }
  ],

  /* 모바일로 보는 화면 폭 기준 (px) */
  mobileWidth: 768
};

/* v9.2 최적화: 주소 끝에 ?lite 를 붙이면 가벼운 모드 (모델·사람 수를 줄임). 붙이지 않으면 지금과 똑같음 */
try { if (/[?&]lite(=1)?(&|$)/.test(location.search)) window.MD_LITE = true; } catch (e) {}

/* 모바일: 휴대폰·태블릿(손가락 터치 + 작은 화면)에서는 자동으로 가벼운 모드로 열림 → 메모리 부족으로 페이지가 꺼지지 않게.
   휴대폰에서도 전체 버전을 보고 싶으면 주소 끝에 ?full */
try {
  if (!/[?&]full(=1)?(&|$)/.test(location.search)) {
    var _ua = navigator.userAgent || "", _coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
    var _small = Math.min(screen.width || 9999, screen.height || 9999) <= 900;
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(_ua) || (_coarse && _small) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(_ua))) window.MD_LITE = true;
  }
} catch (e) {}
