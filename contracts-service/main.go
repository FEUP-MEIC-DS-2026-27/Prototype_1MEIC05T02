package main

import (
	"encoding/json"
	"net/http"
	"time"
)

type Contract struct {
	ResearcherID string    `json:"researcherId"`
	Name         string    `json:"name"`
	Type         string    `json:"type"`
	Start        time.Time `json:"start"`
	End          time.Time `json:"end"`
	Visible      bool      `json:"-"`
}

var data = []Contract{
	{"r1", "Ana Silva", "scholarship", date(2025, 1, 1), date(2026, 12, 31), true},
	{"r2", "Rui Costa", "contract", date(2024, 6, 1), date(2027, 5, 31), true},
	{"r3", "Marta Reis", "contract", date(2023, 3, 1), date(2026, 11, 30), false},
}

func date(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func main() {
	http.HandleFunc("/contracts", func(w http.ResponseWriter, r *http.Request) {
		out := []Contract{}
		for _, c := range data {
			if c.Visible {
				out = append(out, c)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	})
	http.ListenAndServe(":8081", nil)
}
