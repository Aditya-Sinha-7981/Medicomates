from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import adherence, auth, connections, dashboard, medicines, notes, ocr
from config import settings

app = FastAPI(title="MedAdhere API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api")
app.include_router(medicines.router, prefix="/api")
app.include_router(adherence.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(connections.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(ocr.router, prefix="/api")
