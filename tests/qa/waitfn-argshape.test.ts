// tests/qa/waitfn-argshape.test.ts — waitForFunction 两参形态机械防线
// （ulw probe-repair 票：playwright waitForFunction(fn, { timeout }) 两参
// 形态在该版本运行时会把 options 当 arg 透传、超时不生效；正解三参
// (fn, null, { timeout })，范本 tests/qa/confetti-origin-qa.mjs 的三参形态）。
//
// 设计（与 probe-reconciliation.test.ts 同族——探针面机械对账）：
//   - 检测器：括号平衡扫描——对每个 `waitForFunction(` 找配对收口括号，
//     顶层逗号切参，参数（trim + 去空）恰 2 个且第二参 `{` 开头 → 判两参病。
//     尾逗号会产生空串参数，被 filter(a => a.length > 0) 吸收。
//   - fixture 正负对照：两参样例→命中；三参样例、无 options 样例、
//     尾逗号三参样例→不命中。防检测器自身失效（误报/漏报双向钉死）。
//   - 全量扫描：tests/qa/**/*.mjs（递归）两参计数必须 === 0，命中即列明细 FAIL。
//
// 真源：.omo/plans/probe-repair-ticket-20261009.md；主公 2026-10-09 裁定
// 「验证绿了还有问题就更新环境」——本防线把「环境形态回归」钉进契约层。
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, "..", "..", "..");
const TESTS_QA = join(REPO_ROOT, "tests", "qa");

// —— 检测器（括号平衡；与票面参考实现同构，已对真实仓验证）——
function findTwoArgWaitFn(src: string): { line: number; secondArg: string }[] {
  const out: { line: number; secondArg: string }[] = [];
  const name = "waitForFunction(";
  let i = 0;
  while ((i = src.indexOf(name, i)) !== -1) {
    const start = i + name.length - 1;
    let depth = 0;
    let j = start;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    const inner = src.slice(start + 1, j);
    const args: string[] = [];
    let d = 0;
    let cur = "";
    for (const c of inner) {
      if (c === "(" || c === "[" || c === "{") d++;
      else if (c === ")" || c === "]" || c === "}") d--;
      if (c === "," && d === 0) {
        args.push(cur);
        cur = "";
      } else cur += c;
    }
    args.push(cur);
    const trimmed = args.map((a) => a.trim()).filter((a) => a.length > 0);
    if (trimmed.length === 2 && trimmed[1].startsWith("{")) {
      out.push({ line: src.slice(0, i).split("\n").length, secondArg: trimmed[1].slice(0, 50) });
    }
    i = j;
  }
  return out;
}

function walkMjs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walkMjs(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe("waitfn-argshape: waitForFunction 两参形态防线", () => {
  it("检测器正对照：两参样例命中（含嵌套括号/花括号不误切）", () => {
    const twoArg = [
      "await page.waitForFunction(",
      "  () => {",
      "    try {",
      '      const v = window.localStorage.getItem("ttt.offline.stats.v1");',
      "      return v ? JSON.parse(v).totalGames >= 1 : false;",
      "    } catch {",
      "      return false;",
      "    }",
      "  },",
      "  { timeout: 5000 },",
      ");",
    ].join("\n");
    const hits = findTwoArgWaitFn(twoArg);
    expect(hits.length).toBe(1);
    expect(hits[0].secondArg).toBe("{ timeout: 5000 }");
    // 行号从 1 起
    expect(hits[0].line).toBe(1);
  });

  it("检测器负对照：三参 / 无 options / 尾逗号三参样例均不命中", () => {
    const threeArg = [
      "await page.waitForFunction(",
      "  () => document.querySelectorAll('[data-testid=\"confetti\"]').length === 0,",
      "  null,",
      "  { timeout: 3000 },",
      ");",
    ].join("\n");
    expect(findTwoArgWaitFn(threeArg).length).toBe(0);

    const noOptions = "await page.waitForFunction(() => window.__ready === true);";
    expect(findTwoArgWaitFn(noOptions).length).toBe(0);

    // 尾逗号：空参数被吸收，三参仍判三参（不因尾逗号变两参误报）
    const threeArgTrailing = [
      "await p.waitForFunction(() => x.y(z), null, { timeout: 4000 },);",
    ].join("\n");
    expect(findTwoArgWaitFn(threeArgTrailing).length).toBe(0);

    // 尾逗号两参：仍命中（空参数被吸收，防漏报）
    const twoArgTrailing = "await p.waitForFunction(() => x.y(z), { timeout: 4000 },);";
    expect(findTwoArgWaitFn(twoArgTrailing).length).toBe(1);
  });

  it("全量扫描：tests/qa/**/*.mjs 两参形态计数 === 0", () => {
    const files = walkMjs(TESTS_QA).filter((f) => f.endsWith(".mjs")).sort();
    expect(files.length).toBeGreaterThan(0);
    const sick: string[] = [];
    let total = 0;
    for (const f of files) {
      const hits = findTwoArgWaitFn(readFileSync(f, "utf8"));
      if (hits.length) {
        total += hits.length;
        sick.push(`${f} -> ${JSON.stringify(hits)}`);
      }
    }
    expect(
      total,
      `waitForFunction 两参形态（超时不生效）必须为 0；命中明细：\n${sick.join("\n")}\n正解：三参 (fn, null, { timeout })，范本 tests/qa/confetti-origin-qa.mjs`,
    ).toBe(0);
  });
});
