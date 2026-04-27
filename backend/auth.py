from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"])

def hash_password(password: str):
    # bcrypt supports only first 72 bytes
    password = password[:72]
    return pwd_context.hash(password)


def verify_password(plain, hashed):
    plain = plain[:72]
    return pwd_context.verify(plain, hashed)
