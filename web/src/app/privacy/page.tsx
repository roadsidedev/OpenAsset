export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 md:px-6 md:py-16">
      <h1 className="font-display text-3xl tracking-tight text-foreground">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: August 2025</p>
      <div className="prose prose-sm dark:prose-invert mt-8 max-w-none text-foreground">
        <p className="text-muted-foreground">OpenAsset is a permissionless on-chain protocol. This placeholder policy will be replaced with the final legal text.</p>
        <h3>Data we handle</h3>
        <ul>
          <li>Wallet addresses and on-chain activity visible on the selected network.</li>
          <li>Optional off-chain preferences stored locally in your browser.</li>
          <li>No sale of personal data.</li>
        </ul>
        <h3>Contact</h3>
        <p>Questions: legal@openasset.market</p>
      </div>
    </main>
  );
}
