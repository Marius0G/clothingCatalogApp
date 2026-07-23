# Spike: Improving the Outfit Recommendation Engine

*Research spike, 2026-07-16. No code changes — findings + proposed direction.*

## 1. How it works today

One edge function, `supabase/functions/recommend-outfits/index.ts`, does everything in a single LLM call:

1. Pulls **all** the user's items (`wishlist` + `wardrobe` alike) with only `id, title, category, subcategory, colors, style_tags, brand, status`. Requires ≥ 4 items (422 otherwise).
2. Builds one prompt: "You are a personal stylist. Combine ONLY the wardrobe items below into 3 outfits" + slot rules (max one bottom/shoes/dress, dress ≠ top+bottom) + `profiles.style_preferences` (a single free-text blob from onboarding) + the full item list as JSON.
3. Calls Featherless `Qwen/Qwen2.5-72B-Instruct` (temp 0.6, 900 max tokens), parses with `OutfitRecsSchema` (zod: 1–5 outfits × 2–6 item ids + occasion + rationale), plus a structural validator (real ids, slot constraints). 2 attempts, then 502.
4. Caches the payload in `recommendations` for 7 days keyed on a hash of items + preferences + locale; logs to `ai_usage` (cap 20 calls/user/day).

Client side: `src/features/recs/` + `src/app/discover.tsx`. The only user control is **Regenerate**. The thumbs up/down buttons on outfit cards are **dead local state** — never persisted. There is no saved-outfits table, no wear log, no occasion/weather/season input anywhere in the repo. Home's "Outfits" / "AI Looks" stats are hardcoded to 0.

Item attributes come from `tag-item` (Qwen2.5-VL-72B on the photo): title, brand, category (6-value enum), free-text localized subcategory, up to 4 localized color names, up to 6 style tags from a soft vocabulary. **No** season, formality, warmth, material, pattern, fit — and no embeddings/pgvector.

### The main weaknesses

| Gap | Consequence |
|---|---|
| Localized free-text attributes (`colors`, `subcategory`, `style_tags` in ro *or* en) | Can't filter, score, or compare items programmatically; LLM must re-infer everything |
| No occasion/weather/season input | "3 generic outfits" regardless of context; the `occasion` field is an *output* label, not an input |
| Whole wardrobe in prompt | Doesn't scale past a prompt-sized wardrobe; no ranking or retrieval |
| Wishlist items mixed in as candidates | Recommends outfits the user cannot actually wear |
| Feedback discarded, outfits ephemeral | No personalization flywheel; nothing learns |
| Single LLM opinion, no scoring | Quality is whatever the model emits first; no color/formality/warmth checks |

## 2. What the industry / research does

- **Hybrid retrieval + scoring** ([Loom, arXiv 2605.09830](https://arxiv.org/pdf/2605.09830)): retrieve candidates per *slot* (top/bottom/shoes) via FashionCLIP embedding ANN search, then score candidate outfits with six signals — embedding similarity, **color harmony, formality consistency, occasion coherence, style direction, within-outfit diversity** — plus **material compatibility**, which their evaluation found mattered most. FashionCLIP + pgvector (HNSW, cosine) searches ~500 items in ~5 ms ([Width.ai](https://www.width.ai/post/product-similarity-search-with-fashion-clip)).
- **Attribute taxonomies** ([Ximilar fashion tagging](https://docs.ximilar.com/tagging/fashion), [LookBench](https://arxiv.org/pdf/2601.14706)): commercial taggers assign per-category attribute sets (10–25 attrs) covering color, material, pattern, fit/cut, length, style, gender — structured enums, not free text.
- **Compatibility ML** ([survey, arXiv 2306.03395](https://arxiv.org/pdf/2306.03395), [ASOS](https://medium.com/asos-techblog/automated-outfit-generation-with-deep-learning-8f0eacc0ea86), [OutfitTransformer / experimental study](https://arxiv.org/pdf/2211.16353)): learn a latent style space where compatible items are close. Needs training data volume we don't have — relevant later, not now.
- **User-in-the-loop personalization** ([arXiv 2402.11627](https://arxiv.org/abs/2402.11627), [BPR-based approaches](https://www.sciencedirect.com/science/article/abs/pii/S0306457323001711)): systems that ingest likes/dislikes/wear events and update a preference profile beat static ones. The cheapest version: store feedback and feed it back into the prompt as few-shot evidence.
- **Stylist-app onboarding** ([Klodsy comparison](https://klodsy.com/blog/best-ai-stylist-apps-2026-comparison/), [Elara](https://joinelara.com/blog/ai-personal-stylist-guide)): the standard asks are occasions/lifestyle, style direction, color preferences (sometimes full seasonal color analysis), body shape, no-go items — then continuous learning from likes/saves/wears.
- **Menswear/styling heuristics** ([3-color rule](https://thevou.com/blog/3-color-rule-outfits/), [color wheel matching](https://www.realmenrealstyle.com/color-wheel-menswear/)): neutrals as base (60/30/10), max ~3 colors with one accent, complementary color only as the small piece, formality must be consistent across items. These are *encodable as deterministic rules*.
- **Models**: Featherless now serves [Qwen3-VL (4B–32B)](https://featherless.ai/models?capabilities=vision-language-model) — a straight upgrade path for `tag-item`; docs at [featherless.ai/docs/vision](https://featherless.ai/docs/vision).

## 3. Proposed improvements

### 3.1 Item schema — structured, canonical-English attributes

Keep the 6-category enum; add columns (all extracted by the existing `tag-item` vision call with an extended prompt + zod schema, localized only at display time via i18n):

| Column | Type | Values |
|---|---|---|
| `colors` | enum[] (canonical EN) | black, white, grey, beige, cream, navy, blue, light-blue, red, burgundy, pink, purple, green, olive, yellow, orange, brown, tan, gold, silver, multicolor |
| `color_role` | enum | neutral \| accent (derivable from colors, worth storing) |
| `pattern` | enum | solid, stripe, check, floral, print, melange, denim-wash, other |
| `material` | enum | cotton, denim, wool, knit, linen, leather, suede, synthetic, silk, fleece, other/unknown |
| `fit` | enum | slim, regular, relaxed, oversized, straight, wide |
| `formality` | int 1–5 | 1 gym/lounge · 2 casual · 3 smart-casual · 4 business · 5 formal |
| `warmth` | int 1–5 | 1 summer-only … 5 heavy winter |
| `seasons` | enum[] | spring, summer, autumn, winter (derivable from warmth but explicit is simpler) |
| `occasions` | enum[] | everyday, office, evening-out, sport, beach, event/festive, home |
| `layer` | enum | base, mid, outer, none (shoes/accessories) — enables layering logic |
| `subcategory` | **canonical EN slug** (t-shirt, shirt, jeans, chinos, sneakers…) | display-localized |

`style_tags` stays but from a **closed English vocabulary**. Since migration 0004 this is the 20-slug list shared with user preferences (minimal, smart-casual, casual, old-money, quiet-luxury, streetwear, business, business-casual, classic, scandinavian, vintage, sporty, athleisure, y2k, grunge, preppy, boho, elegant, edgy, trendy) — see `StyleTagSchema` in `supabase/functions/_shared/types.ts`; the old 12-tag data was remapped in SQL, no AI re-tagging needed.

This single change unlocks everything downstream: SQL prefiltering, deterministic scoring, cache keys per occasion, and a far denser prompt (structured JSON instead of the LLM re-guessing from a title).

### 3.2 What to ask the user

**Per-request (Discover screen controls):**
- **Occasion picker** — chips: Everyday / Office / Evening out / Sport / Event / Travel. This is the single highest-impact input.
- **Weather** — automatic: device location (coarse) → [Open-Meteo](https://open-meteo.com/) (free, no API key) → temp band + rain flag passed to the engine. Fallback: manual season toggle. New capability, nothing exists in the repo today.
- **"Build around this item"** — anchor an outfit on a selected wardrobe item (entry point from the item detail screen).
- Optional: exclude-from-rotation ("in laundry"), mood ("something bolder today").

**Onboarding / profile additions (all optional, don't bloat the flow):**
- Lifestyle mix: "How many days/week do you need office vs casual vs sport outfits?" — turns into occasion priors.
- No-go list: things they never wear (heels, skirts, shorts, bright colors…).
- Body shape + preferred fits (optional screen; industry standard but sensitive — keep skippable).
- Later: seasonal color analysis from a selfie (Qwen3-VL can do this) — a differentiating premium feature, not core.

**Continuous feedback (the flywheel — currently thrown away):**
- Persist the existing thumbs up/down (`outfit_feedback` table: user_id, outfit payload/hash, vote, occasion, created_at).
- **Save outfit** → `outfits` + `outfit_items` tables (also fixes the hardcoded-0 Home stats, enables the unused `seeOutfit` i18n strings).
- **"Wore it"** log → per-item `times_worn`, `last_worn_at` — enables rotation ("you haven't worn this in a while"), cost-per-wear later.

### 3.3 Engine architecture — a ladder, not a rewrite

**Stage A — better single call (days, do first).** Keep one LLM call but: wardrobe-only items (exclude wishlist, or label them "consider suggesting as purchase"), structured attributes in the item JSON, occasion + weather + no-go list as prompt inputs, generate 5–6 outfits with an explicit diversity instruction, and extend `structurallyValid` into a **rule scorer** that filters/re-ranks before returning:
- *Color*: ≤ 3 color families, ≥ 1 neutral base, complementary pairs only if one is a small piece (3-color rule).
- *Formality*: max spread of 1 level across items.
- *Weather*: outfit's min/max `warmth` compatible with the temp band; `layer=outer` present when cold, absent when hot.
- *Slots*: existing rules + shoes required for outfits leaving the house.
- *Diversity*: across the returned set, don't reuse the same anchor item in every outfit.

Ask for 6, score, show the best 3–4 with score-derived confidence. Deterministic, free, and it converts "whatever the LLM said" into "verified outfits". This is essentially Loom's scoring layer without the ML.

**Stage B — retrieve-then-compose (when wardrobes grow).** SQL prefilter candidates by occasion/season/warmth/status before prompting (mirrors what `recommend-purchases` already does with its 80-candidate limit). Keeps the prompt bounded and pre-solves context fit.

**Stage C — feedback-aware prompting.** Inject stored signals: "User liked: [outfit items]. Disliked: [items]. Most-worn: X, Y. Never picks: Z." Few-shot personalization for free — no ML infra. This is the pragmatic version of the user-in-the-loop literature.

**Stage D — embeddings (only if/when needed).** pgvector + FashionCLIP per item image for slot-constrained retrieval and a compatibility signal. Requires an embedding endpoint (FashionCLIP isn't on Featherless — HuggingFace Inference or a tiny hosted service). At < 200 items/wardrobe, Stages A–C likely make this unnecessary; revisit for the catalog/purchase side where scale is real (it would also power visual dedup and "similar cheaper item").

**Stage E — trained ranking model.** BPR/logistic over attributes using accumulated feedback. Needs thousands of feedback events; park it.

**On agents:** a multi-agent loop (stylist agent + critic agent + tools) is the wrong cost/latency tradeoff at a 20-calls/user/day budget. A *pipeline* — deterministic prefilter → one composer LLM call → deterministic scorer → (optional) one repair call when everything scores poorly — gets ~the same quality at 1–2 calls. The retry-with-error-feedback loop that already exists is the right pattern; extend it so the scorer's complaints (not just JSON errors) drive the second attempt.

**Model upgrades:** bump `VISION_MODEL` to a Qwen3-VL variant for tagging accuracy (env change + eval on a handful of items). Text model stays; the win is in inputs and validation, not model size.

### 3.4 Suggested sequencing

1. **Persist feedback + saved outfits** (schema + wire the existing buttons) — starts collecting data immediately, cheapest.
2. **Attribute schema v2 + canonical vocab** in `tag-item` + migration + backfill.
3. **Occasion picker + weather** (Open-Meteo) as inputs; include them in the cache `input_hash`.
4. **Prompt v2 + rule scorer** (Stage A) in `recommend-outfits`.
5. **Feedback few-shots** (Stage C) once data exists.
6. Stage B/D/E as scale demands.

## Sources

- [Loom: hybrid retrieval-scoring outfit recommendation](https://arxiv.org/pdf/2605.09830) · [Loom Style writeup](https://medium.com/@anushreeberlia1/loom-style-automating-outfit-generation-d1548cad7c75)
- [Computational Technologies for Fashion Recommendation: A Survey](https://arxiv.org/pdf/2306.03395)
- [TATTOO: training-free aesthetic-aware outfit recommendation](https://arxiv.org/pdf/2509.23242) · [CFALR: CF-augmented LLM outfit recommendation](https://arxiv.org/pdf/2606.13001) · [Outfit Generation and Recommendation — An Experimental Study](https://arxiv.org/pdf/2211.16353)
- [ASOS: automated outfit generation with deep learning](https://medium.com/asos-techblog/automated-outfit-generation-with-deep-learning-8f0eacc0ea86)
- [Interactive Garment Recommendation with User in the Loop](https://arxiv.org/abs/2402.11627) · [Personalized outfit generation with coordination preference learning](https://www.sciencedirect.com/science/article/abs/pii/S0306457323001711)
- [Ximilar fashion tagging taxonomy](https://docs.ximilar.com/tagging/fashion) · [WisePIM clothing taxonomy guide](https://wisepim.com/guides/product-categorization/fashion) · [LookBench fashion retrieval benchmark](https://arxiv.org/pdf/2601.14706)
- [FashionCLIP vs CLIP for product similarity (Width.ai)](https://www.width.ai/post/product-similarity-search-with-fashion-clip)
- [Klodsy: AI stylist apps 2026 comparison](https://klodsy.com/blog/best-ai-stylist-apps-2026-comparison/) · [Elara: AI personal stylist guide](https://joinelara.com/blog/ai-personal-stylist-guide)
- [The VOU: 3-color rule](https://thevou.com/blog/3-color-rule-outfits/) · [RMRS: color wheel for outfits](https://www.realmenrealstyle.com/color-wheel-menswear/) · [Gentleman Within: mixing clothing colors](https://www.gentlemanwithin.com/how-to-mix-and-match-clothing-colors-for-men/)
- [Featherless vision docs](https://featherless.ai/docs/vision) · [Featherless VLM catalog (Qwen3-VL)](https://featherless.ai/models?capabilities=vision-language-model)
