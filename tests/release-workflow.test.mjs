import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_PATH = path.join(ROOT, ".github", "workflows", "release.yml");
const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");

test("release workflow triggers on version tags", () => {
    assert.match(workflow, /tags:\s*\n\s*-\s*"v\*"/, "expected a v* tag trigger");
    assert.doesNotMatch(workflow, /pull_request/, "workflow must not run on pull requests");
});

test("workflow verifies the tag against module.json before building", () => {
    assert.match(workflow, /readFileSync\('module\.json'/, "expected the manifest version to be read");
    assert.match(workflow, /does not match module\.json version/, "expected a tag/version mismatch guard");
});

test("workflow runs validation and the full test suite before packaging", () => {
    const packageStep = workflow.indexOf("Build and verify the release zip");
    const validateStep = workflow.indexOf("node scripts/validate.mjs");
    const testStep = workflow.indexOf("npm test");
    assert.ok(validateStep !== -1, "expected scripts/validate.mjs to run");
    assert.ok(testStep !== -1, "expected npm test to run");
    assert.ok(packageStep !== -1, "expected the release packager to run");
    assert.ok(validateStep < packageStep && testStep < packageStep, "packaging must come after validation and tests");
});

test("workflow attaches the manifest-matching zip and module.json to the GitHub release", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "module.json"), "utf8"));
    assert.match(
        workflow,
        new RegExp(`dist/${manifest.id}-v\\$VERSION\\.zip`),
        "the attached asset must use the manifest id and version"
    );
    assert.match(workflow, /gh release create[\s\S]*?"module\.json"/, "module.json must be a release asset so the README install URL resolves");
    assert.match(workflow, /--verify-tag/, "expected the release to attach to the pushed tag");
    assert.match(workflow, /--notes-file release-notes\.md/, "expected changelog-derived release notes");
});

test("workflow uses only first-party actions and no third-party release tooling", () => {
    const uses = [...workflow.matchAll(/^\s*uses:\s*(\S+)/gm)].map((m) => m[1]);
    assert.ok(uses.length > 0, "expected at least one action");
    for (const action of uses) {
        assert.match(action, /^actions\/(checkout|setup-node)@/, `unexpected third-party action: ${action}`);
    }
    assert.doesNotMatch(workflow, /softprops|ncipollo|release-drafter/, "no third-party release actions allowed");
});

test("workflow grants only contents: write", () => {
    assert.match(workflow, /permissions:\s*\n\s*contents:\s*write/, "expected contents: write");
    assert.doesNotMatch(workflow, /packages:|id-token:|deployments:/, "no extra permissions expected");
});

test("workflow contains no emoji or AI references", () => {
    assert.doesNotMatch(workflow, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, "no emoji allowed");
    assert.doesNotMatch(workflow, /codebuff|openai|claude|anthropic/i, "no AI references allowed");
});
