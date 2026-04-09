::[Bat To Exe Converter]
::
::YAwzoRdxOk+EWAjk
::fBw5plQjdCuDJH2B4kc8JwtZSQqWAHiyCaFR/Pr67OGOrEpQUOcpRJvJ27eFJfJd40brFQ==
::YAwzuBVtJxjWCl3EqQJgSA==
::ZR4luwNxJguZRRnk
::Yhs/ulQjdF+5
::cxAkpRVqdFKZSDk=
::cBs/ulQjdF+5
::ZR41oxFsdFKZSDk=
::eBoioBt6dFKZSDk=
::cRo6pxp7LAbNWATEpCI=
::egkzugNsPRvcWATEpCI=
::dAsiuh18IRvcCxnZtBJQ
::cRYluBh/LU+EWAnk
::YxY4rhs+aU+IeA==
::cxY6rQJ7JhzQF1fEqQJhZkk0
::ZQ05rAF9IBncCkqN+0xwdVs0
::ZQ05rAF9IAHYFVzEqQIDIBRADDCQPWixA6d8
::eg0/rx1wNQPfEVWB+kM9LVsJDGQ=
::fBEirQZwNQPfEVWB+kM9LVsJDGQ=
::cRolqwZ3JBvQF1fEqQJQ
::dhA7uBVwLU+EWH6F508xJltzXguXLCf6Kpk/iA==
::YQ03rBFzNR3SWATElA==
::dhAmsQZ3MwfNWATEphJifXs=
::ZQ0/vhVqMQ3MEVWAtB9wSA==
::Zg8zqx1/OA3MEVWAtB9wSA==
::dhA7pRFwIByZRRnk
::Zh4grVQjdCuDJH2B4kc8JwtZSQqWAHiyCaFR/Pr67OGOrEpQUOcpRLzT1aC6MuEQ4UD2O5M10xo=
::YB416Ek+ZG8=
::
::
::978f952a14a936cc963da21a135fa983
@echo off
echo ====================================
echo ≡ Starting Flask App (Production) ≡
echo ====================================
set PYTHONPATH=%CD%\src
python -m waitress --listen=*:5000 app:app
pause
