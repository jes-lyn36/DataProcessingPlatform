FROM python:3.12
ENV PYTHONBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-21-jre-headless \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/lib/jvm/java-21-openjdk-$(dpkg --print-architecture) /usr/lib/jvm/java-21
ENV JAVA_HOME=/usr/lib/jvm/java-21
ENV PYSPARK_PYTHON=python3
ENV PYSPARK_DRIVER_PYTHON=python3
WORKDIR /usr/src/app
COPY requirements.txt ./
RUN pip install -r requirements.txt
