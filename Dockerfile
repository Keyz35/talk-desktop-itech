# Image de compilation de Talk Desktop pour Windows depuis Linux :
# Node 24 (exigé par Talk Desktop), Wine (icône et métadonnées de l'exécutable,
# installateur Squirrel) et Mono (outil NuGet de Squirrel).
FROM node:24-bookworm
RUN dpkg --add-architecture i386 \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      wine wine32 wine64 mono-devel ca-certificates git \
 && rm -rf /var/lib/apt/lists/*
ENV WINEDEBUG=-all WINEPREFIX=/root/.wine
RUN wineboot --init >/dev/null 2>&1 || true
WORKDIR /src
