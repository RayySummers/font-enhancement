// ==UserScript==
// @name         Font Enhancement (Roboto Flex & Segoe UI Variable)
// @name:zh-CN   Font Enhancement (Roboto Flex & Segoe UI Variable)
// @namespace    rayy.font-enhance
// @version      1.4.0
// @description  Replace Roboto / bare sans-serif with Roboto Flex, Inter with Inter Display (>=24px) and Segoe UI with Segoe UI Variable (Windows 11); replace SF Mono with Sarasa Mono SC (including code areas); appends Noto Sans SC / Source Han Sans SC as CJK fallback. Preserves explicitly chosen fonts such as Inter.
// @description:zh-CN  将 Roboto / 裸 sans-serif 替换为 Roboto Flex、Inter(≥24px)替换为 Inter Display、Segoe UI 替换为 Segoe UI Variable(Windows 11)、SF Mono 替换为 Sarasa Mono SC(含代码区域),并为缺少中文字体的网站自动追加 Noto Sans SC / Source Han Sans SC 兜底;尊重站点显式字体选择(如 Inter)。
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/RayySummers/font-enhancement
// @supportURL   https://github.com/RayySummers/font-enhancement/issues
// ==/UserScript==

(() => {
    "use strict";

    /* =========================================================
       Configuration
       ========================================================= */

    const ENABLED = {
        robotoFlex: true,
        interDisplay: true,
        segoeVariable: true,
        cjkFallback: true,
        sarasaMono: true
    };

    // Windows type ramp: the Display instance is meant for headings
    // (20/28/40/68 epx), Text for body sizes. Fonts at or above this
    // computed pixel size use Segoe UI Variable Display instead of Text.
    const SEGOE_DISPLAY_THRESHOLD_PX = 20;

    // Inter Display is a separate variable font family (headline
    // optical sizing). Inter at or above this computed pixel size is
    // replaced with it, keeping Inter as fallback.
    const INTER_DISPLAY_THRESHOLD_PX = 24;

    // Many sites ship Latin-only font stacks, so CJK text falls back
    // to ugly defaults (SimSun). Appended to EVERY stack that has no
    // CJK font of its own — placed BEFORE the generic keyword so the
    // browser reaches it, with the generic as final fallback.
    const CJK_FALLBACK_FAMILIES = ['"Noto Sans SC"', '"Source Han Sans SC"'];

    // Sarasa Mono SC (更纱黑体) replaces SF Mono and is the ONLY
    // transform that also runs inside code areas. It is not on Google
    // Fonts, so it is never loaded remotely: it must be installed
    // locally, and the original SF Mono stays in the stack as the
    // fallback when Sarasa is missing.

    /* =========================================================
       1. Font loading

       Target fonts that are already installed locally (Roboto Flex
       and Inter Display are on this machine) need no external
       request. Anything missing is loaded from Google Fonts lazily.
       Either way the replacement stacks keep the original font as
       a fallback, so a network/CSP failure never loses the site's
       font.
       ========================================================= */

    const REMOTE_FONTS = [
        {
            enabled: () => ENABLED.robotoFlex,
            family: "Roboto Flex",
            css:
                "https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,100..1000&display=swap"
        },
        {
            enabled: () => ENABLED.interDisplay,
            family: "Inter Display",
            css:
                "https://fonts.googleapis.com/css2?family=Inter+Display:wght@100..900&display=swap"
        }
    ];

    function ensureFonts() {
        for (const font of REMOTE_FONTS) {
            if (!font.enabled()) continue;

            let local = false;
            try {
                local = document.fonts?.check?.(`16px "${font.family}"`) === true;
            } catch {
                /* FontFaceSet unavailable — fall through to remote load */
            }

            if (local) continue;

            const fontLink = document.createElement("link");
            fontLink.rel = "stylesheet";

            // Load non-blocking: while a print stylesheet is loading
            // it does not block rendering; switching to "all" right
            // after apply makes the font available without delaying
            // first paint (relevant for users without local copies).
            fontLink.media = "print";
            fontLink.onload = () => {
                fontLink.media = "all";
            };
            fontLink.href = font.css;

            (document.head || document.documentElement).appendChild(fontLink);
        }
    }


    /* =========================================================
       2. Areas that should never be modified

       Note: with closest(), a bare selector covers the element
       AND its whole subtree, so "X *" variants are redundant.

       SKIP_SELECTOR is the full exclusion list. Code areas are a
       deliberate exception: with the mono feature enabled they are
       walked, but ONLY the SF Mono → Sarasa Mono SC transform runs
       there (MONO_ONLY_SELECTOR). Everything else
       (HARD_SKIP_SELECTOR) is pruned and never evaluated.
       ========================================================= */

    const SKIP_SELECTOR = [
        // Code
        "code",
        "pre",
        "kbd",
        "samp",
        "var",

        // Scripts / templates / inert markup
        "script",
        "style",
        "template",
        "noscript",

        // Editors
        ".CodeMirror",
        ".cm-editor",
        ".monaco-editor",
        ".ace_editor",

        // Syntax highlighting
        ".highlight",
        ".hljs",
        ".prism",

        // Math
        ".katex",
        "math",
        "mjx-container",
        ".MathJax",

        // SVG / canvas / charts
        "svg",
        "canvas",
        ".recharts-wrapper",
        ".echarts-for-react",
        ".highcharts-container",
        ".plotly",
        ".vega-embed",

        // Diagrams
        ".mermaid",

        // Icons
        ".material-icons",
        ".material-symbols-outlined",
        ".material-symbols-rounded",
        ".material-symbols-sharp",
        ".fa",
        ".fas",
        ".far",
        ".fal",
        ".fab",

        // Manual exclusion
        "[data-no-roboto-flex]",
        "[data-no-segoe-variable]",

        // Editable regions (closest() covers the subtree)
        '[contenteditable="true"]'
    ].join(",");

    // Code areas: the ONLY part of SKIP_SELECTOR where a transform
    // still runs — exclusively the SF Mono → Sarasa Mono SC
    // replacement. Everything else (icons, SVG, math, editable
    // regions, manual exclusions, ...) is a HARD skip that no
    // transform ever touches.
    const MONO_ONLY_SELECTOR = [
        // Code
        "code",
        "pre",
        "kbd",
        "samp",
        "var",

        // Editors
        ".CodeMirror",
        ".cm-editor",
        ".monaco-editor",
        ".ace_editor",

        // Syntax highlighting
        ".highlight",
        ".hljs",
        ".prism"
    ].join(",");

    const HARD_SKIP_SELECTOR = [
        // Scripts / templates / inert markup
        "script",
        "style",
        "template",
        "noscript",

        // Math
        ".katex",
        "math",
        "mjx-container",
        ".MathJax",

        // SVG / canvas / charts
        "svg",
        "canvas",
        ".recharts-wrapper",
        ".echarts-for-react",
        ".highcharts-container",
        ".plotly",
        ".vega-embed",

        // Diagrams
        ".mermaid",

        // Icons
        ".material-icons",
        ".material-symbols-outlined",
        ".material-symbols-rounded",
        ".material-symbols-sharp",
        ".fa",
        ".fas",
        ".far",
        ".fal",
        ".fab",

        // Manual exclusion
        "[data-no-roboto-flex]",
        "[data-no-segoe-variable]",

        // Editable regions (closest() covers the subtree)
        '[contenteditable="true"]'
    ].join(",");

    // Subtree pruning: with the mono feature enabled, code areas are
    // walked (for the mono-only transform) and only HARD skips are
    // pruned. With it disabled, pruning covers the whole skip list
    // exactly as before.
    const PRUNE_SELECTOR = ENABLED.sarasaMono
        ? HARD_SKIP_SELECTOR
        : SKIP_SELECTOR;


    const ICON_FONT_PATTERN =
        /(font\s*awesome|material\s*(icons|symbols)|glyphicons|icomoon|iconfont|bootstrap-icons|remixicon|feather|octicons)/i;


    /* =========================================================
       3. CSS font-family parsing
       ========================================================= */

    function parseFontFamilies(value) {
        const result = [];
        let current = "";
        let quote = null;

        for (const char of value) {
            if (quote) {
                current += char;

                if (char === quote) {
                    quote = null;
                }

                continue;
            }

            if (char === '"' || char === "'") {
                quote = char;
                current += char;
                continue;
            }

            if (char === ",") {
                if (current.trim()) {
                    result.push(current.trim());
                }

                current = "";
                continue;
            }

            current += char;
        }

        if (current.trim()) {
            result.push(current.trim());
        }

        return result;
    }


    function normalizeFamily(name) {
        return name
            .trim()
            .replace(/^["']|["']$/g, "")
            .trim()
            .toLowerCase();
    }


    /* =========================================================
       4. Transformations

       Each transform mutates the families array in place and
       returns a weight to apply, or null when it changed nothing.
       ========================================================= */

    /* ----- Roboto Flex -----
       CHANGE:
         Roboto, sans-serif        → "Roboto Flex", Roboto, sans-serif
         "Roboto", "Noto Sans SC"  → "Roboto Flex", Roboto, "Noto Sans SC"
         sans-serif                → "Roboto Flex", sans-serif
         sans-serif, Arial         → "Roboto Flex", Arial
       KEEP:
         Inter, Roboto, sans-serif (explicit choice wins)      */
    function transformRobotoFlex(families) {
        if (!ENABLED.robotoFlex) return null;

        // Already replaced (or site already uses it): no-op.
        // This also stops the attribute-observer feedback loop.
        if (families.some(f => normalizeFamily(f) === "roboto flex")) {
            return null;
        }

        const first = normalizeFamily(families[0]);

        if (first === "roboto") {
            families[0] = '"Roboto Flex"';
            families.splice(1, 0, "Roboto");
            return {};
        }

        if (first === "sans-serif") {
            const rest = families.slice(1).join(", ");

            families.length = 0;
            families.push('"Roboto Flex"', rest || "sans-serif");
            return {};
        }

        if (first === "youtube noto") {
            // YouTube player & captions stack: "YouTube Noto", Roboto,
            // Arial, ... — captions inherit this, and the leading
            // YouTube Noto keeps the Roboto transform from firing.
            // Roboto Flex slots in right BEFORE Roboto (replacing its
            // fallback role): YouTube Noto keeps priority — if it ever
            // gains real glyph coverage, it wins, and Roboto Flex is
            // still used for everything that fell through to Roboto.
            const robotoIndex = families.findIndex(f =>
                normalizeFamily(f) === "roboto"
            );

            if (robotoIndex !== -1) {
                families.splice(robotoIndex, 0, '"Roboto Flex"');
                return {};
            }
        }

        return null;
    }


    /* ----- Inter Display -----
       Inter Display is a separate headline-optimized variable font.
       Inter at/above INTER_DISPLAY_THRESHOLD_PX is replaced with it;
       the original Inter stays in the stack as fallback. Below the
       threshold, Inter is left untouched (explicit site choice).

         Inter, sans-serif (14px)  → untouched
         Inter, sans-serif (28px)  → "Inter Display", Inter, sans-serif
         'Segoe UI', Inter (28px)  → Segoe + Inter both replaced      */
    function transformInter(families, sizePx) {
        if (!ENABLED.interDisplay) return null;

        if (sizePx < INTER_DISPLAY_THRESHOLD_PX) return null;

        // Already replaced (or site already uses it): no-op.
        // Also stops the attribute-observer feedback loop.
        if (families.some(f => normalizeFamily(f) === "inter display")) {
            return null;
        }

        let changed = false;

        for (let i = 0; i < families.length; i++) {
            if (normalizeFamily(families[i]) !== "inter") continue;

            changed = true;

            const original = families[i];
            families[i] = '"Inter Display"';
            families.splice(i + 1, 0, original); // keep Inter as fallback
            i++; // skip the inserted fallback
        }

        return changed ? {} : null;
    }


    /* ----- CJK fallback -----
       Appends Noto Sans SC / Source Han Sans SC at the very END of
       stacks that do not already contain a CJK-capable font and whose
       head is NOT a serif family (user preference). Serif stacks —
       `serif`, Times, Georgia, SimSun/Songti, ... — are left alone:
       appending a sans CJK face there would mix serif Latin with
       sans CJK glyphs, and the browser's own generic serif fallback
       (SimSun/宋体) already handles Chinese correctly.
       Stacks that already cover CJK (YaHei, PingFang, Noto, Source
       Han, ...) are left alone — that check also stops the
       attribute-observer feedback loop.                                  */
    const CJK_FONT_PATTERN =
        /(noto sans (sc|cn|cjk|tc|hk|jp|kr)|source han|yahei|pingfang|hiragino|songti|heiti|simsun|simhei|malgun|meiryo|ms (pgothic|gothic)|sans cjk|droid sans fallback|wenquanyi|wqy)/i;

    // Head-of-stack serif detection. "^serif" must not match
    // "sans-serif" (it starts with "sans-"), and "times" covers
    // both "times" and "times new roman".
    const SERIF_HEAD_PATTERN =
        /^(serif|times|georgia|garamond|palatino|book antiqua|minion|baskerville|caslon|didot|bodoni|simsun|songti|宋体|nsimsun|新宋体|pmingliu|ming|batang)/i;

    // Whether "Sarasa Mono SC" actually resolves in the current
    // browser (locally installed — it is never loaded remotely).
    // Probed once at runtime, same pattern as the Segoe Display
    // check. The mono transform inserts the name even when the font
    // is missing (the original SF Mono stays as fallback), so the
    // CJK check must not count an unavailable Sarasa as coverage.
    let sarasaAvailable = null;

    function sarasaInstalled() {
        if (sarasaAvailable === null) {
            try {
                sarasaAvailable =
                    document.fonts?.check?.('16px "Sarasa Mono SC"') === true;
            } catch {
                /* FontFaceSet unavailable — assume not installed */
                sarasaAvailable = false;
            }
        }

        return sarasaAvailable;
    }

    function transformCJK(families) {
        if (!ENABLED.cjkFallback) return null;

        if (families.some(f => {
            const norm = normalizeFamily(f);

            if (CJK_FONT_PATTERN.test(norm)) {
                return true; // site already covers CJK
            }

            // A Sarasa entry usually comes from the mono transform,
            // which inserts the name even when the font is NOT
            // installed locally. It only counts as real CJK coverage
            // (and stops the fallback append) when the font actually
            // resolves — otherwise those stacks would silently lose
            // the Noto Sans SC / Source Han Sans SC fallback.
            return norm === "sarasa mono sc" && sarasaInstalled();
        })) {
            return null; // site covers CJK; also stops feedback loop
        }

        const head = normalizeFamily(families[0] || "");

        if (SERIF_HEAD_PATTERN.test(head)) {
            return null; // serif layout: keep it, browser handles CJK via generic fallback
        }

        families.push(...CJK_FALLBACK_FAMILIES);

        return {};
    }


    /* ----- Segoe UI Variable -----
       Segoe UI Variable Text / Display are the family names Firefox
       actually resolves on Windows 11 (the bare "Segoe UI Variable"
       falls back to sans-serif). Weights ride on font-weight because
       the variable font has no separate Black instance (wght 300-700).
       Which instance is used follows the Windows type ramp: Display
       at/above SEGOE_DISPLAY_THRESHOLD_PX, otherwise Text.

         'Segoe UI' (14px)       → "Segoe UI Variable Text", 'Segoe UI', ...
         'Segoe UI' (28px)       → "Segoe UI Variable Display", 'Segoe UI', ...
         'Segoe UI Semibold'     → instance + 'Segoe UI Semibold' + w600
         'Segoe UI Black'        → untouched (no variable counterpart)
         'Segoe UI Variable'     → instance (fixes invalid name)  */
    const SEGOE_MAP = {
        "segoe ui":           { weight: null },
        "segoe ui light":     { weight: 300 },
        "segoe ui semilight": { weight: 350 },
        "segoe ui semibold":  { weight: 600 },
        "segoe ui bold":      { weight: 700 }
    };

    // Whether "Segoe UI Variable Display" actually resolves in the
    // current browser. Browsers disagree here: Chromium/DirectWrite
    // resolves every named instance, but Firefox does not resolve
    // this one and silently falls back to the next family — which
    // regressed the rendering to plain "Segoe UI". Probe once at
    // runtime instead of assuming.
    let displayInstanceUsable = null;

    function variableInstanceFor(sizePx) {
        if (sizePx < SEGOE_DISPLAY_THRESHOLD_PX) {
            return '"Segoe UI Variable Text"';
        }

        if (displayInstanceUsable === null) {
            try {
                displayInstanceUsable =
                    document.fonts?.check?.('16px "Segoe UI Variable Display"') === true;
            } catch {
                /* FontFaceSet unavailable — treat Display as unusable */
                displayInstanceUsable = false;
            }
        }

        return displayInstanceUsable
            ? '"Segoe UI Variable Display"'
            : '"Segoe UI Variable Text"';
    }

    function transformSegoe(families, sizePx) {
        if (!ENABLED.segoeVariable) return null;

        // Already replaced (or site already uses a Variable *instance*):
        // no-op. Also stops the attribute-observer feedback loop.
        // A bare "segoe ui variable" is NOT an instance — it is the
        // invalid name that must be fixed below.
        const hasVariableInstance = families.some(f => {
            const n = normalizeFamily(f);
            return n.startsWith("segoe ui variable") && n !== "segoe ui variable";
        });

        if (hasVariableInstance) {
            return null;
        }

        let changed = false;
        let weight = null;

        for (let i = 0; i < families.length; i++) {
            const norm = normalizeFamily(families[i]);
            const mapping = SEGOE_MAP[norm];

            if (mapping) {
                changed = true;
                if (mapping.weight) weight = mapping.weight;

                const original = families[i];
                families[i] = variableInstanceFor(sizePx);
                families.splice(i + 1, 0, original); // keep original as fallback
                i++; // skip the inserted fallback
                continue;
            }

            // Bare "Segoe UI Variable" does not resolve in Firefox;
            // point it at a concrete instance.
            if (norm.startsWith("segoe ui")) {
                const suffix = norm.slice("segoe ui".length).trim();

                if (suffix === "variable") {
                    changed = true;
                    families[i] = variableInstanceFor(sizePx);
                }
            }
        }

        return changed ? { weight } : null;
    }


    /* ----- SF Mono → Sarasa Mono SC -----
       SF Mono is Apple's mono face; Sarasa Mono SC (更纱黑体) is the
       local replacement. Unlike the other transforms this one ALSO
       runs inside code areas (the only transform allowed there).
       The first SF Mono entry in the stack is replaced and the
       original kept as fallback; later SF Mono entries stay as plain
       fallbacks. A weight encoded in the family name (SFMono-Semibold)
       rides on font-weight — but only from the head entry — because
       Sarasa ships static named faces.

         SF Mono, monospace            → "Sarasa Mono SC", SF Mono, ...
         SFMono-Regular, Menlo, ...    → "Sarasa Mono SC", SFMono-Regular, ...
         "SF Mono Semibold"            → "Sarasa Mono SC" + w600
         ui-monospace, SFMono-Semibold → middle entry replaced, NO weight
                                           (weight is taken from the head only) */
    const SF_MONO_PATTERN = /^sf[\s-]*mono(\b|$)/i;

    const SF_MONO_WEIGHT_MAP = {
        extralight: 200,
        light: 300,
        medium: 500,
        semibold: 600,
        bold: 700,
        heavy: 700
    };

    function transformMono(families) {
        if (!ENABLED.sarasaMono) return null;

        // Already replaced (or site already uses it): no-op.
        // Also stops the attribute-observer feedback loop.
        if (families.some(f => normalizeFamily(f) === "sarasa mono sc")) {
            return null;
        }

        let changed = false;
        let weight = null;

        for (let i = 0; i < families.length; i++) {
            const norm = normalizeFamily(families[i]);

            if (!SF_MONO_PATTERN.test(norm)) continue;

            changed = true;

            const suffix = norm
                .replace(SF_MONO_PATTERN, "")
                .replace(/^[\s-]+/, "");

            // The element-level weight may only come from the HEAD of
            // the stack: a weight encoded in a non-head SF Mono entry
            // (e.g. `ui-monospace, SFMono-Semibold, Menlo`) describes
            // that fallback only and must not force the head font to
            // a heavier weight.
            if (i === 0 && SF_MONO_WEIGHT_MAP[suffix]) {
                weight = SF_MONO_WEIGHT_MAP[suffix];
            }

            const original = families[i];
            families[i] = '"Sarasa Mono SC"';
            families.splice(i + 1, 0, original); // keep original as fallback
            break; // later SF Mono entries stay as plain fallbacks
        }

        return changed ? { weight } : null;
    }


    const TRANSFORMS = [
        transformRobotoFlex,
        transformInter,
        transformSegoe,
        transformMono,
        transformCJK
    ];


    /* =========================================================
       5. Per-element evaluation

       getComputedStyle is called once per element. The expensive
       parse+transform is memoized per font-stack string (bounded),
       so repeated evaluations of the same stack are cheap.
       Elements inside code areas run ONLY the mono transform.
       ========================================================= */

    const CACHE_MAX = 256;
    const transformCache = new Map();

    function computeTransform(stack, sizePx, transforms = TRANSFORMS) {
        const families = parseFontFamilies(stack);
        let changed = false;
        let weight = null;

        for (const transform of transforms) {
            const result = transform(families, sizePx);

            if (result) {
                changed = true;
                if (result.weight) weight = result.weight;
            }
        }

        return changed ? { family: families.join(", "), weight } : null;
    }

    function getTransform(stack, sizePx) {
        // The result depends on the computed font size (Text vs Display
        // instance), so the cache key must include it.
        const cacheKey = stack + " | " + sizePx;
        let result = transformCache.get(cacheKey);

        if (result === undefined) {
            result = computeTransform(stack, sizePx);
            transformCache.set(cacheKey, result);

            if (transformCache.size > CACHE_MAX) {
                transformCache.delete(transformCache.keys().next().value);
            }
        }

        return result;
    }


    // Mono-zone cache: code areas run ONLY the SF Mono → Sarasa
    // transform, whose result depends on the stack alone (no Text vs
    // Display size split), so a separate bounded cache keeps the
    // full-pipeline cache untouched.
    const monoTransformCache = new Map();

    function getMonoTransform(stack) {
        let result = monoTransformCache.get(stack);

        if (result === undefined) {
            result = computeTransform(stack, 0, [transformMono]);
            monoTransformCache.set(stack, result);

            if (monoTransformCache.size > CACHE_MAX) {
                monoTransformCache.delete(monoTransformCache.keys().next().value);
            }
        }

        return result;
    }


    function evaluateElement(element) {
        if (!(element instanceof Element)) return;

        // One closest() covers both the exclusion list and editable
        // regions ([contenteditable="true"] is part of SKIP_SELECTOR).
        // Code areas are the deliberate exception: with the mono
        // feature enabled, ONLY the SF Mono → Sarasa Mono SC transform
        // runs there (monoOnly); the full pipeline never does.
        let monoOnly = false;

        if (element.closest(SKIP_SELECTOR)) {
            if (!ENABLED.sarasaMono) return;

            monoOnly = !!element.closest(MONO_ONLY_SELECTOR);
            if (!monoOnly) return;
        }

        // Computed property: also catches contenteditable="inherit"
        // / "plaintext-only" forms that the attribute selector misses.
        // Editable text is never touched — not even by the mono-only
        // transform (it is the user's own input).
        if (element.isContentEditable) return;

        // Already-replaced code element: the inline !important font
        // wins over every site rule, so its computed stack is fixed
        // and the size-independent mono transform can no longer
        // change anything. Skipping the getComputedStyle call keeps
        // attribute churn in live editors (Monaco/CodeMirror typing)
        // cheap on subsequent evaluations.
        if (monoOnly && element.style.fontFamily.includes('"Sarasa Mono SC"')) {
            return;
        }

        const style = getComputedStyle(element);
        const stack = style.fontFamily;

        if (!stack || ICON_FONT_PATTERN.test(stack)) return;

        // parseFloat: "28px" → 28 (a raw string would compare as NaN)
        const result = monoOnly
            ? getMonoTransform(stack)
            : getTransform(stack, parseFloat(style.fontSize) || 0);

        if (!result) return;

        // Inline !important deliberately wins over the site's later
        // style changes — that is the script's contract. Elements
        // whose computed stack changes are re-evaluated via the
        // attribute observer; unchanged stacks are no-ops here.
        if (element.style.fontFamily !== result.family) {
            element.style.setProperty(
                "font-family",
                result.family,
                "important"
            );
        }

        if (result.weight && element.style.fontWeight !== String(result.weight)) {
            element.style.setProperty(
                "font-weight",
                String(result.weight),
                "important"
            );
        }

        // Mark processed form controls so a stylesheet rule can make
        // their ::placeholder follow the element's font (placeholder
        // text is not a DOM text node and carries no own font of
        // ours; some sites set one explicitly on the pseudo-element).
        if (
            (element.tagName === "INPUT" ||
                element.tagName === "TEXTAREA" ||
                element.tagName === "SELECT") &&
            !element.hasAttribute("data-fen-processed")
        ) {
            element.setAttribute("data-fen-processed", "");
        }
    }


    /* =========================================================
       6. Scan: explicit stack, prunes hard-excluded subtrees,
          walks code areas for the mono-only transform, follows
          open shadow roots
       ========================================================= */

    function processRoot(root) {
        if (!root) return;

        if (root.nodeType === Node.TEXT_NODE) {
            if (root.nodeValue?.trim() && root.parentElement) {
                evaluateElement(root.parentElement);
            }
            return;
        }

        const textParents = new Set();
        const stack = [root];

        while (stack.length) {
            const node = stack.pop();

            if (node.nodeType === Node.TEXT_NODE) {
                if (node.nodeValue?.trim() && node.parentElement) {
                    textParents.add(node.parentElement);
                }
                continue;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                // Mono feature on: code areas are walked and evaluated
                // mono-only; off: the whole skip list is pruned.
                if (node.closest(PRUNE_SELECTOR)) continue; // prune subtree

                if (node.shadowRoot) {
                    ensureShadowObserved(node.shadowRoot);
                    stack.push(node.shadowRoot);
                }

                // Form control text is not a DOM text node, so it is
                // never collected by the text walker; evaluate the
                // control itself so input/textarea/select content
                // gets the same treatment.
                const tag = node.tagName;
                if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
                    textParents.add(node);
                }
            }

            if (
                node.nodeType !== Node.ELEMENT_NODE &&
                node.nodeType !== Node.DOCUMENT_NODE &&
                node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
            ) {
                continue;
            }

            for (let i = node.childNodes.length - 1; i >= 0; i--) {
                stack.push(node.childNodes[i]);
            }
        }

        for (const element of textParents) {
            evaluateElement(element);
        }
    }


    /* =========================================================
       7. MutationObserver: microtask-batched, deduplicated, covers
          childList + characterData + class/style, survives
          <body> replacement (observes document), follows
          dynamically attached shadow roots
       ========================================================= */

    let pendingRoots = new Set();
    let flushScheduled = false;

    function scheduleProcess(root) {
        if (!root) return;

        // Fast path: drop roots inside hard-excluded areas before they
        // enter the queue. Sites that churn class/style attributes
        // on icons/buttons would otherwise rescan those subtrees on
        // every attribute mutation. Code areas are kept in the queue
        // while the mono replacement is enabled — the mono-only
        // transform still applies there.
        if (
            root.nodeType === Node.ELEMENT_NODE &&
            root.closest(PRUNE_SELECTOR)
        ) {
            return;
        }

        if (
            root.nodeType === Node.TEXT_NODE &&
            root.parentElement &&
            root.parentElement.closest(PRUNE_SELECTOR)
        ) {
            return;
        }

        pendingRoots.add(root);

        if (flushScheduled) return;

        flushScheduled = true;

        // Microtask instead of requestAnimationFrame: the replacement
        // runs after the current JS task (the one that inserted the
        // node, e.g. a YouTube caption line) but BEFORE the browser
        // renders — so dynamically created text is drawn with the
        // final font on its very first frame. rAF could land one
        // frame later, flashing the original font first (visible on
        // Latin/digit captions).
        queueMicrotask(() => {
            flushScheduled = false;

            // Drop roots whose ancestor is also queued.
            for (const root of [...pendingRoots]) {
                let parent = root.parentNode;

                while (parent) {
                    if (pendingRoots.has(parent)) {
                        pendingRoots.delete(root);
                        break;
                    }
                    parent = parent.parentNode;
                }
            }

            for (const root of pendingRoots) {
                processRoot(root);
            }

            pendingRoots.clear();
        });
    }


    function onMutations(records) {
        for (const record of records) {
            if (record.type === "characterData") {
                if (record.target.parentElement) {
                    scheduleProcess(record.target.parentElement);
                }
            } else if (record.type === "attributes") {
                scheduleProcess(record.target);
            } else {
                for (const node of record.addedNodes) {
                    scheduleProcess(node);

                    // A newly inserted stylesheet can change the font
                    // of ANY existing element; rescan the document.
                    // (SPAs often apply their real font stack this way,
                    // after the initial DOMContentLoaded scan.)
                    if (
                        node.nodeType === Node.ELEMENT_NODE &&
                        (node.tagName === "STYLE" ||
                            (node.tagName === "LINK" &&
                                (node.rel || "").includes("stylesheet")))
                    ) {
                        scheduleProcess(document.body || document.documentElement);
                    }
                }
            }
        }
    }


    const observedShadows = new WeakSet();

    function observeTree(target) {
        const observer = new MutationObserver(onMutations);

        observer.observe(target, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["class", "style"]
        });

        return observer;
    }

    function ensureShadowObserved(shadowRoot) {
        if (observedShadows.has(shadowRoot)) return;
        observedShadows.add(shadowRoot);
        observeTree(shadowRoot);
    }


    // Catch shadow roots attached after the initial scan. Uses
    // scheduleProcess so many components attaching shadows in one
    // task share a single microtask flush (a library rendering 100
    // shadow components previously spawned 100 separate scans).
    const originalAttachShadow = Element.prototype.attachShadow;

    if (typeof originalAttachShadow === "function") {
        Element.prototype.attachShadow = function (init) {
            const shadowRoot = originalAttachShadow.call(this, init);

            ensureShadowObserved(shadowRoot);
            scheduleProcess(shadowRoot);

            return shadowRoot;
        };
    }


    /* =========================================================
       8. Start
       ========================================================= */

    function start() {
        ensureFonts();
        injectPlaceholderRule();
        processRoot(document.body || document.documentElement);
        observeTree(document);

        // Late-render safety net: SPAs may mount content after the
        // initial scan, and some engines can miss observer batches
        // (YouTube's ShadyDOM rendering on Firefox among them). A
        // couple of idempotent rescans catch stragglers at near-zero
        // cost — already-processed elements are no-ops via the
        // style comparison and the transform cache.
        setTimeout(() => {
            processRoot(document.body || document.documentElement);
        }, 3000);
        setTimeout(() => {
            processRoot(document.body || document.documentElement);
        }, 8000);
    }


    /* ---------------------------------------------------------
       Placeholder font rule

       ::placeholder text is not a DOM text node, so the scanner
       cannot touch it directly. For controls we have processed,
       force the placeholder to inherit the control's font.
       ========================================================= */

    function injectPlaceholderRule() {
        if (!ENABLED.segoeVariable && !ENABLED.robotoFlex &&
            !ENABLED.interDisplay && !ENABLED.cjkFallback &&
            !ENABLED.sarasaMono) {
            return;
        }

        const style = document.createElement("style");
        style.textContent =
            "[data-fen-processed]::placeholder { font-family: inherit !important; }";

        (document.head || document.documentElement).appendChild(style);
    }


    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            start,
            { once: true }
        );
    } else {
        start();
    }
})();
