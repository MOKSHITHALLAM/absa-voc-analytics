from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..security import create_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def user_out(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role}


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == body.email.lower())):
        raise HTTPException(409, "An account with this email already exists.")
    u = User(name=body.name.strip(), email=body.email.lower(), password_hash=hash_password(body.password))
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"access_token": create_token(u), "user": user_out(u)}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.email == body.email.lower()))
    if u is None or not verify_password(body.password, u.password_hash):
        raise HTTPException(401, "Email or password is incorrect.")
    return {"access_token": create_token(u), "user": user_out(u)}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_out(user)
