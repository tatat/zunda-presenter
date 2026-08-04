# Export character sprites (expression x mouth open/close) from the
# PSDTool-style layer PSDs in assets/raw/ into public/assets/.
# Radio groups ("!name") contain exclusive options ("*name"); each expression
# picks eyes/brows/mouth, everything else stays at the artist's defaults.
# Output: public/assets/{char}_{expression}_{close|open}.png
# Run: tools/pyenv/bin/python tools/export_sprites.py

from psd_tools import PSDImage
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets"
OUT_HEIGHT = 900

# NOTE: the two PSDs use visually similar but distinct glyphs for eye options
# (zundamon "〇〇" U+3007 vs metan "○○" U+25CB) — copy names exactly.
CHARS = {
    "zundamon": {
        "psd": ROOT / "assets/raw/zundamon/ずんだもん立ち絵素材2.3/ずんだもん立ち絵素材2.3.psd",
        "base": {"!顔色": "ほっぺ", "!枝豆": "枝豆通常"},
        "expressions": {
            "normal":    {"!眉": "普通眉",   "!目": "目セット", "mouth": {"close": "むふ", "open": "ほあ"}},
            "happy":     {"!眉": "普通眉",   "!目": "にっこり", "mouth": {"close": "むふ", "open": "ほあー"}},
            "surprised": {"!眉": "上がり眉", "!目": "〇〇",     "mouth": {"close": "お",   "open": "んあー"}},
            "troubled":  {"!眉": "困り眉1",  "!目": "なごみ目", "mouth": {"close": "んー", "open": "んへー"}},
            "smug":      {"!眉": "普通眉",   "!目": "ジト目",   "mouth": {"close": "むー", "open": "んあー"}},
        },
    },
    "metan": {
        "psd": ROOT / "assets/raw/metan/四国めたん立ち絵素材2.1/四国めたん立ち絵素材2.1.psd",
        "base": {"!顔色": "普通2"},
        "expressions": {
            "normal":    {"!眉": "太眉ごきげん", "!目": "目セット", "mouth": {"close": "ほほえみ", "open": "わあー"}},
            "happy":     {"!眉": "太眉ごきげん", "!目": "目閉じ",   "mouth": {"close": "ほほえみ", "open": "わあー"}},
            "surprised": {"!眉": "太眉ごきげん", "!目": "○○",       "mouth": {"close": "お",       "open": "▽"}},
            "troubled":  {"!眉": "太眉こまり",   "!目": "見上げ",   "mouth": {"close": "む",       "open": "うえー"}},
            "smug":      {"!眉": "太眉ごきげん", "!目": "目セット", "mouth": {"close": "にやり",   "open": "▽"}},
        },
    },
}


def find_group(psd, name):
    for layer in psd:
        if layer.is_group() and layer.name == name:
            return layer
    raise KeyError(f"group not found: {name}")


def choose(group, option):
    hit = False
    for child in group:
        base = child.name.lstrip("*")
        if base == option:
            child.visible = True
            hit = True
        elif child.name.startswith("*"):
            child.visible = False
    if not hit:
        raise KeyError(f"option '{option}' not in group '{group.name}'")


def export(name, spec):
    psd = PSDImage.open(spec["psd"])
    for group_name, option in spec["base"].items():
        choose(find_group(psd, group_name), option)
    for expr, parts in spec["expressions"].items():
        for group_name, option in parts.items():
            if group_name == "mouth":
                continue
            choose(find_group(psd, group_name), option)
        for state, mouth in parts["mouth"].items():
            choose(find_group(psd, "!口"), mouth)
            img = psd.composite(force=True)
            scale = OUT_HEIGHT / img.height
            img = img.resize((round(img.width * scale), OUT_HEIGHT))
            out = OUT / f"{name}_{expr}_{state}.png"
            img.save(out)
            print(f"{out.relative_to(ROOT)}")


OUT.mkdir(parents=True, exist_ok=True)
for name, spec in CHARS.items():
    export(name, spec)
