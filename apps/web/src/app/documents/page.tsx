import DocBrowser from "@/components/DocBrowser";

export default function Documents() {
  return (
    <div className="space-y-6">
      <header><h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-muted text-sm">Read-only browsing of approved local folders. Documents stay where they are; nothing is copied or modified. Google Drive is reached only through the agents' own connector, not here.</p></header>
      <DocBrowser />
    </div>
  );
}
