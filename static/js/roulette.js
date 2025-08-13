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

// ===== 전역 상태 =====
const MAX_SECTORS = 10;
const baseColors = ['#87ceeb', '#ffd700', '#9370db', '#98fb98', '#ffa500',
    '#ff6b6b', '#20b2aa', '#ff69b4', '#32cd32', '#ff4500'];
const colors = baseColors.slice();
// Fisher–Yates shuffle (색상 랜덤)
for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
}


// 상태 컨테이너
window.rouletteState = {
    items: [],             // 현재 섹터에 들어간 텍스트 목록
    colors,                // 셔플된 색상들
};

// ===== 공용: 다시 그리기 =====
function redrawRoulette() {
    const items = window.rouletteState.items;
    const count = Math.max(items.length, 1); // 최소 1로 처리
    // 배경 conic-gradient
    const colorStops = Array.from({ length: count }, (_, i) => {
        const startPct = (i / count) * 100;
        const endPct = ((i + 1) / count) * 100;
        const color = window.rouletteState.colors[i % window.rouletteState.colors.length];
        return `${color} ${startPct}% ${endPct}%`;
    }).join(', ');
    rouletteWheel.style.background = `conic-gradient(${colorStops})`;

    rouletteWheel.querySelectorAll('.roulette-label, .label-anchor').forEach(el => el.remove());

    const diameter = rouletteWheel.clientWidth || 360;
    const radius = diameter / 2;
    const labelRadius = radius * 0.68;

    // 부모는 relative 보장
    if (getComputedStyle(rouletteWheel).position === 'static') {
        rouletteWheel.style.position = 'relative';
    }

    for (let i = 0; i < count; i++) {
        const angleDeg = (360 * (i + 0.5)) / count;   // 섹터 중앙 각도
        const halfRad = Math.PI / count;             // 섹터 반각(라디안)
        // 현(Chord) 길이 = 라벨이 들어갈 수 있는 최대 가로폭
        const chord = 2 * labelRadius * Math.sin(halfRad);
        const maxLabelWidth = Math.max(60, Math.floor(chord * 0.9));

        // 1) 앵커: 중심에서 '해당 각도'로 회전 후 위쪽(-Y)으로 labelRadius만큼 이동
        const anchor = document.createElement('div');
        anchor.className = 'label-anchor';
        Object.assign(anchor.style, {
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 0,
            height: 0,
            transformOrigin: 'center',
            transform: `translate(-50%, -50%) rotate(${angleDeg}deg) translate(0, -${labelRadius}px)`,
            pointerEvents: 'none',
            zIndex: 2,
        });

        // 2) 실제 글자: 역회전으로 수평 유지 + 중앙선 기준으로 정확히 가운데
        const label = document.createElement('div');
        label.className = 'roulette-label';
        label.textContent = String(items[i] ?? '');
        Object.assign(label.style, {
            position: 'relative',
            maxWidth: `${maxLabelWidth}px`,
            transformOrigin: 'center',
            transform: `rotate(${-angleDeg}deg) translateX(-50%)`,
            left: '50%',                 // 중앙선에서 좌우 정렬 기준점 생성
            textAlign: 'center',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            wordBreak: 'keep-all',
            lineHeight: '1.25',
            fontWeight: '700',
            fontSize: '16px',
            color: '#333',
            textShadow: '1px 1px 2px rgba(255,255,255,0.85)',
            pointerEvents: 'none',
        });

        anchor.appendChild(label);
        rouletteWheel.appendChild(anchor);
    }

}

// ===== 전체 초기화(모두 지우기) =====
function resetRoulette() {
    window.rouletteState.items = [];
    redrawRoulette();
    window.currentRouletteMenus = [];
}

// ===== 섹터 하나 추가 (중복 방지, 초과 시 FIFO 제거) =====
function addSector(name) {
    const text = String(name ?? '').trim();
    if (!text) return;

    const items = window.rouletteState.items;

    // 이미 있으면 패스(원하면 허용하도록 조건 제거)
    if (items.includes(text)) return;

    // 초과 시 앞(가장 오래된) 제거해서 고정 크기 유지
    if (items.length >= MAX_SECTORS) items.shift();

    items.push(text);
    redrawRoulette();

    // 동기화
    window.currentRouletteMenus = items.slice();
}

// ===== 초기화(서버/사용자 메뉴로 채우고 시작할 때 0~N개 세팅) =====
async function createRouletteWheel(menusFromUser = []) {
    // 바탕 초기화
    rouletteWheel.innerHTML = '';
    window.rouletteState.items = []; // 초기화

    // 필요하면 서버 메뉴로 시드 채우기
    let serverMenus = [];
    try {
        const res = await fetch('/api/menus');
        if (res.ok) {
            const data = await res.json();
            serverMenus = (data.menus || [])
                .map(m => (m && (m.name ?? m)) || '')
                .filter(Boolean);
        }
    } catch (e) {
        console.error('서버 메뉴 로드 실패:', e);
    }

    // 유저 + 서버 합치고 중복 제거
    const allMenus = [...menusFromUser, ...serverMenus]
        .map(s => String(s).trim())
        .filter(Boolean);
    const uniqueMenus = [...new Set(allMenus)];

    // 초기 배치(원하면 0개 시작도 가능)
    // 여기서는 '최대 10개'까지 채워 시작 — 필요없으면 이 루프 지워도 됨
    for (const name of uniqueMenus.slice(0, MAX_SECTORS)) {
        window.rouletteState.items.push(name);
    }
    redrawRoulette();

    // 외부에서 접근할 수 있게
    window.currentRouletteMenus = window.rouletteState.items.slice();
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

function getCheckedValues(containerId) {
    return [...document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`)]
        .map(el => el.value);
}

// (옵션) 스핀 결과 처리 — 그대로
function onSpinResult(result) {
    console.log('메뉴 랜덤 출력 결과:', result);
    const name = result?.name ?? result?.menu ?? result;
    if (!name) return;
    addSector(name); // ✅ 결과가 들어올 때마다 섹터 1개 추가
    // 선택적으로 알림
    // alert(`랜덤 메뉴: ${name}`);
}

document.getElementById('filterButton').addEventListener('click', async () => {
    const selectedCategories = getCheckedValues('categoryFilters');
    const selectedMeals = getCheckedValues('mealFilters');

    const payload = {
        category: selectedCategories[0] ?? null, // 첫 번째 선택 또는 null
        meal: selectedMeals[0] ?? null
    };


    console.log('payload:', payload);

    try {
        // ✅ 3) POST /api/spin (배열 전송)
        const res = await fetch('/api/spin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // 4) 응답 처리
        const data = await res.json();
        const result = data.result ?? data.item ?? data.winner ?? data;
        onSpinResult(result);
    } catch (err) {
        console.error(err);
        alert('스핀 요청에 실패했습니다. 잠시 후 다시 시도하세요.');
    }
});
