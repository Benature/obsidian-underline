const assert = require("assert");
const Module = require("module");

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") {
    return {
      Plugin: class Plugin {
        addCommand() {}
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const Underline = require("../main.js");
Module._load = originalLoad;

// Regression test for #21: ES5 __extends output cannot extend Obsidian's
// native Plugin class. This must instantiate without calling FE without new.
const loadedPlugin = new Underline();
assert.strictEqual(typeof loadedPlugin.onload, "function");

class MockEditor {
  constructor(text, selections, main = 0) {
    this.text = text;
    this.selections = selections;
    this.main = main;
  }

  getValue() {
    return this.text;
  }

  posToOffset(pos) {
    const lines = this.text.split("\n");
    let offset = 0;
    for (let line = 0; line < pos.line; line++) {
      offset += lines[line].length + 1;
    }
    return offset + pos.ch;
  }

  offsetToPos(offset) {
    offset = Math.max(0, Math.min(offset, this.text.length));
    const before = this.text.slice(0, offset);
    const line = (before.match(/\n/g) || []).length;
    const lineStart = before.lastIndexOf("\n") + 1;
    return { line, ch: offset - lineStart };
  }

  listSelections() {
    return this.selections.map((selection) => ({
      anchor: this.offsetToPos(selection.anchor),
      head: this.offsetToPos(selection.head),
    }));
  }

  getCursor(which = "head") {
    const selection = this.selections[this.main];
    if (which === "anchor") return this.offsetToPos(selection.anchor);
    if (which === "head") return this.offsetToPos(selection.head);
    const from = Math.min(selection.anchor, selection.head);
    const to = Math.max(selection.anchor, selection.head);
    return this.offsetToPos(which === "from" ? from : to);
  }

  replaceRange(replacement, from, to = from) {
    const start = this.posToOffset(from);
    const end = this.posToOffset(to);
    this.text = this.text.slice(0, start) + replacement + this.text.slice(end);
  }

  setSelections(selections, main = 0) {
    this.selections = selections.map((selection) => ({
      anchor: this.posToOffset(selection.anchor),
      head: this.posToOffset(
        selection.head === undefined ? selection.anchor : selection.head
      ),
    }));
    this.main = main;
  }

  wordAt(pos) {
    const offset = this.posToOffset(pos);
    const isWord = (char) => char && /[\p{L}\p{N}_]/u.test(char);
    let anchor = offset;
    if (
      !isWord(this.text[anchor]) &&
      anchor > 0 &&
      isWord(this.text[anchor - 1])
    ) {
      anchor--;
    }
    if (!isWord(this.text[anchor])) return null;
    let from = anchor;
    let to = anchor + 1;
    while (from > 0 && isWord(this.text[from - 1])) from--;
    while (to < this.text.length && isWord(this.text[to])) to++;
    return { from: this.offsetToPos(from), to: this.offsetToPos(to) };
  }
}

function run(text, selections, options = {}) {
  const editor = new MockEditor(text, selections, options.main || 0);
  const plugin = Object.create(Underline.prototype);
  plugin.wrapper(
    editor,
    null,
    options.prefix === undefined ? "<u>" : options.prefix,
    options.suffix === undefined ? "</u>" : options.suffix
  );
  return {
    text: editor.text,
    selections: editor.selections,
    main: editor.main,
  };
}

function caret(text, offset, options) {
  return run(text, [{ anchor: offset, head: offset }], options);
}

function selection(text, from, to, options) {
  return run(text, [{ anchor: from, head: to }], options);
}

let passed = 0;
function test(name, callback) {
  try {
    callback();
    passed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("#18 wraps and unwraps selected text", () => {
  const wrapped = selection("hello", 0, 5);
  assert.deepStrictEqual(wrapped, {
    text: "<u>hello</u>",
    selections: [{ anchor: 3, head: 8 }],
    main: 0,
  });
  const unwrapped = selection(wrapped.text, 3, 8);
  assert.deepStrictEqual(unwrapped.text, "hello");
  assert.deepStrictEqual(unwrapped.selections, [{ anchor: 0, head: 5 }]);
});

test("unwraps when the selection includes both tags", () => {
  const result = selection("<u>hello</u>", 0, 12);
  assert.strictEqual(result.text, "hello");
  assert.deepStrictEqual(result.selections, [{ anchor: 0, head: 5 }]);
});

test("preserves backward selection direction", () => {
  const result = run("hello", [{ anchor: 5, head: 0 }]);
  assert.strictEqual(result.text, "<u>hello</u>");
  assert.deepStrictEqual(result.selections, [{ anchor: 8, head: 3 }]);
});

test("#19 formats the word under the caret instead of splitting it", () => {
  const result = caret("This is simple.", 9);
  assert.strictEqual(result.text, "This is <u>simple</u>.");
  assert.deepStrictEqual(result.selections, [{ anchor: 21, head: 21 }]);
});

test("#19 unwraps an underlined word from its middle", () => {
  const result = caret("<u>simple</u>", 5);
  assert.strictEqual(result.text, "simple");
  assert.deepStrictEqual(result.selections, [{ anchor: 2, head: 2 }]);
});

test("#16 exits an active wrapper at the end without nesting", () => {
  const result = caret("<u>hello</u>", 8);
  assert.strictEqual(result.text, "<u>hello</u>");
  assert.deepStrictEqual(result.selections, [{ anchor: 12, head: 12 }]);
});

test("#16 exits an active wrapper at the beginning", () => {
  const result = caret("<u>hello</u>", 3);
  assert.strictEqual(result.text, "<u>hello</u>");
  assert.deepStrictEqual(result.selections, [{ anchor: 0, head: 0 }]);
});

test("a second toggle removes an empty wrapper", () => {
  const inserted = caret("a  b", 2);
  assert.strictEqual(inserted.text, "a <u></u> b");
  assert.deepStrictEqual(inserted.selections, [{ anchor: 5, head: 5 }]);
  const removed = caret(inserted.text, 5);
  assert.strictEqual(removed.text, "a  b");
  assert.deepStrictEqual(removed.selections, [{ anchor: 2, head: 2 }]);
});

test("custom wrappers use the same toggle behavior", () => {
  const result = caret("hello", 2, { prefix: "<center>", suffix: "</center>" });
  assert.strictEqual(result.text, "<center>hello</center>");
});

test("#20 applies formatting to every table selection", () => {
  const text = "| alpha | beta |\n| gamma | delta |";
  const words = ["alpha", "beta", "gamma", "delta"];
  const result = run(
    text,
    words.map((word) => {
      const from = text.indexOf(word);
      return { anchor: from, head: from + word.length };
    }),
    { main: 2 }
  );
  assert.strictEqual(
    result.text,
    "| <u>alpha</u> | <u>beta</u> |\n| <u>gamma</u> | <u>delta</u> |"
  );
  assert.strictEqual(result.main, 2);
  assert.deepStrictEqual(
    result.selections.map((range) =>
      result.text.slice(range.anchor, range.head)
    ),
    words
  );
});

test("multiple carets keep correct positions after earlier edits", () => {
  const result = run("one two", [
    { anchor: 1, head: 1 },
    { anchor: 5, head: 5 },
  ]);
  assert.strictEqual(result.text, "<u>one</u> <u>two</u>");
  assert.deepStrictEqual(result.selections, [
    { anchor: 10, head: 10 },
    { anchor: 21, head: 21 },
  ]);
});

Promise.resolve(loadedPlugin.onload()).then(() => {
  console.log(
    `\n${passed + 1} tests passed (including plugin load smoke test).`
  );
});
