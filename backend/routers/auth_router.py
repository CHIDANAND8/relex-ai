from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from passlib.exc import UnknownHashError
import os
import requests
from pydantic import BaseModel

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

        # Broadcast user registration event to all listening admin dashboards
        try:
            from services.notification_service import notification_manager
            import asyncio
            loop = asyncio.get_event_loop()
            event_payload = {
                "type": "USER_SIGNUP",
                "message": f"New user registered: {user.username} ({user.role})",
                "data": {
                    "username": user.username,
                    "role": user.role
                }
            }
            if loop.is_running():
                loop.create_task(notification_manager.broadcast(event_payload))
            else:
                loop.run_until_complete(notification_manager.broadcast(event_payload))
        except Exception as ws_err:
            print("Failed to broadcast signup notification:", ws_err)

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


# =========================
# SOCIAL OAUTH CALLBACK
# =========================
class OAuthRequest(BaseModel):
    provider: str
    code: str
    redirectUri: str = "http://localhost:3000/oauth/callback"

@router.post("/oauth-callback")
def oauth_callback(data: OAuthRequest, db: Session = Depends(get_db)):
    provider = data.provider.lower()
    code = data.code
    
    email = None
    name = None
    
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    facebook_client_id = os.getenv("FACEBOOK_CLIENT_ID")
    facebook_client_secret = os.getenv("FACEBOOK_CLIENT_SECRET")
    
    # 🟢 Dev Mock/Simulation bypass
    is_mock = False
    if code.startswith("mock_"):
        is_mock = True
    elif provider == "google" and (not google_client_id or not google_client_secret or google_client_id == "YOUR_GOOGLE_CLIENT_ID" or google_client_secret == "YOUR_GOOGLE_CLIENT_SECRET"):
        is_mock = True
    elif provider == "facebook" and (not facebook_client_id or not facebook_client_secret or facebook_client_id == "YOUR_FACEBOOK_CLIENT_ID" or facebook_client_secret == "YOUR_FACEBOOK_CLIENT_SECRET"):
        is_mock = True
        
    if is_mock:
        email = f"{provider}_test_user@relex.ai"
        name = f"Mock {provider.capitalize()} User"
        
    if not is_mock:
        try:
            if provider == "google":
                # Exchange token
                tok_res = requests.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "code": code,
                        "client_id": google_client_id,
                        "client_secret": google_client_secret,
                        "redirect_uri": data.redirectUri,
                        "grant_type": "authorization_code"
                    },
                    timeout=10
                )
                tok_data = tok_res.json()
                
                if tok_res.status_code != 200 or "access_token" not in tok_data:
                    err_desc = tok_data.get("error_description") or tok_data.get("error") or "OAuth code verification failed"
                    print(f"[Google OAuth] Token exchange error: {err_desc} (Status: {tok_res.status_code})")
                    raise HTTPException(status_code=400, detail=f"Google OAuth Error: {err_desc}")
                
                access_token = tok_data.get("access_token")
                
                # Fetch profile
                prof_res = requests.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=10
                )
                prof_data = prof_res.json()
                
                if prof_res.status_code != 200 or "email" not in prof_data:
                    prof_err = prof_data.get("error", {}).get("message") if isinstance(prof_data.get("error"), dict) else "Could not fetch Google profile"
                    print(f"[Google OAuth] Userinfo error: {prof_err}")
                    raise HTTPException(status_code=400, detail=f"Google Profile Error: {prof_err}")
                
                email = prof_data.get("email")
                name = prof_data.get("name") or (email.split("@")[0] if email else "Google User")
                
            elif provider == "facebook":
                # Exchange token
                tok_res = requests.get(
                    "https://graph.facebook.com/v12.0/oauth/access_token",
                    params={
                        "client_id": facebook_client_id,
                        "client_secret": facebook_client_secret,
                        "redirect_uri": data.redirectUri,
                        "code": code
                    },
                    timeout=10
                )
                tok_data = tok_res.json()
                
                if tok_res.status_code != 200 or "access_token" not in tok_data:
                    err_desc = tok_data.get("error", {}).get("message") if isinstance(tok_data.get("error"), dict) else "Facebook OAuth exchange failed"
                    print(f"[Facebook OAuth] Token exchange error: {err_desc}")
                    raise HTTPException(status_code=400, detail=f"Facebook OAuth Error: {err_desc}")
                
                access_token = tok_data.get("access_token")
                
                # Fetch profile
                prof_res = requests.get(
                    "https://graph.facebook.com/me",
                    params={
                        "access_token": access_token,
                        "fields": "id,name,email"
                    },
                    timeout=10
                )
                prof_data = prof_res.json()
                email = prof_data.get("email") or f"fb_{prof_data.get('id')}@facebook.com"
                name = prof_data.get("name") or (email.split("@")[0] if email else "Facebook User")
            else:
                raise HTTPException(status_code=400, detail="Invalid provider")
                
        except HTTPException:
            raise
        except Exception as e:
            print(f"OAuth callback unexpected error: {e}")
            raise HTTPException(status_code=400, detail=f"Authentication request failed: {str(e)}")
            
    if not email:
        raise HTTPException(status_code=400, detail="Could not retrieve email from provider")

    # Find or auto-register user in DB
    user = db.query(User).filter(User.username == email).first()
    is_new_user = False
    if not user:
        user = User(
            username=email,
            password=hash_password(f"SocialOAuth_{email}_RandomEntropyKeySecurePwd"[:72]),
            role="user"
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
            is_new_user = True
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.username == email).first()

    if is_new_user and user:
        # Broadcast user registration event to admin dashboards
        try:
            from services.notification_service import notification_manager
            import asyncio
            loop = asyncio.get_event_loop()
            event_payload = {
                "type": "USER_SIGNUP",
                "message": f"New user signed up via {provider.capitalize()}: {user.username}",
                "data": {
                    "username": user.username,
                    "role": user.role
                }
            }
            if loop.is_running():
                loop.create_task(notification_manager.broadcast(event_payload))
            else:
                loop.run_until_complete(notification_manager.broadcast(event_payload))
        except Exception as ws_err:
            print("Failed to broadcast social signup notification:", ws_err)
        
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "name": name,
        "provider": provider
    }


