# syntax=docker/dockerfile:1

FROM golang:1.25.7 AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/api /app/api
# Baked default config; runtime values are overridden via environment variables.
COPY config.yaml.example /app/config.yaml
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/api"]
