package patterns

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetAtlas_Unauthorized(t *testing.T) {
	h := NewHandler(nil)
	r := httptest.NewRequest(http.MethodGet, "/patterns/atlas", nil)
	w := httptest.NewRecorder()

	h.GetAtlas(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestGetAtlas_ResponseShape(t *testing.T) {
	h := NewHandler(fakeRepository{atlas: AtlasResponse{
		TaxonomyVersion: TaxonomyVersion,
		Tools:           []AtlasTool{{Code: "tool_hash_map", Name: "Hash Map", Position: 2}},
		Families: []AtlasFamily{{
			Code: "binary_search", Name: "Binary Search", Position: 5,
			SubpatternCodes: []string{"binary_search_on_answer"},
		}},
		Subpatterns: []AtlasSubpattern{{
			Code: "binary_search_on_answer", Name: "Binary Search on Answer",
			FamilyCodes: []string{"binary_search"},
			ToolCodes:   []string{"tool_complexity"},
			Mastery:     Mastery{Status: MasteryLearning, Percent: 25},
		}},
	}})
	r := withUser(httptest.NewRequest(http.MethodGet, "/patterns/atlas", nil), 1)
	w := httptest.NewRecorder()

	routePatterns(h).ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body struct {
		Data AtlasResponse `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if body.Data.TaxonomyVersion != TaxonomyVersion {
		t.Fatalf("taxonomy_version = %q", body.Data.TaxonomyVersion)
	}
	if len(body.Data.Subpatterns) != 1 || body.Data.Subpatterns[0].Mastery.Status != MasteryLearning {
		t.Fatalf("unexpected subpatterns payload: %+v", body.Data.Subpatterns)
	}
	if body.Data.Company != nil {
		t.Fatal("company overlay must be omitted when no company is selected")
	}
}

func TestGetAtlas_UnknownCompany(t *testing.T) {
	h := NewHandler(fakeRepository{atlasErr: ErrCompanyNotFound})
	r := withUser(httptest.NewRequest(http.MethodGet, "/patterns/atlas?company=cmp_nope", nil), 1)
	w := httptest.NewRecorder()

	routePatterns(h).ServeHTTP(w, r)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestListAtlasCompanies_EmptyIsArray(t *testing.T) {
	h := NewHandler(fakeRepository{})
	r := withUser(httptest.NewRequest(http.MethodGet, "/patterns/atlas/companies", nil), 1)
	w := httptest.NewRecorder()

	routePatterns(h).ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body struct {
		Data struct {
			Companies []AtlasCompany `json:"companies"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if body.Data.Companies == nil {
		t.Fatal("companies must be an empty array, not null")
	}
}

func TestGetAtlasNode_Found(t *testing.T) {
	h := NewHandler(fakeRepository{node: NodeDetail{
		Code: "binary_search_on_answer",
		Name: "Binary Search on Answer",
		Kind: "subpattern",
		Material: &LearningMaterial{
			WhatItIs:        "Поиск не по массиву, а по пространству ответов.",
			DontConfuseWith: []ContrastPair{{Title: "Exact Binary Search", Note: "ищет элемент, а не границу допустимости"}},
		},
	}})
	r := withUser(httptest.NewRequest(http.MethodGet, "/patterns/atlas/binary_search_on_answer", nil), 1)
	w := httptest.NewRecorder()

	routePatterns(h).ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body struct {
		Data NodeDetail `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if body.Data.Kind != "subpattern" || body.Data.Material == nil {
		t.Fatalf("unexpected node payload: %+v", body.Data)
	}
}

func TestGetAtlasNode_NotFound(t *testing.T) {
	h := NewHandler(fakeRepository{nodeErr: ErrPatternNotFound})
	r := withUser(httptest.NewRequest(http.MethodGet, "/patterns/atlas/unknown", nil), 1)
	w := httptest.NewRecorder()

	routePatterns(h).ServeHTTP(w, r)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestGetAtlasNode_Unauthorized(t *testing.T) {
	h := NewHandler(nil)
	r := httptest.NewRequest(http.MethodGet, "/patterns/atlas/binary_search_on_answer", nil)
	w := httptest.NewRecorder()

	h.GetAtlasNode(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}
