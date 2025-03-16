docker buildx build \
                  --platform linux/arm64/v8 \
                  --push \
                  -t ghcr.io/core447/blockchain-demo:latest .