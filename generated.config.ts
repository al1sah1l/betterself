import { assembleApplication } from "./src/assembly.ts";

export default {
  assemble: assembleApplication,
  title: "Application",
  design: {
    version: 1,
    documents: [
      new URL("./design/types.md", import.meta.url),
      new URL("./design/compositions/completion.md", import.meta.url),
      new URL("./design/compositions/proof-sharing.md", import.meta.url),
      new URL("./design/compositions/verification.md", import.meta.url),
      new URL("./design/compositions/authentication.md", import.meta.url),
      new URL("./design/compositions/goals.md", import.meta.url),
    ],
  },
};
