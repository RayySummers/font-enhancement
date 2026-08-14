"use strict";

/*
 * Unit tests for the Font Enhancement userscript transforms.
 * Runs the real script inside Node's vm with minimal DOM stubs and
 * asserts each transform's behavior on synthetic font stacks.
 *
 *   node test/transform_tests.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SCRIPT_PATH = path.join(
    __dirname,
    "..",
    "Font Enhancement (Roboto Flex & Segoe UI Variable).user.js"
);

let source = fs.readFileSync(SCRIPT_PATH, "utf8");

// The script is an IIFE; append an export of the internals under test
// before it closes so assertions can reach the transforms.
const exportLine =
    "globalThis.__fenTest = { ENABLED, parseFontFamilies, normalizeFamily, " +
    "transformRobotoFlex, transformInter, transformSegoe, transformMono, " +
    "transformCJK, computeTransform, getMonoTransform };";

if (!/globalThis\.__fenTest/.test(source)) {
    source = source.replace(/\}\)\(\);\s*$/, `; ${exportLine}\n})();`);
}

const sandbox = {
    console,
    Element: class Element {},
    document: {
        readyState: "loading",
        addEventListener() {}
    }
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const api = sandbox.__fenTest;
if (!api) {
    throw new Error("test harness failed to export script internals");
}

/* ---------------------------------------------------------- helpers */

let passed = 0;
let failed = 0;

function check(name, fn) {
    try {
        fn();
        passed++;
        console.log(`ok   ${name}`);
    } catch (error) {
        failed++;
        console.error(`FAIL ${name}: ${error.message}`);
    }
}

function families(stack) {
    return api.parseFontFamilies(stack);
}

function monoResult(stack) {
    const list = families(stack);
    const result = api.transformMono(list);
    return result
        ? { family: list.join(", "), weight: result.weight ?? null }
        : null;
}

/* -------------------------------------------------------- SF Mono */

check("SF Mono head is replaced with Sarasa Mono SC", () => {
    const result = monoResult("SF Mono, monospace");
    if (!result) throw new Error("expected a transform");
    if (result.family !== '"Sarasa Mono SC", SF Mono, monospace') {
        throw new Error(`got: ${result.family}`);
    }
    if (result.weight !== null) {
        throw new Error(`unexpected weight ${result.weight}`);
    }
});

check("SFMono-Regular mid-stack entry is replaced, head kept", () => {
    const result = monoResult("ui-monospace, SFMono-Regular, Menlo");
    if (!result) throw new Error("expected a transform");
    if (result.family !== 'ui-monospace, "Sarasa Mono SC", SFMono-Regular, Menlo') {
        throw new Error(`got: ${result.family}`);
    }
});

check("SFMono-Semibold maps to font-weight 600", () => {
    const result = monoResult("SFMono-Semibold");
    if (!result) throw new Error("expected a transform");
    if (result.weight !== 600) throw new Error(`got weight ${result.weight}`);
    if (result.family !== '"Sarasa Mono SC", SFMono-Semibold') {
        throw new Error(`got: ${result.family}`);
    }
});

check("SF Mono Heavy maps to font-weight 700", () => {
    const result = monoResult("SF Mono Heavy");
    if (!result) throw new Error("expected a transform");
    if (result.weight !== 700) throw new Error(`got weight ${result.weight}`);
});

check("bare SFMono is replaced", () => {
    const result = monoResult("SFMono, monospace");
    if (!result) throw new Error("expected a transform");
    if (result.family !== '"Sarasa Mono SC", SFMono, monospace') {
        throw new Error(`got: ${result.family}`);
    }
});

check("already-Sarasa stacks are a no-op (feedback loop)", () => {
    const result = monoResult('"Sarasa Mono SC", SF Mono');
    if (result !== null) {
        throw new Error(`expected null, got ${JSON.stringify(result)}`);
    }
});

check("non-SF-Mono stacks are untouched", () => {
    const result = monoResult("Consolas, monospace");
    if (result !== null) throw new Error("expected null");
});

check("disabled flag turns the transform off", () => {
    const previous = api.ENABLED.sarasaMono;
    api.ENABLED.sarasaMono = false;
    try {
        const list = families("SF Mono, monospace");
        const result = api.transformMono(list);
        if (result !== null) throw new Error("expected null while disabled");
    } finally {
        api.ENABLED.sarasaMono = previous;
    }
});

/* --------------------------------------------------- full pipeline */

check("full pipeline: SF Mono + Segoe UI both replaced, no CJK append", () => {
    const result = api.computeTransform("SF Mono, Segoe UI", 14);
    if (!result) throw new Error("expected a transform");
    if (!result.family.includes('"Sarasa Mono SC"')) {
        throw new Error(`missing Sarasa: ${result.family}`);
    }
    if (!result.family.includes('"Segoe UI Variable Text"')) {
        throw new Error(`missing Segoe instance: ${result.family}`);
    }
    if (result.family.includes("Noto Sans SC")) {
        throw new Error(`CJK fallback appended despite Sarasa: ${result.family}`);
    }
});

check("CJK fallback treats Sarasa as a CJK font", () => {
    const list = families('"Sarasa Mono SC"');
    const result = api.transformCJK(list);
    if (result !== null) {
        throw new Error("expected no CJK append on a Sarasa stack");
    }
});

/* ---------------------------------------------- mono-zone cache */

check("getMonoTransform returns and caches the mono-only result", () => {
    const first = api.getMonoTransform("SF Mono, monospace");
    const second = api.getMonoTransform("SF Mono, monospace");
    if (!first || !second) throw new Error("expected a result");
    if (first.family !== '"Sarasa Mono SC", SF Mono, monospace') {
        throw new Error(`got: ${first.family}`);
    }
    if (first !== second) throw new Error("cache returned a different object");
});

/* ------------------------------------------------------ parsing */

check("parseFontFamilies handles quoted names with commas", () => {
    const list = families('"Segoe UI", "SF Mono", sans-serif');
    if (list.length !== 3) {
        throw new Error(`expected 3 entries, got ${list.length}`);
    }
    if (list[1] !== '"SF Mono"') throw new Error(`got: ${list[1]}`);
});

/* -------------------------------------------------------- summary */

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
