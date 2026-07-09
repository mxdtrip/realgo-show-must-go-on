package ai

import (
	"regexp"
	"strconv"
	"strings"
)

// hintFieldExtractor incrementally extracts the string value of the "hint"
// key from a JSON object as its raw text streams in fragment by fragment, so
// a caller can reveal the hint to the user as it's generated instead of
// waiting for the whole JSON object (question/stage/...) to finish.
//
// It's a best-effort scanner, not a JSON parser: it looks for the literal
// key `"hint"` followed by `:` and an opening quote, then decodes the
// string's escape sequences as they arrive until the first unescaped closing
// quote. Text before the key is found, or after the value closes, is never
// revealed.
type hintFieldExtractor struct {
	pending strings.Builder // raw text buffered until the "hint" key is located
	found   bool
	done    bool
	escape  bool
	uEscape []byte // collects up to 4 hex digits after a \u escape
}

var hintKeyPattern = regexp.MustCompile(`"hint"\s*:\s*"`)

func newHintFieldExtractor() *hintFieldExtractor {
	return &hintFieldExtractor{}
}

// feed appends a raw fragment of streamed JSON text and returns any newly
// decoded characters of the "hint" field's value now available.
func (h *hintFieldExtractor) feed(fragment string) string {
	if h.done {
		return ""
	}
	if !h.found {
		h.pending.WriteString(fragment)
		buffered := h.pending.String()
		loc := hintKeyPattern.FindStringIndex(buffered)
		if loc == nil {
			// Cap the search buffer: the key is expected within the first
			// few tokens, so an unbounded wait here would only happen for a
			// malformed response that never contains "hint" at all.
			return ""
		}
		h.found = true
		rest := buffered[loc[1]:]
		h.pending.Reset()
		return h.decode(rest)
	}
	return h.decode(fragment)
}

// decode consumes raw JSON-string-escaped bytes, revealing decoded
// characters as they complete, and stops (marking done) at the first
// unescaped closing quote. Backslash and quote are always single ASCII
// bytes in UTF-8, so byte-wise scanning is safe even for multi-byte content.
func (h *hintFieldExtractor) decode(s string) string {
	var out strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		if h.uEscape != nil {
			h.uEscape = append(h.uEscape, c)
			if len(h.uEscape) == 4 {
				if v, err := strconv.ParseUint(string(h.uEscape), 16, 32); err == nil {
					out.WriteRune(rune(v))
				}
				h.uEscape = nil
			}
			continue
		}
		if h.escape {
			h.escape = false
			switch c {
			case 'n':
				out.WriteByte('\n')
			case 't':
				out.WriteByte('\t')
			case 'r':
				out.WriteByte('\r')
			case 'b':
				out.WriteByte('\b')
			case 'f':
				out.WriteByte('\f')
			case '"', '\\', '/':
				out.WriteByte(c)
			case 'u':
				h.uEscape = make([]byte, 0, 4)
			default:
				out.WriteByte(c)
			}
			continue
		}
		if c == '\\' {
			h.escape = true
			continue
		}
		if c == '"' {
			h.done = true
			return out.String()
		}
		out.WriteByte(c)
	}
	return out.String()
}
