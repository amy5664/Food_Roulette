# app.py
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from routers import menus as menus_router
from services.roulette import load_data

app = FastAPI(title="Menu Roulette API")

# 정적 파일 마운트
app.mount("/static", StaticFiles(directory="static"), name="static")

# 템플릿 설정
templates = Jinja2Templates(directory="templates")

# CSV 경로: 네 파일명에 맞게 조정해도 됨 (예: menus_cleaned_300_no_area_price.csv)
CSV_PATH = "data/menus_300.csv"

# 앱 시작할 때 CSV 로드하고 라우터에 주입
menus_router.DATA = load_data(CSV_PATH)

# /api 접두사로 라우터 연결
app.include_router(menus_router.router, prefix="/api", tags=["menus"])

@app.get("/", response_class=HTMLResponse)
def root(request: Request):
    """메인 페이지 - 룰렛 UI"""
    return templates.TemplateResponse("roulette.html", {"request": request})

@app.get("/api/health")
def health_check():
    """API 상태 확인"""
    return {"ok": True, "message": "Menu Roulette API running"}
