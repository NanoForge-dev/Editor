#!/usr/bin/env bash

set -uo pipefail

START_TIME=$(date +%s)
STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REPO_NAME="${REPO_NAME:-Editor}"
export REPORT_DIR="${REPORT_DIR:-reports}"
RAW_DIR=$(mktemp -d "/tmp/nightly-${REPO_NAME}.XXXXXX")

mkdir -p "$REPORT_DIR"

cleanup() {
    rm -rf "$RAW_DIR"
}
trap cleanup EXIT

require_bins() {
    local bin
    for bin in git bash jq pnpm; do
        if ! command -v "$bin" >/dev/null 2>&1; then
            echo "Required command not found: $bin" >&2
            return 1
        fi
    done
}

setup() {
    echo "=== [Nightly Setup: $REPO_NAME] ==="

    if [[ ! -f ".env" ]] && [[ -f ".env.example" ]]; then
        cp .env.example .env
    fi

    # Ensure bun is available if possible
    if ! command -v bun >/dev/null 2>&1; then
        echo "bun not found, attempting npm install -g bun..."
        npm install --global bun || true
    fi

    if [[ ! -d "node_modules" ]]; then
        echo "Installing dependencies..."
        pnpm install --frozen-lockfile || pnpm install
    fi

    # Check for system chromium (e.g. Alpine package) if executable path is not explicitly set
    if [[ -z "${PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH:-}" ]]; then
        if command -v chromium-browser >/dev/null 2>&1; then
            export PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH="$(command -v chromium-browser)"
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
        elif command -v chromium >/dev/null 2>&1; then
            export PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH="$(command -v chromium)"
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
        fi
    fi

    if [[ -z "${PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH:-}" ]]; then
        echo "Installing Playwright browser..."
        pnpm exec playwright install chromium || true
    fi

    echo "Syncing SvelteKit..."
    pnpm exec svelte-kit sync || true
}

run_unit_tests() {
    echo "=== [Running Unit Tests with Coverage] ==="
    local unit_start unit_end unit_duration
    local exit_code=0
    unit_start=$(date +%s)

    mkdir -p "$RAW_DIR/coverage"

    pnpm vitest run -c vite.config.ts \
        --coverage \
        --coverage.reporter=text \
        --coverage.reporter=json-summary \
        --coverage.reportsDirectory="$RAW_DIR/coverage" \
        --reporter=default \
        --reporter=json \
        --outputFile="$RAW_DIR/unit-results.json" || exit_code=$?

    unit_end=$(date +%s)
    unit_duration=$((unit_end - unit_start))

    local results_file="$RAW_DIR/unit-results.json"
    local passed_tests=0 failed_tests=0 total_tests=0 skipped_tests=0
    local passed_suites=0 failed_suites=0 total_suites=0
    local status="failed"

    if [[ -f "$results_file" ]]; then
        total_tests=$(jq -r '.numTotalTests // 0' "$results_file")
        passed_tests=$(jq -r '.numPassedTests // 0' "$results_file")
        failed_tests=$(jq -r '.numFailedTests // 0' "$results_file")
        skipped_tests=$(jq -r '.numPendingTests // 0' "$results_file")
        total_suites=$(jq -r '.numTotalTestSuites // 0' "$results_file")
        passed_suites=$(jq -r '.numPassedTestSuites // 0' "$results_file")
        failed_suites=$(jq -r '.numFailedTestSuites // 0' "$results_file")
    fi

    if [[ "$exit_code" -eq 0 ]]; then
        status="passed"
    fi

    UNIT_JSON=$(jq -n \
        --arg name "unit" \
        --arg status "$status" \
        --argjson exit_code "$exit_code" \
        --argjson duration "$unit_duration" \
        --argjson tests_total "$total_tests" \
        --argjson tests_passed "$passed_tests" \
        --argjson tests_failed "$failed_tests" \
        --argjson tests_skipped "$skipped_tests" \
        --argjson suites_total "$total_suites" \
        --argjson suites_passed "$passed_suites" \
        --argjson suites_failed "$failed_suites" \
        '{
            name: $name,
            status: $status,
            exit_code: $exit_code,
            duration_seconds: $duration,
            tests_total: $tests_total,
            tests_passed: $tests_passed,
            tests_failed: $tests_failed,
            tests_skipped: $tests_skipped,
            suites_total: $suites_total,
            suites_passed: $suites_passed,
            suites_failed: $suites_failed
        }')

    echo "$UNIT_JSON" > "$RAW_DIR/unit.json"
    return "$exit_code"
}

run_e2e_tests() {
    echo "=== [Running E2E Tests] ==="

    if [[ "${SKIP_E2E:-false}" == "true" ]]; then
        echo "SKIP_E2E is set; skipping E2E tests"
        set_e2e_skipped "skipped_by_configuration"
        return 0
    fi

    if [[ ! -f "playwright.config.ts" ]] && [[ ! -d "e2e" ]]; then
        echo "No E2E tests configured; skipping"
        set_e2e_skipped "no_e2e_tests_configured"
        return 0
    fi

    local e2e_start e2e_end e2e_duration
    local exit_code=0
    e2e_start=$(date +%s)

    local results_file="$RAW_DIR/e2e-results.json"
    PLAYWRIGHT_JSON_OUTPUT_NAME="$results_file" \
        pnpm exec playwright test --reporter=list,json || exit_code=$?

    e2e_end=$(date +%s)
    e2e_duration=$((e2e_end - e2e_start))

    local passed_tests=0 failed_tests=0 total_tests=0 skipped_tests=0
    local passed_suites=0 failed_suites=0 total_suites=0
    local status="failed"

    if [[ -f "$results_file" ]]; then
        total_tests=$(jq -r '((.stats.expected // 0) + (.stats.unexpected // 0) + (.stats.skipped // 0) + (.stats.flaky // 0))' "$results_file")
        passed_tests=$(jq -r '((.stats.expected // 0) + (.stats.flaky // 0))' "$results_file")
        failed_tests=$(jq -r '(.stats.unexpected // 0)' "$results_file")
        skipped_tests=$(jq -r '(.stats.skipped // 0)' "$results_file")
        total_suites=$(jq -r '(.suites | length // 0)' "$results_file")
        failed_suites=$(jq -r '([.suites[]? | select([.. | objects | select(has("ok") and .ok == false)] | length > 0)] | length // 0)' "$results_file")
        passed_suites=$((total_suites - failed_suites))
    fi

    if [[ "$exit_code" -eq 0 ]]; then
        status="passed"
    fi

    E2E_JSON=$(jq -n \
        --arg name "e2e" \
        --arg status "$status" \
        --argjson exit_code "$exit_code" \
        --argjson duration "$e2e_duration" \
        --argjson tests_total "$total_tests" \
        --argjson tests_passed "$passed_tests" \
        --argjson tests_failed "$failed_tests" \
        --argjson tests_skipped "$skipped_tests" \
        --argjson suites_total "$total_suites" \
        --argjson suites_passed "$passed_suites" \
        --argjson suites_failed "$failed_suites" \
        '{
            name: $name,
            status: $status,
            exit_code: $exit_code,
            duration_seconds: $duration,
            tests_total: $tests_total,
            tests_passed: $tests_passed,
            tests_failed: $tests_failed,
            tests_skipped: $tests_skipped,
            suites_total: $suites_total,
            suites_passed: $suites_passed,
            suites_failed: $suites_failed
        }')

    echo "$E2E_JSON" > "$RAW_DIR/e2e.json"
    return "$exit_code"
}

set_e2e_skipped() {
    local reason=$1
    jq -n \
        --arg name "e2e" \
        --arg status "skipped" \
        --arg reason "$reason" \
        '{
            name: $name,
            status: $status,
            exit_code: null,
            duration_seconds: 0,
            tests_total: 0,
            tests_passed: 0,
            tests_failed: 0,
            tests_skipped: 0,
            suites_total: 0,
            suites_passed: 0,
            suites_failed: 0,
            reason: $reason
        }' > "$RAW_DIR/e2e.json"
}

generate_report() {
    local overall_exit_code=$1
    local finished_at total_duration
    finished_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    total_duration=$(( $(date +%s) - START_TIME ))

    local overall_status="passed"
    if [[ "$overall_exit_code" -ne 0 ]]; then
        overall_status="failed"
    fi

    local cov_file="$RAW_DIR/coverage/coverage-summary.json"
    local coverage_json="{}"
    if [[ -f "$cov_file" ]]; then
        coverage_json=$(jq '.total // {}' "$cov_file")
    fi

    if [[ ! -f "$RAW_DIR/unit.json" ]]; then
        echo '{"name":"unit","status":"skipped","tests_total":0,"tests_passed":0,"tests_failed":0,"tests_skipped":0}' > "$RAW_DIR/unit.json"
    fi
    if [[ ! -f "$RAW_DIR/e2e.json" ]]; then
        echo '{"name":"e2e","status":"skipped","tests_total":0,"tests_passed":0,"tests_failed":0,"tests_skipped":0}' > "$RAW_DIR/e2e.json"
    fi

    local report_json
    report_json=$(jq -n \
        --arg name "$REPO_NAME" \
        --arg status "$overall_status" \
        --argjson exit_code "$overall_exit_code" \
        --arg started_at "$STARTED_AT" \
        --arg finished_at "$finished_at" \
        --argjson duration "$total_duration" \
        --slurpfile unit "$RAW_DIR/unit.json" \
        --slurpfile e2e "$RAW_DIR/e2e.json" \
        --argjson coverage "$coverage_json" \
        '
        ($unit[0] // {}) as $u |
        ($e2e[0] // {}) as $e |
        {
            name: $name,
            status: $status,
            exit_code: $exit_code,
            started_at: $started_at,
            finished_at: $finished_at,
            duration_seconds: $duration,
            summary: {
                tests_total: (($u.tests_total // 0) + ($e.tests_total // 0)),
                tests_passed: (($u.tests_passed // 0) + ($e.tests_passed // 0)),
                tests_failed: (($u.tests_failed // 0) + ($e.tests_failed // 0)),
                tests_skipped: (($u.tests_skipped // 0) + ($e.tests_skipped // 0)),
                suites_total: (($u.suites_total // 0) + ($e.suites_total // 0)),
                suites_passed: (($u.suites_passed // 0) + ($e.suites_passed // 0)),
                suites_failed: (($u.suites_failed // 0) + ($e.suites_failed // 0)),
                coverage_pct: ($coverage.lines.pct // null),
                coverage: (if ($coverage | length) > 0 then $coverage else null end)
            },
            suites: [ $u, $e ]
        }')

    echo "$report_json" | jq '.' > "$REPORT_DIR/${REPO_NAME}.json"
    cp "$REPORT_DIR/${REPO_NAME}.json" "$REPORT_DIR/${REPO_NAME}.report.json"

    local md_file="$REPORT_DIR/${REPO_NAME}.md"
    {
        echo "# Nightly Test Report: $REPO_NAME"
        echo
        echo "- **Status**: $([[ "$overall_status" == "passed" ]] && echo "PASS" || echo "FAIL")"
        echo "- **Started**: $STARTED_AT"
        echo "- **Finished**: $finished_at"
        echo "- **Duration**: ${total_duration}s"
        echo "- **Tests**: $(echo "$report_json" | jq -r '.summary.tests_passed') passed, $(echo "$report_json" | jq -r '.summary.tests_failed') failed, $(echo "$report_json" | jq -r '.summary.tests_total') total"
        if echo "$report_json" | jq -e '.summary.coverage.lines.pct != null' >/dev/null 2>&1; then
            echo "- **Line Coverage**: $(echo "$report_json" | jq -r '.summary.coverage.lines.pct')%"
        fi
        echo
        echo "### Test Suites"
        echo "| Suite | Status | Tests (P/F/Total) | Suites (P/F/Total) | Duration (s) |"
        echo "|---|---|---:|---:|---:|"
        echo "$report_json" | jq -r '.suites[] | "| \(.name) | \(.status) | \(.tests_passed // 0) / \(.tests_failed // 0) / \(.tests_total // 0) | \(.suites_passed // 0) / \(.suites_failed // 0) / \(.suites_total // 0) | \(.duration_seconds // 0)s |"'
        echo
        if echo "$report_json" | jq -e '.summary.coverage.lines != null' >/dev/null 2>&1; then
            echo "### Code Coverage"
            echo "| Metric | Coverage | Covered / Total |"
            echo "|---|---:|---:|"
            echo "$report_json" | jq -r '
                .summary.coverage |
                "| Lines | \(.lines.pct // 0)% | \(.lines.covered // 0) / \(.lines.total // 0) |\n" +
                "| Statements | \(.statements.pct // 0)% | \(.statements.covered // 0) / \(.statements.total // 0) |\n" +
                "| Functions | \(.functions.pct // 0)% | \(.functions.covered // 0) / \(.functions.total // 0) |\n" +
                "| Branches | \(.branches.pct // 0)% | \(.branches.covered // 0) / \(.branches.total // 0) |"
            '
            echo
        fi
    } > "$md_file"
    cp "$md_file" "$REPORT_DIR/${REPO_NAME}.report.md"

    if [[ "$REPORT_DIR" != "reports" ]] && [[ "$REPORT_DIR" != "$(pwd)/reports" ]]; then
        mkdir -p reports
        cp "$REPORT_DIR/${REPO_NAME}.json" "reports/nightly-report.json"
        cp "$REPORT_DIR/${REPO_NAME}.md" "reports/nightly-report.md"
    fi

    echo
    echo "=== [Nightly Report Summary] ==="
    cat "$md_file"
    echo "Report JSON written to: $REPORT_DIR/${REPO_NAME}.json"
    echo "Report Markdown written to: $REPORT_DIR/${REPO_NAME}.md"
}

main() {
    if ! require_bins; then
        exit 1
    fi

    setup

    local unit_exit=0
    local overall_exit=0

    run_unit_tests || unit_exit=$?

    if [[ "$unit_exit" -ne 0 ]]; then
        echo "Unit tests failed with exit code $unit_exit; skipping E2E tests" >&2
        overall_exit=$unit_exit
        set_e2e_skipped "skipped_due_to_unit_failure"
    else
        local e2e_exit=0
        run_e2e_tests || e2e_exit=$?
        if [[ "$e2e_exit" -ne 0 ]]; then
            overall_exit=$e2e_exit
        fi
    fi

    generate_report "$overall_exit"
    exit "$overall_exit"
}

main "$@"
