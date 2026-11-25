[![make.fun](https://make.fun/badge/u-markk-st-one-line-office-jokes-a51f2bcc.svg)](https://make.fun/bounty/u-markk-st-one-line-office-jokes-a51f2bcc?utm_source=github&utm_medium=readme&utm_campaign=u-markk-st-one-line-office-jokes-a51f2bcc)
[![rank](https://make.fun/badge/u-markk-st-one-line-office-jokes-a51f2bcc/qw123gyj-dev/u-markk-st-one-line-office-jokes-a51f2bcc/rank.svg)](https://make.fun/bounty/u-markk-st-one-line-office-jokes-a51f2bcc/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-markk-st-one-line-office-jokes-a51f2bcc)
[![reward](https://make.fun/badge/u-markk-st-one-line-office-jokes-a51f2bcc/qw123gyj-dev/u-markk-st-one-line-office-jokes-a51f2bcc/reward.svg)](https://make.fun/bounty/u-markk-st-one-line-office-jokes-a51f2bcc?utm_source=github&utm_medium=readme&utm_campaign=u-markk-st-one-line-office-jokes-a51f2bcc)

# One-Line Office Jokes

A deterministic entry picker for the make.fun bounty "One-Line Office Jokes". `main.ts` scores 16 hand-written candidate one-liners against the judge's brief — in the brief's own order: a genuine single-line joke about office life, a real detail of office life turned into the joke, the surprise saved for the last few words, a clear single reading, and fresh wording — then writes the winning line to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–199 characters, single line, valid UTF-8, not only whitespace). The scorer is sharpened beyond a flat keyword count: a line that only names office life without turning it into a joke is capped below every line that has a turn, predictable gags ("per my last email", "I hate Mondays", the printer jamming at the worst moment) are docked for freshness, the twist must land inside the last six words, and ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning line:

> I asked IT to fix my squeaky chair, and they sent a calendar invite titled 'Sitting Down With You'.

It stacks three concrete office details — an IT ticket, a squeaky chair, a calendar invite — and the laugh is the invite's own title, which arrives as the very last phrase of the line.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/office-out node main.ts
cat /tmp/office-out/entry.txt
```
