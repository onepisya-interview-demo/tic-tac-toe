// commitlint config for the local Conventional + lore-trailer + Plan: footer policy.
// The commit-msg hook delegates to tests/qa/commit-audit.mjs (source of truth);
// this file lets `pnpm exec commitlint` work standalone.
//
// R7 (中文语言规则) intentionally lives ONLY in commit-audit.mjs. Mirroring it
// here would create two sources of truth that drift independently - the audit
// script is the only gate that runs at commit time; this file is purely a
// `pnpm exec commitlint` smoke harness. Conventional prefix / subject length /
// body length / enum trailers / Plan footer remain this file's responsibility.
module.exports = {
  extends: ["@commitlint/config-conventional"],
  parserPreset: {
    parserOpts: {
      headerPattern: /^(prompt|feat|fix|refactor|test|docs|chore|build|ci|perf)(\([^)]+\))?(?:!)?: (.+)/,
      headerCorrespondence: ["type", "scope", "subject"],
    },
  },
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "test", "docs", "chore", "build", "ci", "perf", "prompt"],
    ],
    "header-max-length": [2, "always", 100],
    "body-min-length": [2, "always", 20],
    "footer-min-length": [0, "always", 0],
  },
  plugins: [
    {
      rules: {
        "has-plan-footer": (parsed) => {
          const footer = parsed.footer || "";
          const m = footer.match(/^Plan:\s+\S+/m);
          return [m ? 0 : 2, "missing footer: Plan: .omo/plans/<slug>.md"];
        },
        "has-confidence-trailer": (parsed) => {
          const footer = parsed.footer || "";
          const m = footer.match(/Confidence:\s*(low|medium|high)/i);
          return [m ? 0 : 2, "missing trailer: Confidence: low|medium|high"];
        },
        "has-scope-risk-trailer": (parsed) => {
          const footer = parsed.footer || "";
          const m = footer.match(/Scope-risk:\s*(narrow|moderate|broad)/i);
          return [m ? 0 : 2, "missing trailer: Scope-risk: narrow|moderate|broad"];
        },
      },
    },
  ],
};
