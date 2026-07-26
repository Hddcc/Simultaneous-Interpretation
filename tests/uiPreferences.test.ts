import assert from "node:assert/strict";
import { parseUiFontSize, parseUiTheme } from "../src/ui/preferences";

assert.equal(parseUiTheme("light"), "light");
assert.equal(parseUiTheme("dark"), "dark");
assert.equal(parseUiTheme("unexpected"), "system");
assert.equal(parseUiTheme(null), "system");
assert.equal(parseUiFontSize("small"), "small");
assert.equal(parseUiFontSize("large"), "large");
assert.equal(parseUiFontSize("unexpected"), "medium");
assert.equal(parseUiFontSize(null), "medium");

console.log("UI preference checks passed");
