FROM python:3.12
ENV PYTHONUNBUFFERED=1

# Install system dependencies: Java (for PySpark) + Node.js (for Vite build)
RUN apt-get update && apt-get install -y --no-install-recommends \
        openjdk-21-jre-headless \
        curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/lib/jvm/java-21-openjdk-$(dpkg --print-architecture) /usr/lib/jvm/java-21

ENV JAVA_HOME=/usr/lib/jvm/java-21
ENV PYSPARK_PYTHON=python3
ENV PYSPARK_DRIVER_PYTHON=python3

WORKDIR /usr/src/app

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Node dependencies and build the React frontend
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install

COPY . .

# Compile React/Vite assets into ./static, then collect all static files.
# Dummy env vars satisfy the production-mode guards in settings.py so that
# collectstatic can run without a live database, Redis, or OpenAI key.
RUN npm run build \
    && DJANGO_SECRET_KEY=build-placeholder \
       DJANGO_ALLOWED_HOSTS=localhost \
       DATABASE_URL=sqlite:///tmp/build.db \
       REDIS_URL=redis://localhost:6379 \
       OPENAI_API_KEY=build-placeholder \
       python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "processing_platform.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "2", \
     "--timeout", "120"]
