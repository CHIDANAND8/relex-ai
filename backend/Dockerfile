FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for pymupdf, Pillow etc.
RUN apt-get update && apt-get install -y \
    gcc \
    libffi-dev \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create uploads dir (ephemeral, but prevents startup errors)
RUN mkdir -p uploads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
