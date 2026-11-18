import OfficeScene from "@/components/OfficeScene";

export const dynamic = "force-dynamic";

export default function OfficePage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl hero-title"><span className="grad-text">The Office</span></h1>
        <p className="text-muted text-sm mt-1">Your AI team at their desks. When the Chief of Staff hands work to a specialist you will see them walk over and talk. Only real activity is shown; the demo button is clearly marked.</p>
      </header>
      <OfficeScene />
    </div>
  );
}
