package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

// Contract holds the contract/scholarship information of one researcher.
// All data below is MOCK data for the prototype.
type Contract struct {
	ResearcherID string    `json:"researcherId"`
	Name         string    `json:"name"`
	Position     string    `json:"position"`
	Type         string    `json:"type"` // "contract" | "scholarship"
	Group        string    `json:"group"`
	Funding      string    `json:"funding"`
	Supervisor   string    `json:"supervisor"`
	Renewable    bool      `json:"renewable"`
	Start        time.Time `json:"start"`
	End          time.Time `json:"end"`
	Visible      bool      `json:"-"` // permission flag: never leaves this service when false
}

func date(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

var data = []Contract{
	{"r01", "Ana Silva", "PhD Fellow", "scholarship", "Human-AI Interaction", "FCT", "Prof. Carvalho", true, date(2025, 1, 1), date(2026, 12, 31), true},
	{"r02", "Rui Costa", "Senior Researcher", "contract", "Software Engineering", "Horizon Europe", "Prof. Mendes", true, date(2024, 6, 1), date(2027, 5, 31), true},
	{"r03", "Marta Reis", "Junior Researcher", "contract", "Data & Analytics", "Internal", "Prof. Alves", false, date(2023, 3, 1), date(2026, 11, 30), false},
	{"r04", "João Pereira", "Research Fellow", "scholarship", "Process Mining", "PRR", "Prof. Mendes", true, date(2025, 9, 1), date(2026, 11, 20), true},
	{"r05", "Inês Marques", "PhD Fellow", "scholarship", "Software Engineering", "FCT", "Prof. Carvalho", false, date(2023, 10, 1), date(2027, 9, 30), true},
	{"r06", "Tiago Fernandes", "Junior Researcher", "contract", "Human-AI Interaction", "Horizon Europe", "Prof. Carvalho", true, date(2025, 2, 1), date(2027, 1, 31), true},
	{"r07", "Beatriz Lopes", "Research Assistant", "scholarship", "Data & Analytics", "Internal", "Prof. Alves", true, date(2026, 3, 1), date(2026, 12, 15), true},
	{"r08", "Pedro Gomes", "Senior Researcher", "contract", "Process Mining", "PRR", "Prof. Mendes", false, date(2022, 7, 1), date(2028, 6, 30), true},
	{"r09", "Sofia Ramos", "Research Fellow", "scholarship", "Human-AI Interaction", "FCT", "Prof. Santos", true, date(2025, 4, 1), date(2026, 10, 15), true},
	{"r10", "Miguel Teixeira", "Junior Researcher", "contract", "Software Engineering", "Internal", "Prof. Santos", true, date(2024, 1, 15), date(2027, 1, 14), true},
	{"r11", "Catarina Nunes", "PhD Fellow", "scholarship", "Data & Analytics", "FCT", "Prof. Alves", false, date(2024, 10, 1), date(2028, 9, 30), true},
	{"r12", "André Martins", "Research Assistant", "scholarship", "Software Engineering", "PRR", "Prof. Mendes", false, date(2026, 6, 1), date(2027, 2, 28), true},
	{"r13", "Leonor Dias", "Senior Researcher", "contract", "Human-AI Interaction", "Horizon Europe", "Prof. Santos", true, date(2023, 9, 1), date(2027, 8, 31), true},
	{"r14", "Hugo Barbosa", "Research Fellow", "scholarship", "Process Mining", "Horizon Europe", "Prof. Mendes", true, date(2025, 12, 1), date(2027, 3, 31), true},
	{"r15", "Mariana Cunha", "Junior Researcher", "contract", "Data & Analytics", "FCT", "Prof. Alves", true, date(2024, 5, 1), date(2027, 4, 30), true},
	{"r16", "Diogo Ferreira", "PhD Fellow", "scholarship", "Human-AI Interaction", "Internal", "Prof. Carvalho", true, date(2026, 1, 10), date(2026, 12, 9), true},
	{"r17", "Rita Moreira", "Senior Researcher", "contract", "Software Engineering", "Internal", "Prof. Santos", false, date(2021, 2, 1), date(2029, 1, 31), true},
	{"r18", "Bruno Azevedo", "Junior Researcher", "contract", "Process Mining", "PRR", "Prof. Mendes", true, date(2025, 3, 1), date(2027, 2, 28), false},
}

func main() {
	http.HandleFunc("/contracts", func(w http.ResponseWriter, r *http.Request) {
		out := []Contract{}
		for _, c := range data {
			if c.Visible { // "where available and permitted"
				out = append(out, c)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	})
	log.Println("contracts-service listening on :8081")
	log.Fatal(http.ListenAndServe(":8081", nil))
}
