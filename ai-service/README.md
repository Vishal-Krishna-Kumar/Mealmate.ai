# MealMate AI Service

Python + FastAPI microservice for recipe recommendations, ingredient matching, and nutrition scoring.

## Setup

```powershell
cd ai-service
py -m venv venv
.\venv\Scripts\Activate.ps1     # Windows PowerShell
# source venv/bin/activate      # macOS/Linux
pip install -r requirements-dev.txt
copy .env.example .env
```

## Run

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open:
- http://localhost:8000/health
- http://localhost:8000/docs   (interactive Swagger UI)

## Test

```powershell
pytest               # run tests
pytest --cov=app     # with coverage
ruff check .         # lint
black .              # format
mypy app             # type check
```

## Stack

- FastAPI 0.115 + Uvicorn
- Pydantic v2 + pydantic-settings
- scikit-learn, pandas, numpy, NLTK
- structlog (JSON logs in prod, console in dev)
- pytest + httpx for API tests
- ruff + black + mypy for quality
