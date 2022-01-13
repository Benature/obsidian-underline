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
      id: "paste-url-into-selection",
      name: "",
      callback: () => this.urlIntoSelection(),
      hotkeys: [
        {
          modifiers: ["Mod"],
          key: "u",
        },
      ],
    });
  }

  urlIntoSelection(): void {
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
    console.log("last", last_offset);

    function Cursor(offset: number): EditorPosition {
      if (offset > last_offset) {
        return last_cursor;
      }
      return editor.offsetToPos(offset);
    }

    /* Detect whether the selected text is packed by <u></u>.
       If true, unpack it, else pack with <u></u>. */

    const fos = editor.posToOffset(editor.getCursor("from")); // from offset
    const tos = editor.posToOffset(editor.getCursor("to")); // to offset
    const len = selectedText.length;

    var beforeText = editor.getRange(Cursor(fos - 3), Cursor(tos - len));
    console.log(tos + 4);
    var afterText = editor.getRange(Cursor(fos + len), Cursor(tos + 4));
    var startText = editor.getRange(Cursor(fos), Cursor(fos + 3));
    var endText = editor.getRange(Cursor(tos - 4), Cursor(tos));

    if (beforeText === "<u>" && afterText === "</u>") {
      //=> undo underline (inside selection)
      editor.setSelection(Cursor(fos - 3), Cursor(tos + 4));
      editor.replaceSelection(`${selectedText}`);
      // re-select
      editor.setSelection(Cursor(fos - 3), Cursor(tos - 3));
    } else if (startText === "<u>" && endText === "</u>") {
      //=> undo underline (outside selection)
      editor.replaceSelection(
        editor.getRange(Cursor(fos + 3), Cursor(tos - 4))
      );
      // re-select
      editor.setSelection(Cursor(fos), Cursor(tos - 7));
    } else {
      //=> do underline

      if (selectedText) {
        // console.log("selected");
        editor.replaceSelection(`<u>${selectedText}</u>`);
        // re-select
        console.log(fos, tos);
        editor.setSelection(
          editor.offsetToPos(fos + 3),
          editor.offsetToPos(tos + 3)
        );
      } else {
        // console.log("not selected");
        editor.replaceSelection(`<u></u>`);
        let cursor = editor.getCursor();
        cursor.ch -= 4;
        editor.setCursor(cursor);
      }
    }
  }
}
