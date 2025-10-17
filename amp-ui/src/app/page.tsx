export default function MarketingHome() {
  return (
    <div className="grid gap-12 py-10">
      <section className="text-center grid gap-4">
        <h1 className="text-4xl font-bold">Ad Monetization Platform</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Simulate pod-aware auctions, visualize outcomes, and optimize delivery
          across linear and streaming inventory.
        </p>
        <div className="flex justify-center gap-3">
          <a
            href="/auth/login"
            className="inline-flex items-center rounded-lg border border-blue-800 bg-blue-700 text-white px-4 py-2 hover:bg-blue-800"
          >
            Sign in
          </a>
          <a
            href="/scenarios/preview"
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 hover:bg-gray-50"
          >
            Try Scenario Preview
          </a>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {[
          {
            title: "Pod-aware auction",
            text: "Respect pod positions and floors; enforce policy like competitive separation and category exclusion.",
          },
          {
            title: "Inventory-first filters",
            text: "Network→Channel, Series→Season→Episode, Studio→Movie, plus Geo/Device/Slot, all in one place.",
          },
          {
            title: "Sales-grade analytics",
            text: "Rollups, filtered summaries, exports to CSV/JSON, and S3 (optional).",
          },
        ].map((c) => (
          <div
            key={c.title}
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
          >
            <div className="text-lg font-semibold">{c.title}</div>
            <p className="text-sm text-gray-600 mt-1">{c.text}</p>
          </div>
        ))}
      </section>

      <section className="max-w-6xl mx-auto grid gap-3">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <ol className="grid md:grid-cols-4 gap-4">
          {[
            {
              step: "1",
              title: "Define supply",
              text: "Networks→Channels, Series→Episodes, Movies, Live; pods and slots per asset.",
            },
            {
              step: "2",
              title: "Create demand",
              text: "Insertion Orders → Line Items → Creatives; floors, brand safety, policy rules.",
            },
            {
              step: "3",
              title: "Run simulation",
              text: "Pod-aware auctions with targeting, daypart, service/app, and industry ratings.",
            },
            {
              step: "4",
              title: "Review & iterate",
              text: "Dashboard KPIs, rollups, filtered impressions and exports; refine and repeat.",
            },
          ].map((s) => (
            <li
              key={s.step}
              className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
            >
              <div className="text-blue-700 font-semibold">{s.step}</div>
              <div className="font-semibold">{s.title}</div>
              <div className="text-sm text-gray-600">{s.text}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
