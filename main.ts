import { MarkdownView, Plugin } from "obsidian";

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
    // let activeLeaf = this.app.workspace.activeLeaf;
    let markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (!markdownView) {
      return;
    }
    let editor = markdownView.editor;
    let selectedText = editor.somethingSelected()
      ? editor.getSelection()
      : false;

    if (selectedText) {
      editor.replaceSelection(`<u>${selectedText}</u>`);
    } else {
      let cursor = editor.getCursor();
      cursor.ch += 3;
      editor.replaceSelection(`<u></u>`);
      editor.setCursor(cursor);
    }
  }
}
