package promptpay

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// Build creates a static Thai PromptPay EMVCo QR payload WITHOUT a fixed amount.
// target = mobile number (e.g. "0812345678") or national/tax ID (13 digits).
func Build(target string) string {
	target = sanitize(target)

	payload := field("00", "01") // Payload Format Indicator
	payload += field("01", "11") // Point of Initiation: 11 = static (no amount)

	// Merchant Account Information (PromptPay) — tag 29
	merchant := field("00", "A000000677010111") // Application ID
	if len(target) >= 13 {
		// National ID / Tax ID -> tag 03
		merchant += field("03", target[:13])
	} else {
		// Mobile number -> tag 01, formatted as 0066xxxxxxxxx
		merchant += field("01", formatMobile(target))
	}
	payload += field("29", merchant)

	payload += field("53", "764") // Currency THB
	payload += field("58", "TH")  // Country

	// CRC (tag 63, length 04) computed over payload + "6304"
	payload += "6304"
	payload += fmt.Sprintf("%04X", crc16(payload))
	return payload
}

// WithAmount injects a fixed transaction amount (tag 54) into an existing EMVCo
// QR payload, switches the Point of Initiation Method (tag 01) to dynamic (12),
// and recomputes the CRC (tag 63). Works for both PromptPay and Thai QR payloads.
// If amount <= 0 the payload is returned unchanged.
func WithAmount(payload string, amount float64) string {
	if amount <= 0 {
		return payload
	}
	fields := parseTLV(payload)
	if fields == nil {
		return payload
	}
	fields["01"] = "12" // dynamic QR (fixed amount)
	fields["54"] = strconv.FormatFloat(amount, 'f', 2, 64)
	delete(fields, "63") // CRC recomputed below

	// EMVCo top-level tags must be emitted in ascending numeric order.
	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var b strings.Builder
	for _, k := range keys {
		b.WriteString(field(k, fields[k]))
	}
	out := b.String() + "6304"
	return out + fmt.Sprintf("%04X", crc16(out))
}

// parseTLV parses the top-level Tag-Length-Value structure of an EMVCo payload.
// Returns nil if the payload is malformed.
func parseTLV(s string) map[string]string {
	out := map[string]string{}
	for i := 0; i+4 <= len(s); {
		tag := s[i : i+2]
		n, err := strconv.Atoi(s[i+2 : i+4])
		if err != nil || i+4+n > len(s) {
			return nil
		}
		out[tag] = s[i+4 : i+4+n]
		i += 4 + n
	}
	return out
}

func sanitize(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// formatMobile converts 0812345678 -> 0066812345678
func formatMobile(m string) string {
	m = strings.TrimPrefix(m, "0")
	return "0066" + m
}

func field(id, value string) string {
	return fmt.Sprintf("%s%02d%s", id, len(value), value)
}

// crc16 implements CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF).
func crc16(s string) uint16 {
	var crc uint16 = 0xFFFF
	for i := 0; i < len(s); i++ {
		crc ^= uint16(s[i]) << 8
		for j := 0; j < 8; j++ {
			if crc&0x8000 != 0 {
				crc = (crc << 1) ^ 0x1021
			} else {
				crc <<= 1
			}
		}
	}
	return crc
}
