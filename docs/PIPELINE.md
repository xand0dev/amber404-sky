# Конвеєр агентів — AMBER Sky (v1, 27.11)

**Навіщо.** Олександр сб 9–18 і нд 9–15 на парах. Код пишуть агенти без людини поруч: беруть задачу з черги, роблять PR, CI перевіряє, зелений PR зливається сам. Людина лише відповідає на питання й дивиться превʼю.

**Правило старту.** Усе нижче — опис. Скрипти й workflows пише агент **після 19:00 Київ** у репо `amber404-sky` (F0). З MARS404 беремо ідеї, а не код.

---

## 1. Схема

```
Issues (мітка agent, пріоритет p0/p1/bug)
   │  runner бере найстаршу незаблоковану
   ▼
3 воркери (кожен — свій акаунт)  ──►  git worktree + гілка feat/F<N>-<issue>
   │  агент без питань: тести → код → make check → push → PR
   ▼
CI (check + guard)  ──зелений──►  automerge squash ──►  deploy Pages
   │червоний                         │ спільні файли
   ▼                                 ▼
мітка fix → воркер чинить        мітка shared → рев'ю Олександра/Олі
```

## 2. Три воркери = три акаунти

| Воркер | Акаунт | Команда (без підтверджень) | Бере |
|---|---|---|---|
| `w1` | Claude, акаунт 1 | `claude -p "<промпт>" --permission-mode bypassPermissions --max-turns 80` | p0, p1 (F0, F3, F4 — складне) |
| `w2` | Claude, акаунт 2 (`CLAUDE_CONFIG_DIR=~/.claude-acc2`) | те саме | p1, bug |
| `w3` | ChatGPT Plus (Codex) | `codex exec --full-auto "<промпт>"` | тести, pipeline на Python, доки, `fix` |

- `-p` / `exec` — **неінтерактивний режим: агент нічого не питає**, працює до кінця й виходить. Саме це прибирає «зупинився й питає».
- Обхід підтверджень — лише всередині окремого worktree в `~/amber-runs/`, без доступу до `.env` і ключів. Секрет CDS — тільки в GitHub Secrets, агенту не потрібен.
- Ліміт підписки вичерпано (вихід з помилкою rate/usage limit) → воркер повертає задачу в чергу, спить 20 хв, пробує знову. Інші два працюють далі.

## 3. Runner (`scripts/runner.sh`, пише F0 о 19:30)

Цикл кожного воркера:
1. `git fetch` → взяти найстаршу відкриту issue з міткою `agent`, без `in-progress`, без `blocked`, у якої всі «після #N» уже закриті. Порядок: `bug` → `p0` → `p1`.
2. Поставити мітку `in-progress` і коментар «взяв w1».
3. `git worktree add ~/amber-runs/<issue> -b feat/F<N>-<issue> origin/main`.
4. Запустити агента з промптом §4, таймаут 45 хв.
5. Якщо є коміти: push, `gh pr create` (не draft), у тілі — «Closes #<issue>».
   Якщо комітів нема: мітка `stuck` + останні 30 рядків логу в коментар issue.
6. Прибрати worktree, лог — у `~/amber-runs/logs/`. Наступна задача.

Запуск на ніч / на день (Mac на зарядці, не засинає):
```
caffeinate -dimsu ./scripts/runner.sh w1 &   # у трьох вкладках терміналу: w1, w2, w3
```
Фіксер: той самий runner з режимом `fix` бере PR з червоним CI **або з конфліктом з main** (мітка `fix`, ставить automerge) і просить агента полагодити саме цей PR: rebase на свіжий main, потім `make check`. Не більше 2 спроб на PR → далі мітка `stuck`.

## 4. Промпт агента (один для всіх)

```
You are working in repo amber404-sky, issue #{N}: {title}.
Read CONSTITUTION.md, AGENTS.md, docs/SPEC.md and the spec file linked in the issue.
Implement ONLY this issue's acceptance criteria.
Rules:
- Never ask questions. If something is unclear, choose the option closest to SPEC,
  write it under "Assumptions" in the PR body, and continue.
- Write tests first (red), then code (green). Pure logic goes to web/src/core.
- Touch only the paths of feature F{X} (see SPEC §9). Missing contract field →
  add a TODO + note under "Contract requests" in the PR body, use mocks.
- Run `make check` until it passes. Do not disable tests or lint rules.
- Do not edit docs/AI_LOG.md (parallel PRs conflict). Put the AI log line in the PR body.
- Commit with message "F{X}: {short}" (no agent signatures).
- PR body: table AC → ✅/❌ + how checked; Assumptions; Contract requests.
```

## 5. GitHub (F0, до 21:30)

- **CI** на PR: `make check` (lint, types, tests, build) + **guard**: гілка `feat/F<N>-…` чіпає лише свої шляхи з SPEC §9. Чужа папка → червоний.
- **Automerge** (`workflow_run` після CI): зелений, не draft, head не змінився, без спільних файлів → squash + видалити гілку + deploy. Спільні файли → мітка `shared`, зливає людина.
- **Main захищений:** лише через PR. Pages деплоїться з main.
- **Превʼю PR:** артефакт збірки або Pages-превʼю — посилання в коментарі PR (щоб дивитися з телефона).
- Мітки: `agent`, `p0`, `p1`, `bug`, `in-progress`, `blocked`, `fix`, `stuck`, `shared`, `question`.

## 6. Черга (Олександр, пт 21:30–23:00)

- 15–25 issues з F1–F5. Одна issue = 1–4 AC, одна фіча, ≤ 2 год роботи агента.
- Тіло: посилання на `specs/F<N>/spec.md`, AC дослівно, файли, «після #N», якщо є залежність.
- Спершу p0 для вертикального зрізу (карта → точка → вердикт), потім p1.
- Задачі, що чіпають ті самі файли, ланцюжком через «після #N» — тоді два воркери не конфліктують.

## 7. Хто що робить, поки Олександр на парах

| Хто | Що |
|---|---|
| Runner | бере задачі, робить PR, чинить червоний CI |
| Automerge | зливає зелені PR без спільних файлів |
| Оля (чергова F0) | раз на 1–2 год: `shared` → рев'ю й злити; `stuck` → переписати issue простіше й зняти мітку; відповісти на «Assumptions», якщо не так |
| Максим | синк о 10:00; перевіряє превʼю на телефоні як оператор; нові баги → issue з `agent`+`bug` |
| Олександр | перерва 5 хв: превʼю main → одна issue з правкою або «ок». Більше нічого |

## 8. Стоп-крани

- Сб 23:00 — з черги знімаємо всі `p1`, що не почалися. Далі лише `bug`.
- Нд 11:00 — runner зупиняємо (`pkill -f runner.sh`); зливаємо тільки критичні баги руками.
- Якщо main зламався: Оля робить revert останнього PR, issue → `bug`.
- Runner падає / Mac вимкнувся: план Б — хмарні сесії Claude Code з телефона (claude.ai/code) на ту саму issue з тим самим промптом, і Codex у застосунку ChatGPT.

## 9. Перевірка конвеєра (пт до 23:00)

- [ ] Тестова issue «додати рядок у README» проходить увесь шлях: runner → PR → CI → automerge → Pages, без жодного кліку.
- [ ] PR з чужою папкою — червоний guard.
- [ ] PR зі спільним файлом — мітка `shared`, не злитий.
- [ ] Усі три воркери залогінені й узяли по задачі.
