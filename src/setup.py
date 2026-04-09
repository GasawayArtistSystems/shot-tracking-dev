from setuptools import setup, find_packages

setup(
    name="uc_film_and_class_tracker",
    version="0.1",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "blinker==1.9.0",
        "click==8.1.7",
        "colorama==0.4.6",
        "Flask==3.1.0",
        "iniconfig==2.0.0",
        "itsdangerous==2.2.0",
        "Jinja2==3.1.4",
        "MarkupSafe==3.0.2",
        "packaging==24.2",
        "pluggy==1.5.0",
        "pytest==8.3.4",
        "pytest-flask==1.3.0",
        "Werkzeug==3.1.3"
    ],
    entry_points={
        "console_scripts": [
            "run-app=app:main",  # Adjust if `app.py` has main()
        ],
    },
)




