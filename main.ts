import { MarkdownView, Plugin, EditorPosition } from "obsidian";

export default class Underline extends Plugin {
  async onload() {
    // console.log(this.app);

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

    function Cursor(pos: number): EditorPosition {
      return editor.offsetToPos(pos);
    }

    /* Detect whether the selected text is packed by <u></u>.
       If true, unpack it, else pack with <u></u>. */

    const fos = editor.posToOffset(editor.getCursor("from")); // from offset
    const tos = editor.posToOffset(editor.getCursor("to")); // to offset
    const len = selectedText.length;

    var beforeText = editor.getRange(Cursor(fos - 3), Cursor(tos - len));
    var afterText = editor.getRange(Cursor(fos + len), Cursor(tos + 4));

    if (beforeText === "<u>" && afterText === "</u>") {
      //=> undo underline

      editor.setSelection(Cursor(fos - 3), Cursor(tos + 4));
      editor.replaceSelection(`${selectedText}`);
      // re-select
      editor.setSelection(Cursor(fos - 3), Cursor(tos - 3));
    } else {
      //=> do underline

      if (selectedText) {
        // console.log("selected");
        editor.replaceSelection(`<u>${selectedText}</u>`);
        // re-select
        editor.setSelection(Cursor(fos + 3), Cursor(tos + 3));
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
