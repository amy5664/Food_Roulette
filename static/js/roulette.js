// 전역 변수
let customMenus = [];
let isSpinning = false;

// DOM 요소들
const rouletteWheel = document.getElementById('rouletteWheel');
const spinButton = document.getElementById('spinButton');
const customMenuInput = document.getElementById('customMenuInput');
const addMenuButton = document.getElementById('addMenuButton');
const customMenusContainer = document.getElementById('customMenus');
const clearCustomButton = document.getElementById('clearCustomButton');
const resultSection = document.getElementById('resultSection');
const resultMenu = document.getElementById('resultMenu');

// 초기화
document.addEventListener('DOMContentLoaded', function () {
    initializeRoulette();
    setupEventListeners();
    loadInitialMenus();
});

// 룰렛 초기화
async function initializeRoulette() {
    // 빈 상태로 시작
    await createRouletteWheel([]);
}

// 이벤트 리스너 설정
function setupEventListeners() {
    spinButton.addEventListener('click', spinRoulette);

    addMenuButton.addEventListener('click', addCustomMenu);
    customMenuInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            addCustomMenu();
        }
    });

    clearCustomButton.addEventListener('click', clearCustomMenus);

    // 필터 체크박스 이벤트
    document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateRouletteFromFilters);
    });
}

// 룰렛 휠 생성 (동일 섹터/가변 개수/텍스트 줄바꿈)
async function createRouletteWheel(menusFromUser = []) {
    // 바탕 초기화 (기존 segment div 전부 제거)
    rouletteWheel.innerHTML = '';

    // 기본 색상 팔레트
    const baseColors = ['#87ceeb', '#ffd700', '#9370db', '#98fb98', '#ffa500',
        '#ff6b6b', '#20b2aa', '#ff69b4', '#32cd32', '#ff4500'];

    // 색상 셔플 (Fisher–Yates)
    const colors = baseColors.slice();
    for (let i = colors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [colors[i], colors[j]] = [colors[j], colors[i]];
    }

    // 서버 메뉴 로드
    let serverMenus = [];
    try {
        const res = await fetch('/api/menus');
        if (res.ok) {
            const data = await res.json();
            serverMenus = (data.menus || []).map(m => (m && (m.name ?? m)) || '').filter(Boolean);
        }
    } catch (e) {
        console.error('서버 메뉴 로드 실패:', e);
    }

    // 사용자 + 서버 메뉴 합치고 중복 제거/공백 트림
    const allMenus = [...menusFromUser, ...serverMenus]
        .map(s => String(s).trim())
        .filter(Boolean);
    const uniqueMenus = [...new Set(allMenus)];

    // 이번 라운드에 사용할 섹터 수(최대 10개). 0개면 예비 10칸.
    const count = Math.min(10, uniqueMenus.length) || 10;

    // 메뉴 무작위 선택 (중복 없이)
    const pool = uniqueMenus.slice();
    for (let i = pool.length - 1; i > 0; i--) { // 셔플
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const selectedMenus = pool.slice(0, count);

    // conic-gradient로 동일 크기 섹터 칠하기 (퍼센트 사용 → 반올림오차 방지)
    const colorStops = Array.from({ length: count }, (_, i) => {
        const startPct = (i / count) * 100;
        const endPct = ((i + 1) / count) * 100;
        const color = colors[i % colors.length];
        return `${color} ${startPct}% ${endPct}%`;
    }).join(', ');
    rouletteWheel.style.background = `conic-gradient(${colorStops})`;

    // 라벨 배치
    const diameter = rouletteWheel.clientWidth || 360;   // width=height 가정
    const radius = diameter / 2;
    const labelRadius = radius * 0.68;                   // 섹터 중앙쯤
    const labelWidth = Math.max(80, Math.floor(radius * 0.9)); // 텍스트 박스 폭

    // 기존 라벨 제거
    rouletteWheel.querySelectorAll('.roulette-label,.segment-text').forEach(el => el.remove());

    for (let i = 0; i < count; i++) {
        const angle = (360 * (i + 0.5)) / count;           // 섹터 중앙 각도
        const label = document.createElement('div');
        label.className = 'roulette-label';                // 새 클래스(없으면 inline 스타일이 적용됨)
        label.textContent = selectedMenus[i] || '';
        Object.assign(label.style, {
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: `${labelWidth}px`,
            transformOrigin: 'center',
            transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${labelRadius}px) rotate(${-angle}deg)`,
            whiteSpace: 'normal',
            wordBreak: 'keep-all',
            overflowWrap: 'anywhere',
            lineHeight: '1.25',
            textAlign: 'center',
            fontWeight: '700',
            fontSize: '16px',
            color: '#333',
            textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
            pointerEvents: 'none',
            zIndex: '2'
        });
        rouletteWheel.appendChild(label);
    }

    // 외부에서 접근할 선택 결과
    window.currentRouletteMenus = selectedMenus;
}


// 룰렛 돌리기
async function spinRoulette() {
    if (isSpinning) return;

    isSpinning = true;
    spinButton.disabled = true;
    resultSection.style.display = 'none';

    // 랜덤한 회전 각도 생성 (3600도 + 랜덤 각도)
    const baseRotation = 3600; // 기본 10바퀴
    const randomRotation = Math.random() * 360; // 0-360도 랜덤
    const totalRotation = baseRotation + randomRotation;

    // CSS 변수로 랜덤 각도 설정
    rouletteWheel.style.setProperty('--spin-rotation', `${totalRotation}deg`);

    // 룰렛 애니메이션 시작
    rouletteWheel.classList.add('spinning');

    // 3초 후 결과 표시
    setTimeout(async () => {
        // 현재 룰렛에 표시된 메뉴들 중에서 선택
        const currentRouletteMenus = window.currentRouletteMenus || [];

        if (currentRouletteMenus.length > 0) {
            const winner = currentRouletteMenus[Math.floor(Math.random() * currentRouletteMenus.length)];
            showResult(winner);
        } else {
            // 메뉴가 없으면 빈 룰렛만 돌림
            console.log('빈 룰렛이 돌아갑니다.');
        }

        // 애니메이션 클래스 제거하고 최종 위치 유지
        rouletteWheel.classList.remove('spinning');
        rouletteWheel.style.transform = `rotate(${totalRotation}deg)`;

        isSpinning = false;
        spinButton.disabled = false;
    }, 3000);
}

// 현재 메뉴 목록 가져오기
function getCurrentMenus() {
    const menus = [];

    // 서버에서 가져온 메뉴들 (필터 적용)
    const serverMenus = getFilteredServerMenus();
    menus.push(...serverMenus);

    // 사용자가 추가한 메뉴들
    menus.push(...customMenus);

    return menus;
}

// 필터된 서버 메뉴 가져오기
function getFilteredServerMenus() {
    // 실제로는 서버 API를 호출해야 하지만, 여기서는 빈 배열 반환
    const selectedCategories = getSelectedCategories();
    const selectedMeals = getSelectedMeals();

    // 빈 배열 반환 (사용자가 직접 메뉴를 추가해야 함)
    return [];
}

// 선택된 카테고리 가져오기
function getSelectedCategories() {
    const categories = [];
    document.querySelectorAll('.filter-group:first-child input[type="checkbox"]:checked').forEach(checkbox => {
        categories.push(checkbox.value);
    });
    return categories;
}

// 선택된 식사시간 가져오기
function getSelectedMeals() {
    const meals = [];
    document.querySelectorAll('.filter-group:last-child input[type="checkbox"]:checked').forEach(checkbox => {
        meals.push(checkbox.value);
    });
    return meals;
}

// 랜덤 메뉴 선택
async function getRandomMenu(menus) {
    // 사용자 메뉴가 있으면 클라이언트에서 랜덤 선택
    if (customMenus.length > 0) {
        return menus[Math.floor(Math.random() * menus.length)];
    }

    // 서버 메뉴만 있으면 서버 API 호출
    try {
        const selectedCategories = getSelectedCategories();
        const selectedMeals = getSelectedMeals();

        const response = await fetch('/api/spin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                category: selectedCategories.length > 0 ? selectedCategories[0] : null,
                meal: selectedMeals.length > 0 ? selectedMeals[0] : null
            })
        });

        if (response.ok) {
            const data = await response.json();
            return data.winner.name;
        } else {
            // 서버 에러 시 클라이언트에서 랜덤 선택
            return menus[Math.floor(Math.random() * menus.length)];
        }
    } catch (error) {
        console.error('서버 API 호출 실패:', error);
        // 에러 시 클라이언트에서 랜덤 선택
        return menus[Math.floor(Math.random() * menus.length)];
    }
}

// 결과 표시
function showResult(menu) {
    resultMenu.textContent = menu;
    resultSection.style.display = 'block';

    // 결과 섹션을 화면 중앙에 스크롤
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// 사용자 메뉴 추가
function addCustomMenu() {
    const input = customMenuInput.value.trim();
    if (!input) return;

    // 쉼표로 구분된 메뉴들 분리
    const menus = input.split(',').map(menu => menu.trim()).filter(menu => menu);

    menus.forEach(menu => {
        if (menu && !customMenus.includes(menu)) {
            customMenus.push(menu);
        }
    });

    updateCustomMenusDisplay();
    updateRouletteFromCustomMenus();

    customMenuInput.value = '';
}

// 사용자 메뉴 표시 업데이트
function updateCustomMenusDisplay() {
    customMenusContainer.innerHTML = '';

    customMenus.forEach((menu, index) => {
        const menuItem = document.createElement('div');
        menuItem.className = 'custom-menu-item';
        menuItem.innerHTML = `
            <span>${menu}</span>
            <button class="remove-menu" onclick="removeCustomMenu(${index})">×</button>
        `;
        customMenusContainer.appendChild(menuItem);
    });
}

// 사용자 메뉴 제거
function removeCustomMenu(index) {
    customMenus.splice(index, 1);
    updateCustomMenusDisplay();
    updateRouletteFromCustomMenus();
}

// 사용자 메뉴 모두 지우기
function clearCustomMenus() {
    customMenus = [];
    updateCustomMenusDisplay();
    updateRouletteFromCustomMenus();
}

// 필터 변경 시 룰렛 업데이트
async function updateRouletteFromFilters() {
    await createRouletteWheel([]);
}

// 사용자 메뉴 변경 시 룰렛 업데이트
async function updateRouletteFromCustomMenus() {
    await createRouletteWheel([]);
}

// 초기 메뉴 로드 (서버에서)
async function loadInitialMenus() {
    try {
        const response = await fetch('/api/menus');
        if (response.ok) {
            const data = await response.json();
            // 서버에서 받은 메뉴들로 룰렛 업데이트 (필요시)
            console.log('서버에서 메뉴 로드됨:', data.count);
        }
    } catch (error) {
        console.error('초기 메뉴 로드 실패:', error);
    }
}


