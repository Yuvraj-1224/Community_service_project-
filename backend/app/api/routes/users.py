from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.database.session import get_db
from app.models import User
from app.schemas import ChangePassword, ProfileUpdate, UserOut
from app.utils.errors import AppError
from app.utils.responses import ok

router = APIRouter(prefix="/users", tags=["User"])


@router.get("/profile")
def get_profile(user: User = Depends(get_current_user)):
    return ok(UserOut.model_validate(user).model_dump(mode="json"))


@router.put("/profile")
def update_profile(payload: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    for field, value in payload.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return ok(UserOut.model_validate(user).model_dump(mode="json"), "Profile updated")


@router.put("/change-password")
def change_password(payload: ChangePassword, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_password(payload.current_password, user.password_hash):
        raise AppError(400, "Current password is incorrect", "wrong_password")
    if verify_password(payload.new_password, user.password_hash):
        raise AppError(400, "New password must be different from the current password", "same_password")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return ok(None, "Password changed successfully")
