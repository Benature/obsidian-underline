import { MarkdownView, Plugin, EditorPosition } from "obsidian";

export default class Underline extends Plugin {
  async onload() {
    // console.log(this.app);

    // this.app.workspace.on('layout-change', () => {
    //   this.updateUnderline();
    // })
    // this.app.metadataCache.on('changed', (_file) => {
    //   this.updateUnderline();
    // })

    this.addCommand({
      id: "toggle-underline-tag",
      name: "",
      callback: () => this.urlIntoSelection(),
      hotkeys: [
        {
          modifiers: ["Mod"],
          key: "u",
        },
      ],
    });

    this.addCommand({
      id: "toggle-center-tag",
      name: "",
      callback: () => this.urlIntoSelection("<center>", "</center>"),
      hotkeys: [
        {
          modifiers: ["Mod", "Shift"],
          key: "c",
        },
      ],
    });
  }

  urlIntoSelection(prefix: string = "<u>", suffix: string = "</u>"): void {
    const PL = prefix.length; // Prefix Length
    const SL = suffix.length; // Suffix Length
    console.log(PL, SL);

    let markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) {
      return;
    }
    let editor = markdownView.editor;

    let selectedText = editor.somethingSelected() ? editor.getSelection() : "";

    let last_cursor = editor.getCursor(); // the cursor that at the last position of doc
    last_cursor.line = editor.lastLine();
    last_cursor.ch = editor.getLine(last_cursor.line).length;
    const last_offset = editor.posToOffset(last_cursor);

    function Cursor(offset: number): EditorPosition {
      if (offset > last_offset) {
        return last_cursor;
      }
      offset = offset < 0 ? 0 : offset;
      return editor.offsetToPos(offset);
    }

    /* Detect whether the selected text is packed by <u></u>.
       If true, unpack it, else pack with <u></u>. */

    const fos = editor.posToOffset(editor.getCursor("from")); // from offset
    const tos = editor.posToOffset(editor.getCursor("to")); // to offset
    const len = selectedText.length;

    var beforeText = editor.getRange(Cursor(fos - PL), Cursor(tos - len));
    var afterText = editor.getRange(Cursor(fos + len), Cursor(tos + SL));
    var startText = editor.getRange(Cursor(fos), Cursor(fos + PL));
    var endText = editor.getRange(Cursor(tos - SL), Cursor(tos));

    if (beforeText === prefix && afterText === suffix) {
      //=> undo underline (inside selection)
      editor.setSelection(Cursor(fos - PL), Cursor(tos + SL));
      editor.replaceSelection(`${selectedText}`);
      // re-select
      editor.setSelection(Cursor(fos - PL), Cursor(tos - PL));
    } else if (startText === prefix && endText === suffix) {
      //=> undo underline (outside selection)
      editor.replaceSelection(
        editor.getRange(Cursor(fos + PL), Cursor(tos - SL))
      );
      // re-select
      editor.setSelection(Cursor(fos), Cursor(tos - PL - SL));
    } else {
      //=> do underline

      if (selectedText) {
        // console.log("selected");
        editor.replaceSelection(`${prefix}${selectedText}${suffix}`);
        // re-select
        editor.setSelection(
          editor.offsetToPos(fos + PL),
          editor.offsetToPos(tos + PL)
        );
      } else {
        // console.log("not selected");
        editor.replaceSelection(`${prefix}${suffix}`);
        let cursor = editor.getCursor();
        cursor.ch -= SL;
        editor.setCursor(cursor);
      }
    }
  }
}
