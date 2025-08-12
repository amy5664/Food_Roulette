from __future__ import annotations
import csv, random
from typing import List, Dict, Optional

# 영어/기타 식사시간 표기를 한글 표기로 통일하기 위한 매핑
MEAL_MAP = {
    "breakfast": "아침",
    "lunch": "점심",
    "dinner": "저녁",
    "조식": "아침",
    "중식": "점심",
    "석식": "저녁",
}

def _normalize_meals(meals: list[str]) -> list[str]:
    """CSV에서 읽은 식사시간 리스트를 한글(아침/점심/저녁)로 통일"""
    out = []
    for v in meals:
        key = (v or "").strip()
        key_low = key.lower()
        out.append(MEAL_MAP.get(key_low, key))  # 매핑되면 한글로, 아니면 원문 유지
    return out

def _normalize_meal_input(meal: str | None) -> str | None:
    """요청에서 들어온 meal 파라미터도 같은 규칙으로 통일"""
    if meal is None:
        return None
    key = meal.strip()
    key_low = key.lower()
    return MEAL_MAP.get(key_low, key)


# -------------------------------------------------
# CSV 로드, 필터링, 룰렛(동일 확률) 선택 기능
# -------------------------------------------------

def _split_list(val: Optional[str]) -> List[str]:
    """
    문자열을 쉼표(,) 또는 슬래시(/)로 구분해서 리스트로 변환
    - None 또는 빈 문자열이면 빈 리스트 반환
    - 예: "아침,점심" → ["아침", "점심"]
    """
    if not val:
        return []
    return [p.strip() for p in val.replace("/", ",").split(",") if p.strip()]



# CSV 파일 읽어서 메뉴 데이터 리스트로 반환
def load_data(path: str) -> List[Dict]:
    data : List[Dict] = []
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            id_str = row.get("id") or row.get("ID") or row.get("번호")
            name = row.get("name") or row.get("메뉴") or row.get("이름") or ""
            category = row.get("category") or row.get("카테고리") or None
            meals = row.get("meal_times") or row.get("식사시간") or ""

            item = {
                "id": int(id_str) if (id_str not in (None, "")) else None,
                "name": name.strip(),
                "category": (category or "").strip() or None,
                "meal_times": _normalize_meals(_split_list(meals)),
            }
            data.append(item)
    return data

def filter_items(
    data: List[Dict],
    *,
    category: Optional[str] = None,   # 예: "한식"
    meal: Optional[str] = None        # 예: "아침"
) -> List[Dict]:
    """
    카테고리와 식사시간 조건에 맞는 메뉴만 걸러서 반환
    - category, meal 둘 중 하나만 줘도 필터링 가능
    """
    res = data
    if category:
        c = category.strip()
        res = [x for x in res if (x["category"] or "") == c]
    if meal:
        m = _normalize_meal_input(meal)
        res = [x for x in res if any(m == t.strip() for t in x.get("meal_times", []))]
    return res

def spin_uniform(items: List[Dict]) -> Dict:
    """
    후보 리스트에서 동일 확률로 1개 랜덤 선택
    - 후보가 비어있으면 에러 발생
    """
    if not items:
        raise ValueError("no candidates")
    return random.choice(items)

def spin(
    data: List[Dict],
    *,
    category: Optional[str] = None,
    meal: Optional[str] = None,
) -> Dict:
    """
    카테고리/식사시간으로 필터링 후, 동일 확률 룰렛 실행
    - data: 전체 메뉴 데이터
    - category: 카테고리 필터(없으면 전체)
    - meal: 식사시간 필터(없으면 전체)
    """
    items = filter_items(data, category=category, meal=meal)
    if not items:
        raise ValueError("조건에 맞는 후보가 없습니다.")
    return spin_uniform(items)
            
    