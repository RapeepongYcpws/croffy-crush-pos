package promptpay

import (
	"fmt"
	"testing"
)

const thaiQRBase = "00020101021130860016A000000677010112011501075370008820502198B120940Y31033427TS0320MISSPHATSAKANLAIPHAI53037645802TH62080704000063045D8E"

// validCRC recomputes the CRC over everything up to and including "6304" and
// compares it with the trailing 4 hex digits of the payload.
func validCRC(payload string) bool {
	if len(payload) < 8 {
		return false
	}
	body := payload[:len(payload)-4]
	want := payload[len(payload)-4:]
	return fmt.Sprintf("%04X", crc16(body)) == want
}

func TestWithAmount_ThaiQR(t *testing.T) {
	out := WithAmount(thaiQRBase, 79)
	fields := parseTLV(out)
	if fields == nil {
		t.Fatalf("payload not parseable: %s", out)
	}
	if fields["01"] != "12" {
		t.Errorf("POI = %q, want 12 (dynamic)", fields["01"])
	}
	if fields["54"] != "79.00" {
		t.Errorf("amount = %q, want 79.00", fields["54"])
	}
	if !validCRC(out) {
		t.Errorf("invalid CRC for %s", out)
	}
}

func TestWithAmount_PromptPay(t *testing.T) {
	out := WithAmount(Build("0812345678"), 250.5)
	fields := parseTLV(out)
	if fields["54"] != "250.50" {
		t.Errorf("amount = %q, want 250.50", fields["54"])
	}
	if !validCRC(out) {
		t.Errorf("invalid CRC for %s", out)
	}
}

func TestWithAmount_ZeroUnchangedAndBaseValid(t *testing.T) {
	if got := WithAmount(thaiQRBase, 0); got != thaiQRBase {
		t.Errorf("amount 0 should return payload unchanged")
	}
	if !validCRC(thaiQRBase) {
		t.Errorf("base Thai QR CRC mismatch (sanity check of test helper)")
	}
}
