# MedAdhere Mock Server
# Full code is in TEAM.md — paste it below this comment block.
#
# Run with:
#   pip install fastapi uvicorn
#   uvicorn mock_api.mock_server:app --reload --port 8001
#
# Frontend .env must have: VITE_API_URL=http://localhost:8001

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/")
def root():
    return {"status": "paste full mock server code from TEAM.md"}
