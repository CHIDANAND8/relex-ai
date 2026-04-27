from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from passlib.exc import UnknownHashError

from database import SessionLocal
from models import User
from schemas import LoginSchema
from auth import hash_password, verify_password

router = APIRouter(prefix="/auth")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# SIGNUP
# =========================
@router.post("/signup")
def signup(data: dict, db: Session = Depends(get_db)):

    user = User(
        username=data["username"],
        password=hash_password(data["password"]),
        role=data["role"]
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )

    return {"message": "Signup successful"}


# =========================
# LOGIN
# =========================
@router.post("/login")
def login(data: LoginSchema, db: Session = Depends(get_db)):

    user = db.query(User).filter(
        User.username == data.username
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    try:
        valid = verify_password(
            data.password,
            user.password
        )
    except UnknownHashError:
        valid = False

    if not valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    return {
        "id": user.id,
        "username": user.username,
        "role": user.role
}

