FROM golang:1.23 AS builder
WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o scanner .

FROM alpine:3.20
RUN adduser -D appuser
WORKDIR /app
COPY --from=builder --chown=appuser:appuser /app/scanner .

USER appuser

ENTRYPOINT ["./scanner"]