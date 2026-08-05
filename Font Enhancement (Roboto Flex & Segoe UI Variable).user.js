// ==UserScript==
// @name         Font Enhancement (Roboto Flex & Segoe UI Variable)
// @name:zh-CN   Font Enhancement (Roboto Flex & Segoe UI Variable)
// @namespace    rayy.font-enhance
// @version      1.3.9
// @description  Replace Roboto / bare sans-serif with Roboto Flex, Inter with Inter Display (>=24px) and Segoe UI with Segoe UI Variable (Windows 11); appends Noto Sans SC / Source Han Sans SC as CJK fallback. Preserves explicitly chosen fonts such as Inter.
// @description:zh-CN  将 Roboto / 裸 sans-serif 替换为 Roboto Flex、Inter(≥24px)替换为 Inter Display、Segoe UI 替换为 Segoe UI Variable(Windows 11),并为缺少中文字体的网站自动追加 Noto Sans SC / Source Han Sans SC 兜底;尊重站点显式字体选择(如 Inter)。
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
        cjkFallback: true
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

    function transformCJK(families) {
        if (!ENABLED.cjkFallback) return null;

        if (families.some(f => CJK_FONT_PATTERN.test(normalizeFamily(f)))) {
            return null; // site already covers CJK; also stops feedback loop
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


    const TRANSFORMS = [transformRobotoFlex, transformInter, transformSegoe, transformCJK];


    /* =========================================================
       5. Per-element evaluation

       getComputedStyle is called once per element. The expensive
       parse+transform is memoized per font-stack string (bounded),
       so repeated evaluations of the same stack are cheap.
       ========================================================= */

    const CACHE_MAX = 256;
    const transformCache = new Map();

    function computeTransform(stack, sizePx) {
        const families = parseFontFamilies(stack);
        let changed = false;
        let weight = null;

        for (const transform of TRANSFORMS) {
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


    function evaluateElement(element) {
        if (!(element instanceof Element)) return;

        // One closest() covers both the exclusion list and editable
        // regions ([contenteditable="true"] is part of SKIP_SELECTOR).
        if (element.closest(SKIP_SELECTOR)) return;

        // Computed property: also catches contenteditable="inherit"
        // / "plaintext-only" forms that the attribute selector misses.
        if (element.isContentEditable) return;

        const style = getComputedStyle(element);
        const stack = style.fontFamily;

        if (!stack || ICON_FONT_PATTERN.test(stack)) return;

        // parseFloat: "28px" → 28 (a raw string would compare as NaN)
        const result = getTransform(stack, parseFloat(style.fontSize) || 0);

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
       6. Scan: explicit stack, prunes excluded subtrees,
          follows open shadow roots
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
                if (node.closest(SKIP_SELECTOR)) continue; // prune subtree

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

        // Fast path: drop roots inside excluded areas before they
        // enter the queue. Sites that churn class/style attributes
        // on icons/buttons/code blocks would otherwise rescan those
        // subtrees on every attribute mutation.
        if (
            root.nodeType === Node.ELEMENT_NODE &&
            root.closest(SKIP_SELECTOR)
        ) {
            return;
        }

        if (
            root.nodeType === Node.TEXT_NODE &&
            root.parentElement &&
            root.parentElement.closest(SKIP_SELECTOR)
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
            !ENABLED.interDisplay && !ENABLED.cjkFallback) {
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
