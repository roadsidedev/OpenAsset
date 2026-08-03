import { readFile } from "node:fs/promises";
import path from "node:path";

const DOCUMENT_PATHS = [
  "index.mdx",
  "protocol/overview.mdx",
  "protocol/design-philosophy.mdx",
  "protocol/core-contracts.mdx",
  "protocol/adapter-system.mdx",
  "protocol/trust-model.mdx",
  "protocol/adapter-registry.mdx",
  "protocol/validation-matrix.mdx",
  "protocol/circuit-breaker.mdx",
  "protocol/loan-lifecycle.mdx",
  "protocol/oracles.mdx",
  "protocol/liquidations.mdx",
  "protocol/positions.mdx",
  "protocol/rwa.mdx",
  "protocol/lending-assets.mdx",
  "protocol/multi-chain.mdx",
  "protocol/compliance.mdx",
  "protocol/security.mdx",
  "protocol/data-models.mdx",
  "guides/adapters.mdx",
  "guides/borrow.mdx",
  "guides/create-market.mdx",
  "guides/liquidation.mdx",
  "guides/rwa-market.mdx",
  "reference/security-checklist.mdx",
  "reference/deferred.mdx",
  "reference/glossary.mdx",
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
