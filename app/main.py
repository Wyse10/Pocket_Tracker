from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .database import Base, engine, get_db

app = FastAPI(title="SmartSpend AI")

Base.metadata.create_all(bind=engine)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def root() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "add-transaction.html"))


@app.get("/add-transaction")
def add_transaction_page() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "add-transaction.html"))


@app.post("/add-transaction", response_model=schemas.TransactionRead)
def add_transaction(payload: schemas.TransactionCreate, db: Session = Depends(get_db)):
    return crud.create_transaction(db, payload)


@app.get("/transactions", response_model=list[schemas.TransactionRead])
def get_transactions(db: Session = Depends(get_db)):
    return crud.list_transactions(db)
