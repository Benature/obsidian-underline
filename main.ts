import {
  Editor,
  EditorPosition,
  EditorSelection,
  MarkdownView,
  Plugin,
} from "obsidian";

interface WrapperEdit {
  index: number;
  from: number;
  to: number;
  replacement: string | null;
  anchor: number;
  head: number;
}

export default class Underline extends Plugin {
  async onload() {
    this.addCommand({
      id: "toggle-underline-tag",
      name: "Toggle underline tag",
      icon: "lucide-underline",
      editorCallback: (editor: Editor, view: MarkdownView) =>
        this.wrapper(editor, view),
      hotkeys: [
        {
          modifiers: ["Mod"],
          key: "u",
        },
      ],
    });

    this.addCommand({
      id: "toggle-center-tag",
      name: "Toggle center tag",
      icon: "lucide-align-center",
      editorCallback: (editor: Editor, view: MarkdownView) =>
        this.wrapper(editor, view, "<center>", "</center>"),
      // hotkeys: [
      //   {
      //     modifiers: ["Mod", "Shift"],
      //     key: "c",
      //   },
      // ],
    });

    this.addCommand({
      id: "toggle-link-heading",
      name: "Toggle a link to heading in the same file",
      icon: "lucide-link",
      editorCallback: (editor: Editor, view: MarkdownView) =>
        this.wrapper(editor, view, "[[#", "]]"),
      // hotkeys: [
      //   {
      //     modifiers: ["Mod"],
      //     key: "3",
      //   },
      // ],
    });
    this.addCommand({
      id: "toggle-link-block",
      name: "Toggle a link to block in the same file",
      icon: "lucide-link",
      editorCallback: (editor: Editor, view: MarkdownView) =>
        this.wrapper(editor, view, "[[#^", "]]"),
      // hotkeys: [
      //   {
      //     modifiers: ["Mod"],
      //     key: "6",
      //   },
      // ],
    });
  }

  wrapper(
    editor: Editor,
    _view: MarkdownView,
    prefix: string = "<u>",
    suffix: string = "</u>"
  ): void {
    const selections = editor.listSelections();
    if (selections.length === 0) return;

    const primaryAnchor = editor.getCursor("anchor");
    const primaryHead = editor.getCursor("head");
    const primaryIndex = selections.findIndex(
      (selection) =>
        this.samePosition(selection.anchor, primaryAnchor) &&
        this.samePosition(selection.head, primaryHead)
    );

    const edits = selections
      .map((selection, index) =>
        this.createEdit(editor, selection, index, prefix, suffix)
      )
      .sort((a, b) => a.from - b.from || a.to - b.to);
    const nextSelections: EditorSelection[] = new Array(selections.length);
    let offsetDelta = 0;

    // Apply edits from left to right, shifting later ranges by earlier edits.
    // This also handles the multiple selections used by table cell selection.
    for (const edit of edits) {
      const currentDelta = offsetDelta;
      if (edit.replacement !== null) {
        editor.replaceRange(
          edit.replacement,
          editor.offsetToPos(edit.from + currentDelta),
          editor.offsetToPos(edit.to + currentDelta)
        );
        offsetDelta += edit.replacement.length - (edit.to - edit.from);
      }
      nextSelections[edit.index] = {
        anchor: editor.offsetToPos(edit.anchor + currentDelta),
        head: editor.offsetToPos(edit.head + currentDelta),
      };
    }

    editor.setSelections(nextSelections, Math.max(0, primaryIndex));
  }

  private createEdit(
    editor: Editor,
    selection: EditorSelection,
    index: number,
    prefix: string,
    suffix: string
  ): WrapperEdit {
    const document = editor.getValue();
    const anchorOffset = editor.posToOffset(selection.anchor);
    const headOffset = editor.posToOffset(selection.head);
    const from = Math.min(anchorOffset, headOffset);
    const to = Math.max(anchorOffset, headOffset);
    const backward = anchorOffset > headOffset;
    const PL = prefix.length;
    const SL = suffix.length;
    const selectedText = document.slice(from, to);

    // The wrappers are immediately outside the selection. This also removes
    // an empty wrapper when the caret is between its prefix and suffix.
    if (
      from >= PL &&
      to + SL <= document.length &&
      document.slice(from - PL, from) === prefix &&
      document.slice(to, to + SL) === suffix
    ) {
      const nextFrom = from - PL;
      const nextTo = to - PL;
      return {
        index,
        from: from - PL,
        to: to + SL,
        replacement: selectedText,
        anchor: backward ? nextTo : nextFrom,
        head: backward ? nextFrom : nextTo,
      };
    }

    if (from === to) {
      // While typing inside a wrapper, toggle off by moving outside it,
      // matching Obsidian's bold/italic behavior instead of nesting tags.
      if (document.slice(from, from + SL) === suffix) {
        const beforeCursor = document.slice(0, from);
        if (
          beforeCursor.lastIndexOf(prefix) > beforeCursor.lastIndexOf(suffix)
        ) {
          return this.caretEdit(index, from, from + SL);
        }
      }
      if (document.slice(from - PL, from) === prefix) {
        return this.caretEdit(index, from, from - PL);
      }

      // With no selection, format the word under the caret. If that word is
      // already wrapped, remove its wrapper instead of adding nested tags.
      const word = editor.wordAt(editor.offsetToPos(from));
      if (word) {
        const wordFrom = editor.posToOffset(word.from);
        const wordTo = editor.posToOffset(word.to);
        const wordText = document.slice(wordFrom, wordTo);
        if (
          wordFrom >= PL &&
          wordTo + SL <= document.length &&
          document.slice(wordFrom - PL, wordFrom) === prefix &&
          document.slice(wordTo, wordTo + SL) === suffix
        ) {
          return {
            index,
            from: wordFrom - PL,
            to: wordTo + SL,
            replacement: wordText,
            anchor: from - PL,
            head: from - PL,
          };
        }
        if (wordFrom < wordTo) {
          const caret = wordTo + PL + SL;
          return {
            index,
            from: wordFrom,
            to: wordTo,
            replacement: `${prefix}${wordText}${suffix}`,
            anchor: caret,
            head: caret,
          };
        }
      }

      // Preserve the original behavior outside words: insert an empty
      // wrapper and leave the caret ready for typing.
      return {
        index,
        from,
        to,
        replacement: `${prefix}${suffix}`,
        anchor: from + PL,
        head: from + PL,
      };
    }

    // The selection includes both wrappers.
    if (
      to - from >= PL + SL &&
      document.slice(from, from + PL) === prefix &&
      document.slice(to - SL, to) === suffix
    ) {
      const nextFrom = from;
      const nextTo = to - PL - SL;
      return {
        index,
        from,
        to,
        replacement: document.slice(from + PL, to - SL),
        anchor: backward ? nextTo : nextFrom,
        head: backward ? nextFrom : nextTo,
      };
    }

    const nextFrom = from + PL;
    const nextTo = to + PL;
    return {
      index,
      from,
      to,
      replacement: `${prefix}${selectedText}${suffix}`,
      anchor: backward ? nextTo : nextFrom,
      head: backward ? nextFrom : nextTo,
    };
  }

  private caretEdit(
    index: number,
    position: number,
    target: number
  ): WrapperEdit {
    return {
      index,
      from: position,
      to: position,
      replacement: null,
      anchor: target,
      head: target,
    };
  }

  private samePosition(a: EditorPosition, b: EditorPosition): boolean {
    return a.line === b.line && a.ch === b.ch;
  }
}
