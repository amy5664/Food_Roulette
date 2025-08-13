// /static/js/custom-menus.js
(function () {
  const LS_KEY = 'fr.customMenus';

  // ===== 로컬 스토리지 유틸 =====
  function saveCustomMenus() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(customMenus)); }
    catch (e) { console.warn('customMenus 저장 실패:', e); }
  }
  function loadCustomMenusFromLS() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  // ===== 칩 UI 렌더링 =====
  function renderCustomMenus() {
    if (!customMenusContainer) return;
    customMenusContainer.innerHTML = '';
    if (!Array.isArray(customMenus) || customMenus.length === 0) return;

    customMenus.forEach((name, idx) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = name;

      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '✕';
      del.setAttribute('aria-label', `${name} 삭제`);
      del.addEventListener('click', () => removeCustomMenu(idx));

      chip.appendChild(del);
      customMenusContainer.appendChild(chip);
    });
  }

  // ===== 개별 삭제 =====
  function removeCustomMenu(index) {
    if (index < 0 || index >= customMenus.length) return;
    const removed = customMenus.splice(index, 1)[0];
    saveCustomMenus();
    renderCustomMenus();

    // 룰렛에서도 제거
    const items = window.rouletteState?.items || [];
    const pos = items.indexOf(removed);
    if (pos !== -1) {
      items.splice(pos, 1);
      window.currentRouletteMenus = items.slice();
      redrawRoulette();
    }
  }

  // ===== 모두 지우기 =====
  function clearCustomMenus() {
    if (!customMenus.length) return;
    if (!confirm('직접 추가한 메뉴를 모두 삭제할까요?')) return;

    customMenus.length = 0;  // in-place 비우기
    saveCustomMenus();
    renderCustomMenus();

    // 서버 메뉴만으로 다시 세팅
    createRouletteWheel([]);
  }

  // ===== 추가 =====
  function addCustomMenu() {
    const text = String(customMenuInput?.value || '').trim();
    if (!text) return;

    // 대소문자/연속공백 무시한 중복 검사
    const norm = text.replace(/\s+/g, ' ').toLowerCase();
    const exists = customMenus.some(m => m.replace(/\s+/g, ' ').toLowerCase() === norm);
    if (exists) {
      alert('이미 추가한 메뉴입니다.');
      customMenuInput.value = '';
      return;
    }

    customMenus.push(text);
    saveCustomMenus();
    renderCustomMenus();

    // 룰렛에도 즉시 반영 (MAX_SECTORS 초과 시 FIFO는 addSector가 처리)
    addSector(text);

    customMenuInput.value = '';
    customMenuInput.focus();
  }

  // ===== 초기 로딩 =====
  async function loadInitialMenus() {
    customMenus = loadCustomMenusFromLS();
    renderCustomMenus();
    await createRouletteWheel(customMenus);  // 커스텀 + 서버 합쳐서 초기 0~10칸
  }

  // 전역에서 쓸 함수들 공개 (기존 코드가 이 이름들을 호출함)
  window.renderCustomMenus  = renderCustomMenus;
  window.removeCustomMenu   = removeCustomMenu;
  window.clearCustomMenus   = clearCustomMenus;
  window.addCustomMenu      = addCustomMenu;
  window.loadInitialMenus   = loadInitialMenus;
})();
