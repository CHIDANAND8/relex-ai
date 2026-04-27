from pydantic import BaseModel

from pydantic import BaseModel, field_validator
import re

class UserCreate(BaseModel):
    username: str
    password: str
    role: str

    @field_validator("password")
    def validate_password(cls, v):

        if len(v) < 8 or len(v) > 64:
            raise ValueError(
                "Password must be between 8 and 64 characters"
            )

        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain uppercase letter")

        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain lowercase letter")

        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain number")

        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain special character")

        return v


class LoginSchema(BaseModel):
    username: str
    password: str
