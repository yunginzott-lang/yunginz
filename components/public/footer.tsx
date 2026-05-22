export function Footer({ settings }: { settings: any }) {
  const policies = ((settings?.footerPolicies ?? []) as Array<{ label: string; href: string }>).filter(
    (policy) => !["privacy", "terms"].includes(policy.label.toLowerCase())
  );

  return (
    <footer id="footer" className="border-t border-white/5 bg-black/20">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div className="flex items-center gap-2 font-mono text-lg uppercase tracking-[0.2em]">
          <span className="text-[#f4efe7]">Yunginz</span>
          <span className="text-primary">Productions</span>
        </div>
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-foreground/30">
          (c) 2026 Yunginz. All rights reserved.
        </div>
        <div className="flex flex-wrap gap-6">
          {policies.map((policy) => (
            <a
              key={policy.label}
              href={policy.href}
              className="font-mono text-xs uppercase tracking-[0.3em] text-foreground/35 hover:text-primary"
            >
              {policy.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
