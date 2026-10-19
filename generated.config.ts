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
      new URL("./design/compositions/commitments.md", import.meta.url),
      new URL("./design/compositions/proofs.md", import.meta.url),
      new URL("./design/compositions/groups.md", import.meta.url),
      new URL("./design/compositions/strategy-proposal.md", import.meta.url),
      new URL("./design/compositions/dashboard.md", import.meta.url),
      new URL("./design/compositions/results.md", import.meta.url),
    ],
  },
};
