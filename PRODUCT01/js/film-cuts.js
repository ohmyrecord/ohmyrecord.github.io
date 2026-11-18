/* =========================================================
   첫 시나리오 실사 영상 목록  (← 컷 5~10 영상이 생기면 여기만 고치면 됩니다)
   ---------------------------------------------------------
   · a ~ b  : 이 컷이 차지하는 스크롤 구간 (0 = 시작, 1 = 끝). 글자 · 원형 확대는 이 위치에 맞춰 나옵니다.
   · src    : 영상 파일 (assets/videos 폴더). 비워 두면("") 그 구간은 지금처럼 3D 장면으로 보입니다.
   · from ~ to : 영상에서 실제로 쓸 부분(초). Omni 가 10초로 만들어 와도 여기서 필요한 3~4초만 골라 씁니다.
   · 새 영상 넣는 법: 영상을 assets/videos 에 cut05.mp4 처럼 넣고 → 아래 줄의 src 에 이름을 적고 → from / to 를 고르기
     (가능하면 Claude 에게 주면 스크롤에 부드럽게 맞도록 다시 압축해 줍니다. 그대로 넣어도 작동은 합니다)
   ========================================================= */
window.PP_FILM_CUTS = [
  { cut: 1,  a: 0,    b: .13,  src: "./assets/videos/cut01.mp4", from: 0, to: 4, poster: "./assets/videos/cut01.jpg" },   // 첫 화면: 카운터 위 FOLD MARK
  { cut: 2,  a: .13,  b: .19,  src: "./assets/videos/cut02.mp4", from: 0, to: 3, poster: "./assets/videos/cut02.jpg" },   // FOLD MARK 가까이 (빛 띠)
  { cut: 3,  a: .19,  b: .272, src: "./assets/videos/cut03.mp4", from: 0, to: 3, poster: "./assets/videos/cut03.jpg" },   // 주먹으로 툭
  { cut: 4,  a: .272, b: .39,  src: "./assets/videos/cut04.mp4", from: 0, to: 4, poster: "./assets/videos/cut04.jpg" },   // 약도 스티커 뽑기
  { cut: 5,  a: .39,  b: .5,   src: "./assets/videos/cut05.mp4", from: 0, to: 4.4, poster: "./assets/videos/cut05.jpg" },   // 트레이 옆면에 붙여 건넴 (스티커: 한국어 · 12번)
  { cut: 6,  a: .5,   b: .6,   src: "./assets/videos/cut06.mp4", from: 0, to: 1.6, poster: "./assets/videos/cut06.jpg" },   // 트레이 들고 골목으로
  { cut: 7,  a: .6,   b: .67,  src: "", from: 0, to: 3 },     // 기둥 도착  (← 재생성 영상 기다리는 중: 그동안 3D)
  { cut: 8,  a: .67,  b: .76,  src: "", from: 0, to: 5 },     // 인식 → 판 내려옴
  { cut: 9,  a: .76,  b: .87,  src: "./assets/videos/cut09.mp4", from: 0, to: 4.1, poster: "./assets/videos/cut09.jpg" },   // 다 먹은 트레이 버리기
  { cut: 10, a: .87,  b: 1,    src: "./assets/videos/cut10.mp4", from: 0, to: 4.45, poster: "./assets/videos/cut10.jpg" }   // 판 올려 접기
];
