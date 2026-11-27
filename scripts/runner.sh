#!/usr/bin/env bash
# Конвеєр агентів (docs/PIPELINE.md §3). Один процес = один воркер = один акаунт.
#   scripts/runner.sh w1            # Claude, акаунт за замовчуванням
#   CLAUDE_CONFIG_DIR=~/.claude-acc2 scripts/runner.sh w2
#   AGENT=codex scripts/runner.sh w3
#   MODE=fix scripts/runner.sh w3   # лагодить PR з міткою fix
#   ONCE=1 scripts/runner.sh w1     # одна задача й вихід (перевірка конвеєра)
#   ONLY=codex AGENT=codex scripts/runner.sh w3   # бере лише задачі з міткою codex
#   SKIP=codex scripts/runner.sh w1               # не бере задачі з міткою codex
# Зупинити: touch ~/amber-runs/STOP   (або pkill -f runner.sh)
set -uo pipefail

WORKER="${1:?worker name, e.g. w1}"
AGENT="${AGENT:-claude}"
MODE="${MODE:-issues}"
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
RUNS="${RUNS:-$HOME/amber-runs}"
TIMEOUT_MIN="${TIMEOUT_MIN:-45}"
mkdir -p "$RUNS/logs"
cd "$REPO_DIR"

log() { echo "[$(date '+%H:%M:%S')] $WORKER: $*" | tee -a "$RUNS/logs/$WORKER.log"; }

prompt_for() { # $1 issue number, $2 title, $3 feature, $4 issue body
  cat <<P
You are working in repo amber404-sky, issue #$1: $2.
Read CONSTITUTION.md, AGENTS.md (conveyor mode), docs/SPEC.md and the spec file linked in the issue.
Issue text:
---
$4
---
Implement ONLY this issue's acceptance criteria.
Rules:
- Never ask questions. If something is unclear, choose the option closest to SPEC,
  write it under "Assumptions" in the PR body, and continue.
- Write tests first (red), then code (green). Pure logic goes to web/src/core.
- Touch only the paths of feature $3 (SPEC §9). Missing contract field: note it under
  "Contract requests" in the PR body and use mocks.
- Run \`make check\` until it passes (if make data-mock is needed, run it). Do not disable tests or lint rules.
- Do not edit docs/AI_LOG.md. Put the AI log line in the PR body.
- Commit with message "$3: <short>" (no agent signatures). Do NOT push and do NOT open the PR: the runner does it.
- Final answer: the PR body (plan T1..Tn, table AC -> ✅/❌ + how checked, Assumptions, Contract requests, AI log line).
P
}

fix_prompt() { # $1 PR number
  cat <<P
You are working in repo amber404-sky on PR #$1, branch already checked out.
CI is red or the branch conflicts with main. Rebase onto origin/main (already fetched), resolve conflicts keeping both intents,
then make \`make check\` pass. Follow AGENTS.md conveyor mode. Never ask questions. Do not disable tests.
Commit "fix: <short>" (no agent signatures). Do NOT push: the runner does it. Final answer: 3 lines on what was wrong.
P
}

run_agent() { # $1 workdir, $2 prompt file, $3 output file
  local rc
  if [ "$AGENT" = "codex" ]; then
    ( timeout "${TIMEOUT_MIN}m" codex exec --approve-for-me --add-dir "$REPO_DIR/.git" -C "$1" -o "$3" "$(cat "$2")" </dev/null ) >>"$RUNS/logs/$WORKER.log" 2>&1; rc=$?
  else
    ( cd "$1" && timeout "${TIMEOUT_MIN}m" claude -p "$(cat "$2")" --permission-mode bypassPermissions --output-format text </dev/null ) >"$3" 2>>"$RUNS/logs/$WORKER.log"; rc=$?
  fi
  if grep -qiE "usage limit|rate limit|limit reached|quota" "$3" "$RUNS/logs/$WORKER.log" 2>/dev/null && [ $rc -ne 0 ]; then return 75; fi
  return $rc
}

pick_issue() {
  # bug → p0 → p1; лише agent, без in-progress/blocked/stuck; усі «після #N» закриті.
  local closed; closed=$(gh issue list --state closed --limit 500 --json number --jq '.[].number' | tr '\n' ' ')
  for pr in bug p0 p1; do
    gh issue list --state open --label agent --label "$pr" ${ONLY:+--label "$ONLY"} --limit 100 \
      --json number,title,labels,body --jq 'sort_by(.number)[] | select([.labels[].name] | (index("in-progress") or index("blocked") or index("stuck") or (env.SKIP != null and env.SKIP != "" and index(env.SKIP))) | not) | @base64' |
    while read -r row; do
      local j; j=$(echo "$row" | base64 --decode)
      local deps ok=1; deps=$(echo "$j" | jq -r .body | grep -oE '(після|after) #[0-9]+' | grep -oE '[0-9]+' || true)
      for d in $deps; do case " $closed " in *" $d "*) ;; *) ok=0 ;; esac; done
      [ $ok = 1 ] && { echo "$j"; return 0; }
    done | head -1 | grep . && return 0
  done
  return 1
}

while [ ! -f "$RUNS/STOP" ]; do
  git fetch -q origin main
  if [ "$MODE" = "fix" ]; then
    # PR з конфліктом з main не отримує CI, тож і мітку fix — ставимо її самі
    for c in $(gh pr list --state open --json number,mergeable,labels --jq '.[] | select(.mergeable=="CONFLICTING") | select([.labels[].name] | (index("fix") or index("stuck")) | not) | .number'); do
      gh pr edit "$c" --add-label fix >/dev/null && log "PR #$c conflicts with main → fix"
    done
    pr=$(gh pr list --state open --label fix --json number,headRefName,labels --jq '[.[] | select([.labels[].name] | index("stuck") | not)][0] // empty')
    [ -z "$pr" ] && { sleep 120; continue; }
    num=$(jq -r .number <<<"$pr"); br=$(jq -r .headRefName <<<"$pr")
    tries=$(gh pr view "$num" --json comments --jq '[.comments[].body | select(startswith("runner: fix attempt"))] | length')
    if [ "$tries" -ge 2 ]; then gh pr edit "$num" --add-label stuck --remove-label fix; continue; fi
    gh pr comment "$num" --body "runner: fix attempt $((tries + 1)) by $WORKER"
    wd="$RUNS/pr-$num"; rm -rf "$wd"; git worktree prune
    git fetch -q origin "$br" && git worktree add -q "$wd" "origin/$br" && (cd "$wd" && git switch -q -C "$br")
    fix_prompt "$num" > "$wd.prompt"
    run_agent "$wd" "$wd.prompt" "$wd.out"; rc=$?
    [ $rc = 75 ] && { log "limit — sleep 20m"; sleep 1200; continue; }
    (cd "$wd" && git push -q --force-with-lease origin "$br") && log "PR #$num fix pushed" || log "PR #$num: nothing pushed"
    git worktree remove --force "$wd"; continue
  fi

  issue=$(pick_issue) || { log "queue empty — sleep 3m"; sleep 180; continue; }
  num=$(jq -r .number <<<"$issue"); title=$(jq -r .title <<<"$issue")
  feat=$(echo "$title $(jq -r '[.labels[].name] | join(" ")' <<<"$issue")" | grep -oE 'F[0-4]' | head -1); feat=${feat:-F0}
  gh issue edit "$num" --add-label in-progress >/dev/null
  gh issue comment "$num" --body "runner: взяв $WORKER ($AGENT)" >/dev/null
  br="feat/$feat-$num"; wd="$RUNS/issue-$num"
  rm -rf "$wd"; git worktree prune
  git worktree add -q -B "$br" "$wd" origin/main
  (cd "$wd/web" && [ -d "$REPO_DIR/web/node_modules" ] && ln -s "$REPO_DIR/web/node_modules" node_modules)
  prompt_for "$num" "$title" "$feat" "$(jq -r .body <<<"$issue")" > "$wd.prompt"
  log "#$num $title → $br"
  run_agent "$wd" "$wd.prompt" "$wd.out"; rc=$?
  if [ $rc = 75 ]; then
    log "limit — return #$num, sleep 20m"; gh issue edit "$num" --remove-label in-progress >/dev/null
    git worktree remove --force "$wd"; sleep 1200; continue
  fi
  if [ "$(cd "$wd" && git rev-list --count origin/main..HEAD)" -gt 0 ]; then
    (cd "$wd" && git push -q -u origin "$br")
    body="$(cat "$wd.out")"$'\n\n'"Closes #$num"
    gh pr create --base main --head "$br" --title "$feat: ${title#F[0-4]: } (#$num)" --body "$body" >/dev/null && log "#$num PR opened"
  else
    gh issue edit "$num" --add-label stuck --remove-label in-progress >/dev/null
    gh issue comment "$num" --body "runner: $WORKER нічого не закомітив (код $rc). Хвіст логу:"$'\n```\n'"$(tail -30 "$wd.out")"$'\n```' >/dev/null
    log "#$num stuck"
  fi
  git worktree remove --force "$wd"
  [ -n "${ONCE:-}" ] && { log "ONCE — exit"; exit 0; }
done
log "STOP file — exit"
