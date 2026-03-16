"""
Crear usuario en auth.users. Ejecutar DENTRO del contenedor (usa host "db"):
  docker-compose exec api python scripts/create_user.py
"""
import os
import sys

# Añadir raíz del proyecto al path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from passlib.context import CryptContext
from app.db.session import SessionLocal
from app.db.models import AuthUser
import uuid

EMAIL = os.environ.get("AUTH_USER_EMAIL", "gabriel@laneta.com")
PASSWORD = os.environ.get("AUTH_USER_PASSWORD", "0CLeOAHY0MXb")

bcrypt = CryptContext(schemes=["bcrypt"], deprecated="auto")
db = SessionLocal()
try:
    existing = db.query(AuthUser).filter(AuthUser.email == EMAIL).first()
    if existing:
        print(f"Ya existe un usuario con email {EMAIL}. No se creó otro.")
    else:
        user = AuthUser(
            id=uuid.uuid4(),
            email=EMAIL,
            encrypted_password=bcrypt.hash(PASSWORD),
        )
        db.add(user)
        db.commit()
        print(f"Usuario creado: {EMAIL}. Ya puedes hacer login.")
finally:
    db.close()
