---
name: pr-video
description: Create a short Zundamon × Metan explainer MP4 for a pull request and attach it. Use when the user asks for a PR video, a PR 用の解説動画, or a video walking reviewers through a branch's changes.
---

# pr-video

Turn a pull request (or the current branch's changes) into a short exported MP4 that walks reviewers through the change. This skill is glue around two others — the `presentation` skill run in its **light profile** (deck construction) and the `export` skill (MP4 render); read both, this file only adds the PR-specific parts.

## Inputs

- With a PR: `gh pr view <number> --json title,body,url,baseRefName` and `gh pr diff <number>`.
- No PR yet: the branch — `git log --oneline <base>..HEAD` and `git diff <base>...HEAD` (merge-base diff).
- Commit messages either way — they often carry the why that the diff doesn't.

## Subject and reader

The `presentation` skill has both agreed with the user before the outline exists. For a PR video they are fixed by the format, so take them from here instead of asking. These two lines are the field values — copy them into `outline.md` as they stand:

```
Subject: この PR の変更内容 — 何をして、なぜその形なのか
Reader: このリポジトリのレビュアー。コードベース・言語・ツールには通じているが、この変更は見ていない
```

What the Subject excludes is where it gets crossed, and the worst of it is **review history** — what a reviewer objected to and how it was fixed. It describes the process that produced the change rather than the change: the fix is already in the diff the viewer is about to read, and nothing they have to decide turns on how it got there. If the correction matters, the current design carries it without the story. Same for how the branch was developed and dead ends hit on the way. All of it is the freshest material in mind, which is why it gets mistaken for the change; it belongs in `context.md` or nowhere. A **rejected design option is not that** — it belongs in the deck whenever it explains why the change has the shape it has. The test is what the option is doing in the sentence: explaining the current design (in), or recounting the order events happened in (out).

The outline-checker's audience+goal framing derives from these two. Go back to the user only when the request contradicts them — someone asking for a video about how the change was arrived at is asking for a different subject, not for this one.

## Deck

- Deck dir: `.zunda-presenter/pr-<number>/`; without a PR number, `pr-<branch-slug>`.
- Build per the `presentation` skill, **light profile**.
- The video complements the diff, it does not replace it: the spine is *why the change is shaped the way it is*. Beats that earn slides: the motivation / problem, the shape of the change (one diagram of the touched areas), key decisions and rejected alternatives, and what deserves close review (risks, the tricky hunks). Never narrate the diff file-by-file — that is structure.md's source-order transcription failure mode, and the diff already shows the what better than a video can.
- If the PR's reviewers read only English, this format (Japanese dialogue) is the wrong tool — say so instead of exporting.

## Export & attach

Synthesize and export per the `export` skill (output: `<deck>/export.mp4`). Then:

1. Check the size (`ls -lh`). GitHub's attachment limits for video are 10MB on free plans and 100MB on paid plans (docs.github.com, "Attaching files"); if the file exceeds the repo's limit, re-export smaller: `PRESENTER_VIDEO_HEIGHT=720 npm run export`.
2. Posting is public and on the user's account: show them the comment body and ask before running it. Then attach with `gh pr comment <number> --body "<one line saying what the video is and how long it runs>" --attach <path to export.mp4>`; the upload renders as an inline player (video takes no alt text, so the `#alt` suffix is images-only). Default to a comment — `gh pr edit <number> --attach ...` puts the player at the end of the description instead, but only use it if the user asks for the description.
3. If the attach is unavailable or fails — a `gh` too old for `--attach` (check `gh pr comment --help`), GitHub Enterprise Server, or no push access to the repo — fall back to the manual path: give the user the absolute path to `export.mp4` and tell them to drag it into the PR description or a comment. Do not commit the mp4 to the repo, and do not upload it anywhere else as a workaround.
