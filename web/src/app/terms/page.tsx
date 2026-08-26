export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 md:px-6 md:py-16">
      <h1 className="font-display text-3xl tracking-tight text-foreground">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: August 2025</p>
      <div className="prose prose-sm dark:prose-invert mt-8 max-w-none text-foreground">
        <p className="text-muted-foreground">Use of the OpenAsset interface is subject to these placeholder terms until the final agreement is published.</p>
        <h3>Risk acknowledgement</h3>
        <ul>
          <li>All markets are isolated and carry asset-specific risk.</li>
          <li>Use of adapters, oracles and liquidation mechanisms is at your own discretion.</li>
          <li>No investment advice is provided via this interface.</li>
        </ul>
        <h3>Contact</h3>
        <p>Questions: legal@openasset.market</p>
      </div>
    </main>
  );
}
