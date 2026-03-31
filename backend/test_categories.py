#!/usr/bin/env python3
"""Cross-category test runner for Johnson AP pipeline.

Usage:
    python test_categories.py --list              # List all tests
    python test_categories.py                     # Run all tests
    python test_categories.py --test 3            # Run single test by ID
    python test_categories.py --test 1,2,5        # Run multiple tests
    python test_categories.py --base-url http://localhost:8090  # Custom URL
"""

import argparse
import json
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("pip install requests")

CONFIG = {"base_url": "http://localhost:8090"}
TEST_DATA = Path(__file__).parent / "test-data"
EXPECTED = TEST_DATA / "expected.json"
POLL_INTERVAL = 2  # seconds
POLL_TIMEOUT = 600  # 10 minutes max (Opus model is slower)


def load_tests():
    with open(EXPECTED) as f:
        return json.load(f)["tests"]


def list_tests(tests):
    print(f"{'ID':>3}  {'Name':<40}  {'File'}")
    print("-" * 80)
    for t in tests:
        f = t.get("file") or t.get("files", ["(none)"])[0]
        print(f"{t['id']:>3}  {t['name']:<40}  {f}")


def submit_job(test):
    """POST files to test-backend, return job ID."""
    base = CONFIG["base_url"]
    url = f"{base}/api/playground/test-backend"

    # Determine files to upload
    files_to_upload = []
    if "files" in test:
        for fname in test["files"]:
            path = TEST_DATA / fname
            if not path.exists():
                return None, f"File not found: {path}"
            files_to_upload.append(("files", (path.name, open(path, "rb"), "application/pdf")))
    elif test.get("file"):
        path = TEST_DATA / test["file"]
        if not path.exists():
            return None, f"File not found: {path}"
        mime = "application/pdf" if path.suffix == ".pdf" else "application/octet-stream"
        files_to_upload.append(("files", (path.name, open(path, "rb"), mime)))
    else:
        return None, "No file specified (manual test)"

    data = {
        "from_address": "vendor@example.com",
        "subject": "Invoice submission",
    }

    try:
        resp = requests.post(url, data=data, files=files_to_upload, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        return result["jobId"], None
    except Exception as e:
        return None, str(e)
    finally:
        for _, (_, fh, _) in files_to_upload:
            fh.close()


def poll_job(job_id):
    """Poll until job completes or times out. Return job dict."""
    base = CONFIG["base_url"]
    url = f"{base}/api/jobs/{job_id}"
    start = time.time()
    last_step = None

    while time.time() - start < POLL_TIMEOUT:
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            job = resp.json()
        except Exception as e:
            print(f"  Poll error: {e}")
            time.sleep(POLL_INTERVAL)
            continue

        status = job.get("status", "UNKNOWN")
        step = job.get("currentStep")
        if step != last_step:
            print(f"  [{status}] step: {step or '-'}")
            last_step = step

        if status in ("COMPLETED", "FAILED"):
            return job

        time.sleep(POLL_INTERVAL)

    return {"status": "TIMEOUT", "error": f"Timed out after {POLL_TIMEOUT}s"}


def check_result(test, job):
    """Compare job output against expected values. Return (pass, details)."""
    issues = []
    status = job.get("status")

    # For edge cases that should fail/be flagged
    if test["id"] in (11, 12, 13) and test.get("expected_category") is None:
        # These are expected to either fail gracefully or be flagged
        if status == "FAILED":
            return True, f"Correctly failed: {job.get('error', 'no error message')}"
        # Check if any step flagged the issue
        for step in job.get("steps", []):
            output = step.get("output", "")
            if isinstance(output, str) and any(kw in output.lower() for kw in ["protected", "password", "unsupported", "skipped", "non-pdf", "too many pages"]):
                return True, f"Correctly flagged in step {step.get('name')}"
        issues.append(f"Expected edge case to be flagged, but status={status}")

    # For normal tests
    if status != "COMPLETED" and test["id"] not in (9, 11, 12, 13):
        issues.append(f"Expected COMPLETED, got {status}. Error: {job.get('error')}")
        return False, "; ".join(issues)

    # Check steps for category/entity info
    steps = {s.get("name"): s for s in job.get("steps", [])}

    # Check categorize step output
    cat_step = steps.get("categorize", {})
    cat_output = cat_step.get("output")
    if cat_output and test.get("expected_category"):
        if isinstance(cat_output, str):
            try:
                cat_output = json.loads(cat_output)
            except (json.JSONDecodeError, TypeError):
                pass
        if isinstance(cat_output, dict):
            actual_cat = cat_output.get("category", "")
            expected_cat = test["expected_category"]
            if expected_cat.lower() not in actual_cat.lower():
                issues.append(f"Category: expected '{expected_cat}', got '{actual_cat}'")
            actual_entity = cat_output.get("entity", "")
            expected_entity = test.get("expected_entity")
            if expected_entity and expected_entity.lower() not in actual_entity.lower():
                issues.append(f"Entity: expected '{expected_entity}', got '{actual_entity}'")

    # Check classify step (for NON_INVOICE test)
    if test["id"] == 9:
        cls_step = steps.get("classify", {})
        cls_output = cls_step.get("output", "")
        if "non_invoice" not in str(cls_output).lower() and "non-invoice" not in str(cls_output).lower():
            issues.append("Expected NON_INVOICE classification")

    if issues:
        return False, "; ".join(issues)
    return True, "OK"


def run_test(test):
    """Run a single test. Return (pass, details)."""
    print(f"\n{'='*60}")
    print(f"Test {test['id']}: {test['name']}")
    if test.get("file"):
        print(f"  File: {test['file']} ({test.get('pages', '?')}pg)")
    elif test.get("files"):
        print(f"  Files: {', '.join(test['files'])}")
    print(f"  Notes: {test.get('notes', '')[:100]}...")

    # Skip tests that can't be automated
    if test["id"] == 9:
        print("  SKIP: Non-invoice email test requires manual setup")
        return None, "SKIP: manual test"
    if test["id"] == 12 and test.get("file") is None:
        print("  SKIP: No >50 page PDF available")
        return None, "SKIP: no test file"

    job_id, err = submit_job(test)
    if err:
        print(f"  SUBMIT ERROR: {err}")
        return False, f"Submit error: {err}"

    print(f"  Job: {job_id}")
    job = poll_job(job_id)

    passed, details = check_result(test, job)
    status_icon = "PASS" if passed else "FAIL" if passed is False else "SKIP"
    print(f"  Result: {status_icon} — {details}")

    # Print step summary
    for step in job.get("steps", []):
        name = step.get("name", "?")
        st = step.get("status", "?")
        dur = step.get("duration_ms", 0)
        print(f"    {name}: {st} ({dur}ms)")

    return passed, details


def main():
    parser = argparse.ArgumentParser(description="Johnson AP cross-category test runner")
    parser.add_argument("--list", action="store_true", help="List available tests")
    parser.add_argument("--test", type=str, help="Run specific test(s) by ID (comma-separated)")
    default_url = CONFIG["base_url"]
    parser.add_argument("--base-url", type=str, default=default_url, help=f"API base URL (default: {default_url})")
    args = parser.parse_args()

    CONFIG["base_url"] = args.base_url

    tests = load_tests()

    if args.list:
        list_tests(tests)
        return

    # Filter tests if --test specified
    if args.test:
        ids = [int(x.strip()) for x in args.test.split(",")]
        tests = [t for t in tests if t["id"] in ids]
        if not tests:
            sys.exit(f"No tests found for IDs: {args.test}")

    # Run tests
    results = []
    for test in tests:
        passed, details = run_test(test)
        results.append((test["id"], test["name"], passed, details))

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    total = len(results)
    passed_count = sum(1 for _, _, p, _ in results if p is True)
    failed_count = sum(1 for _, _, p, _ in results if p is False)
    skipped = sum(1 for _, _, p, _ in results if p is None)

    for tid, name, p, details in results:
        icon = "PASS" if p else "FAIL" if p is False else "SKIP"
        print(f"  [{icon}] #{tid} {name}")

    print(f"\n{passed_count} passed, {failed_count} failed, {skipped} skipped / {total} total")
    sys.exit(1 if failed_count > 0 else 0)


if __name__ == "__main__":
    main()
