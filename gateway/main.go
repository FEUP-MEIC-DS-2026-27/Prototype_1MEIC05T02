package main

import (
	"encoding/json"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var secret = []byte(getenv("JWT_SECRET", "dev-secret-change-me"))

type user struct{ Password, Role string }

var users = map[string]user{
	"manager":    {"manager123", "manager"},
	"researcher": {"researcher123", "researcher"},
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if r.Method != http.MethodPost || json.NewDecoder(r.Body).Decode(&in) != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	u, ok := users[in.Username]
	if !ok || u.Password != in.Password {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  in.Username,
		"role": u.Role,
		"exp":  time.Now().Add(time.Hour).Unix(),
	})

	signed, _ := tok.SignedString(secret)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": signed, "role": u.Role})
}

func requireRole(role string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		tok, err := jwt.Parse(raw, func(*jwt.Token) (any, error) { return secret, nil },
			jwt.WithValidMethods([]string{"HS256"}))
		if err != nil || !tok.Valid {
			http.Error(w, "unauthorized", http.StatusUnauthorized) // not logged in
			return
		}
		if tok.Claims.(jwt.MapClaims)["role"] != role {
			http.Error(w, "forbidden", http.StatusForbidden) // logged in, wrong role
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	target, _ := url.Parse(os.Getenv("CONTRACTS_URL"))
	proxy := httputil.NewSingleHostReverseProxy(target)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/login", login)
	mux.Handle("/api/contracts", requireRole("manager", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			r.URL.Path = "/contracts"
			proxy.ServeHTTP(w, r)
		})))

	http.ListenAndServe(":8080", withCORS(mux))
}

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			return
		}
		h.ServeHTTP(w, r)
	})
}
