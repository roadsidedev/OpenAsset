import { readFile } from "node:fs/promises";
import path from "node:path";

const DOCUMENT_PATHS = [
  "index.mdx",
  "learn/overview.mdx",
  "learn/how-market-works.mdx",
  "learn/design-philosophy.mdx",
  "learn/core-contracts.mdx",
  "learn/loan-lifecycle.mdx",
  "learn/oracles.mdx",
  "learn/liquidations.mdx",
  "learn/positions.mdx",
  "learn/lending-assets.mdx",
  "learn/circuit-breaker.mdx",
  "learn/data-models.mdx",
  "learn/glossary.mdx",
  "use/getting-started.mdx",
  "use/borrow.mdx",
  "use/supply.mdx",
  "build/quickstart.mdx",
  "build/developer-guide.mdx",
  "build/adapters.mdx",
  "build/adapter-system.mdx",
  "build/adapter-registry.mdx",
  "build/register-adapter.mdx",
  "build/reference-adapters.mdx",
  "build/developer-feedback.mdx",
  "curate/create-market.mdx",
  "curate/rwa-markets.mdx",
  "curate/compliance.mdx",
  "curate/validation-matrix.mdx",
  "curate/liquidation.mdx",
  "curate/multi-chain.mdx",
  "security/scope-and-risks.mdx",
  "security/model.mdx",
  "security/trust-model.mdx",
  "security/audits.mdx",
  "security/checklist.mdx",
  "security/deferred.mdx",
] as const;

function toPlainMarkdown(source: string): string {
  return source
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .replace(/^import\s+.*?\r?\n/gm, "")
    .replace(/<Callout[^>]*>/g, "")
    .replace(/<\/Callout>/g, "")
    .replace(/<Cards>/g, "")
    .replace(/<\/Cards>/g, "")
    .replace(/<Cards\.Card\s+title="([^"]+)"\s+href="([^"]+)"\s*\/>/g, "- [$1]($2)")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function getLlmsDocument(): Promise<string> {
  const contentRoot = path.join(process.cwd(), "content");
  const documents = await Promise.all(
    DOCUMENT_PATHS.map(async (documentPath) => {
      const source = await readFile(path.join(contentRoot, documentPath), "utf8");
      return `<!-- Source: /docs/${documentPath.replace(/(?:\/index)?\.mdx$/, "")} -->\n\n${toPlainMarkdown(source)}`;
    })
  );

  return [
    "# OpenAsset Market Documentation",
    "> Canonical, agent-readable copy of the complete OpenAsset Market documentation.",
    "",
    "This file is generated directly from the documentation source pages. It preserves their canonical order and content while removing MDX-only presentation components.",
    "",
    ...documents,
    "",
  ].join("\n");
}
