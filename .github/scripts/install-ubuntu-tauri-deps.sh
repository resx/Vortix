#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  build-essential \
  curl \
  file \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libssl-dev \
  libwebkit2gtk-4.1-dev \
  libxdo-dev \
  patchelf \
  pkg-config \
  wget
