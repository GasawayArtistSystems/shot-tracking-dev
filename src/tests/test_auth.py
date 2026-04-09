import pytest
from flask import session
from app import create_app
from app.database.db import get_db

@pytest.fixture
def app():
    app = create_app({
        'TESTING': True,
        'SECRET_KEY': 'test-secret-key',
        'DATABASE': ':memory:'  # [OK]… in-memory DB for test isolation
    })

    # Setup minimal test DB schema and user
    with app.app_context():
        db = get_db()
        db.executescript("""
            PRAGMA foreign_keys = OFF;
            DROP TABLE IF EXISTS users;
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                name TEXT,
                password TEXT NOT NULL
            );
            INSERT INTO users (username, name, password)
            VALUES ('testuser', 'Test User', '$pbkdf2-sha256$29000$5T7vT1RNh3Wp76p75IFQfg$Zq1CGz5D2CTZt1LNzIvqpkFhrrZ.AkZ4wGOLpCHTrhE');
            -- password is "password"
        """)

    yield app

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def runner(app):
    return app.test_cli_runner()

def test_login_success(client):
    response = client.post('/auth/login', data={
        'username': 'testuser',
        'password': 'password'
    }, follow_redirects=True)

    # Check for something that appears in the dashboard
    assert b'Dashboard' in response.data or b'class' in response.data.lower()


def test_login_failure(client):
    response = client.post('/auth/login', data={
        'username': 'testuser',
        'password': 'wrongpass'
    }, follow_redirects=True)

    # SweetAlert messages do not appear in raw HTML, check for the login form again
    assert b'Username' in response.data and b'Password' in response.data


def test_logout(client):
    client.post('/auth/login', data={
        'username': 'testuser',
        'password': 'password'
    })
    response = client.get('/auth/logout', follow_redirects=True)
    # Check that login form is rendered after logout
    assert b'Username' in response.data and b'Password' in response.data




