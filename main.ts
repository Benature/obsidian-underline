import { Plugin } from "obsidian";
// import { clipboard } from "electron";

export default class UnderlineSelection extends Plugin {
  async onload() {
    console.log(this.app);
    this.addCommand({
      id: "obsidian-underline",
      name: "underline",
      callback: () => this.underlineSelection(),
      hotkeys: [
        {
          modifiers: ["Mod"],
          key: "u",
        },
      ],
    });
  }

  underlineSelection(): void {
    let activeLeaf: any = this.app.workspace.activeLeaf;
    let editor = activeLeaf.view.sourceMode.cmEditor;
    let selectedText = editor.somethingSelected()
      ? editor.getSelection()
      : false;
    // let clipboardText = clipboard.readText("clipboard");

    if (selectedText) {
      editor.replaceSelection(`<u>${selectedText}</u>`);
    } else {
      editor.replaceSelection(`<u></u>`);
    }
  }
}
