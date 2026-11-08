import typescript from "@rollup/plugin-typescript";

export default {
  input: "main.ts",
  output: {
    dir: ".",
    sourcemap: "inline",
    format: "cjs",
    exports: "default",
  },
  external: ["obsidian"],
  plugins: [typescript()],
};
