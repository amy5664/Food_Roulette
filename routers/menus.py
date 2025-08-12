# routers/menus.py
from fastapi import APIRouter, Query, Body, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from services.roulette import filter_items, spin

router = APIRouter()

# 앱 시작 시 app.py에서 주입할 전역 데이터(메모리 캐시)
DATA: List[Dict] = []

class SpinRequest(BaseModel):
    """룰렛 돌릴 때 받을 요청 바디(카테고리/식사시간만 사용)"""
    category: Optional[str] = None   # 예: "한식"
    meal: Optional[str] = None       # 예: "점심"

@router.get("/menus")
def list_menus(
    category: Optional[str] = Query(None, description="예: 한식"),
    meal: Optional[str] = Query(None, description="예: 아침/점심/저녁"),
):
    """
    조건(카테고리/식사시간)으로 메뉴 목록 조회
    - 아무 쿼리도 없으면 전체 반환
    """
    items = filter_items(DATA, category=category, meal=meal)
    return {"count": len(items), "items": items}

@router.post("/spin")
def spin_once(payload: SpinRequest = Body(...)):
    """
    조건(카테고리/식사시간)에 맞는 후보 중 1개를 랜덤 선택
    """
    try:
        winner = spin(DATA, category=payload.category, meal=payload.meal)
        return {"winner": winner}
    except ValueError:
        # 후보가 하나도 없을 때
        raise HTTPException(status_code=404, detail="조건에 맞는 후보가 없습니다.")
