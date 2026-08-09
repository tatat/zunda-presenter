---
name: pr-video
description: Create a short Zundamon × Metan explainer MP4 for a pull request and guide attaching it. Use when the user asks for a PR video, a PR 用の解説動画, or a video walking reviewers through a branch's changes.
---

# pr-video

Turn a pull request (or the current branch's changes) into a short exported MP4 that walks reviewers through the change. This skill is glue around two others — the `presentation` skill run in its **light profile** (deck construction) and the `export` skill (MP4 render); read both, this file only adds the PR-specific parts.

## Inputs

- With a PR: `gh pr view <number> --json title,body,url,baseRefName` and `gh pr diff <number>`.
- No PR yet: the branch — `git log --oneline <base>..HEAD` and `git diff <base>...HEAD` (merge-base diff).
- Commit messages either way — they often carry the why that the diff doesn't.

The **viewer is a reviewer**: they know the codebase, they will read the diff themselves, and they don't know this change yet. Adapt that sentence into the audience+goal framing given to the outline-checker.

## Deck

- Deck dir: `.zunda-presenter/pr-<number>/`; without a PR number, `pr-<branch-slug>`.
- Build per the `presentation` skill, **light profile**. Sizing follows that skill's normal guidance — a small fix earns a short deck, a large PR may earn a longer one.
- The video complements the diff, it does not replace it: the spine is *why the change is shaped the way it is*. Beats that earn slides: the motivation / problem, the shape of the change (one diagram of the touched areas), key decisions and rejected alternatives, and what deserves close review (risks, the tricky hunks). Never narrate the diff file-by-file — that is structure.md's source-order transcription failure mode, and the diff already shows the what better than a video can.
- Dialogue is Japanese as usual. If the PR's reviewers read only English, this format is the wrong tool — say so instead of exporting.

## Export & attach

Synthesize and export per the `export` skill (output: `<deck>/export.mp4`). Then:

1. Check the size (`ls -lh`). GitHub's attachment limits for video are 10MB on free plans and 100MB on paid plans (docs.github.com, "Attaching files"); a mostly-static deck render is usually a few MB, but if it exceeds the repo's limit, re-export smaller: `PRESENTER_VIDEO_HEIGHT=720 npm run export`.
2. Attaching cannot be automated: GitHub accepts inline-playable video only via the web UI's drag-and-drop — there is no public API for it, and `gh` cannot upload comment attachments. Give the user the absolute path to `export.mp4` and tell them to drag it into the PR description or a comment. Do not commit the mp4 to the repo, and do not upload it anywhere else as a workaround.
