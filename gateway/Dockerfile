FROM golang:1.26 AS build
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o server .

FROM alpine:3.20
COPY --from=build /app/server /server
CMD ["/server"]