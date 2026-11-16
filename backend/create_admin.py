"""Secure admin account creation (admins can NOT self-register through the public API).

Run on the server, from the backend/ folder:
    python create_admin.py --email admin@agrovision.in --name "Admin" --mobile 9999999999

The password is prompted for interactively (never passed on the command line / never logged).
To promote an existing farmer account instead:  python create_admin.py --email user@x.com --promote
"""
import argparse
import re
import getpass
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.database.init_db import init_db
from app.database.session import SessionLocal
from app.models import User
from app.schemas import _check_password_strength


def main() -> int:
    ap = argparse.ArgumentParser(description="Create or promote an AgroVision AI admin")
    ap.add_argument("--email", required=True)
    ap.add_argument("--name", default="Administrator")
    ap.add_argument("--mobile", default=None)
    ap.add_argument("--promote", action="store_true", help="Promote an existing user to admin")
    args = ap.parse_args()

    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", args.email):
        print("Invalid email address.")
        return 1
    init_db()
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == args.email.lower()))
        if args.promote:
            if not user:
                print("No user with that email.")
                return 1
            user.role = "admin"
            db.commit()
            print(f"User {user.email} promoted to admin.")
            return 0
        if user:
            print("A user with this email already exists. Use --promote to make them admin.")
            return 1
        pw = getpass.getpass("Admin password: ")
        if pw != getpass.getpass("Confirm password: "):
            print("Passwords do not match.")
            return 1
        try:
            _check_password_strength(pw)
        except ValueError as e:
            print(e)
            return 1
        db.add(User(full_name=args.name, email=args.email.lower(), mobile=args.mobile,
                    password_hash=hash_password(pw), role="admin"))
        db.commit()
        print(f"Admin {args.email} created.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
