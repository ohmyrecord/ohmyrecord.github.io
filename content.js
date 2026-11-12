/* =========================================================
   문구 · 제품 이름 · 이미지 경로 모음
   따옴표 "  " 안의 글자만 바꾸고 저장하면 사이트에 바로 반영됩니다.
   ========================================================= */
window.MD_CONTENT = {

  /* ---------- 사이트 이름 ---------- */
  siteName: "MYEONGDONG 2030",

  /* ---------- ① 인트로 ---------- */
  intro: {
    label: "우리가 상상한 4년 뒤의 거리",
    title: "Myeongdong",
    body: "2026년 명동. 노점 앞은 붐비고, 골목은 비어 있습니다.\n스크롤을 내려 2030년으로 걸어가 보세요."
  },

  /* ---------- ② 시간 흐름: 연도별 한 줄 ---------- */
  years: [
    { year: 2026, text: "노점 앞에 사람이 몰리고, 골목은 조용하다" },
    { year: 2027, text: "간판이 사람의 밀도를 읽고 색을 바꾸기 시작한다" },
    { year: 2028, text: "바닥 조명이 덜 붐비는 길을 비춘다" },
    { year: 2029, text: "새벽에는 배송 로봇만 거리를 지난다" },
    { year: 2030, text: "사람들은 흩어지고, 흐름은 정돈된다" }
  ],

  /* ---------- ③ 거리 도착 ---------- */
  arrive: {
    label: "2030년, 거리에 내려섰습니다",
    title: "Myeongdong, 2030"
  },

  /* ---------- ④ What Changed: 간판에 적힌 문장 ---------- */
  world: {
    label: "AI와 함께 달라진 거리의 생각",
    title: "What Changed",
    body: "작은 AI가 거리 곳곳에 스며든 명동. 사람들은 길을 묻는 대신 거리를 읽고,\n마지막 선택은 여전히 스스로 합니다.",
    signs: [
      "길을 묻지 않는다. 거리가 먼저 읽어 준다",
      "말이 달라도 주문은 같다",
      "AI가 제안하고, 사람이 고른다",
      "오늘의 발자국은 내일 사라진다",
      "줄 서는 대신 흐름을 탄다",
      "붐벼도 헤매지 않는다"
    ]
  },

  /* ---------- ⑤ 릴레이 제목 ---------- */
  relay: {
    label: "사람에서 사람으로, 제품에서 제품으로",
    title: "Relay"
  },

  /* ---------- 제품 4개 (릴레이 · 지도 · 목록 · 개별 페이지에 같이 쓰임) ----------
     name   : 제품 이름
     line   : 한 줄 설명
     input  : 입력 정보
     ai     : AI 판단
     act    : 물리적 반응
     useImg : 릴레이 장면에서 사람이 쓰는 제품 그림 (01은 그림이 코드로 그려져 있어 비워 둠)
     card   : 제품 목록 카드 이미지 (정사각형)
     page   : 누르면 이동할 페이지                                             */
  products: [
    {
      no: "PRODUCT 01",
      name: "STREET FOLD",
      line: "노점에서 받은 스티커 한 장으로 골목 테이블이 열린다",
      input: "결제 · 손님의 다음 동선 · 골목 테이블 빈자리",
      ai: "동선에 맞는 빈 테이블을 고른다",
      act: "FOLD MARK가 약도 스티커를 뽑고, 테이블이 펼쳐진다",
      useImg: "",
      card: "assets/cards/product-01.png",
      page: "product-01.html"
    },
    {
      no: "PRODUCT 02",
      name: "Product Name",
      line: "제품을 한 줄로 소개하는 문장을 적어 주세요",
      input: "입력 정보를 적어 주세요",
      ai: "AI가 무엇을 판단하는지 적어 주세요",
      act: "어떤 물리적 반응을 하는지 적어 주세요",
      useImg: "assets/relay/product-02-use.png",
      card: "assets/cards/product-02.png",
      page: "product-02.html"
    },
    {
      no: "PRODUCT 03",
      name: "Product Name",
      line: "제품을 한 줄로 소개하는 문장을 적어 주세요",
      input: "입력 정보를 적어 주세요",
      ai: "AI가 무엇을 판단하는지 적어 주세요",
      act: "어떤 물리적 반응을 하는지 적어 주세요",
      useImg: "assets/relay/product-03-use.png",
      card: "assets/cards/product-03.png",
      page: "product-03.html"
    },
    {
      no: "PRODUCT 04",
      name: "Product Name",
      line: "제품을 한 줄로 소개하는 문장을 적어 주세요",
      input: "입력 정보를 적어 주세요",
      ai: "AI가 무엇을 판단하는지 적어 주세요",
      act: "어떤 물리적 반응을 하는지 적어 주세요",
      useImg: "assets/relay/product-04-use.png",
      card: "assets/cards/product-04.png",
      page: "product-04.html"
    }
  ],

  /* ---------- ⑥ 도시 전체로 ---------- */
  city: {
    label: "네 제품은 명동 곳곳에서 이어진다",
    title: "Across Myeongdong",
    body: "한 골목의 릴레이는 지금 이 순간 거리 곳곳에서 동시에 일어납니다.\n2026년보다 사람은 많지만, 흐름은 훨씬 차분합니다."
  },

  /* ---------- ⑦ 제품 목록 ---------- */
  productsSection: {
    label: "하나씩 자세히 보기",
    title: "Products"
  },

  /* ---------- ⑧ 아웃트로 ---------- */
  outro: {
    line: "2030 명동,\n길은 여전히 붐비지만\n아무도 헤매지 않는다.",
    button: "제품 보기"
  }
};
