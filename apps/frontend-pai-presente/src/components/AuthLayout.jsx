import React from "react";

import BrandMark from "@/components/BrandMark";
import AdaFooter from "@/components/AdaFooter";
import BrandWordmark from "@/components/BrandWordmark";

/**
 * Moldura do login/cadastro com a marca (feedback do design, nov/2026): faixa
 * marinho com o simbolo e o nome, como nas pecas de divulgacao, e o cartao do
 * formulario em cima do fundo off-white. `title` vira o nome da pagina para o
 * leitor de tela; o nome visivel e' o logotipo.
 */
export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-brand-navy px-6 pt-14 pb-24 text-center">
        <BrandMark motion="enter" className="mx-auto h-20 w-20" />
        <h1 className="sr-only">{title}</h1>
        <BrandWordmark tone="dark" size="lg" className="mt-4 inline-block" />
        {subtitle && <p className="mx-auto mt-4 max-w-xs text-sm text-[#F3F0E8]/80">{subtitle}</p>}
      </div>
      <div className="mx-auto -mt-14 w-full max-w-md px-4 pb-10">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_12px_40px_rgba(47,47,81,0.12)] sm:p-8">
          {children}
        </div>
        {footer && (
          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        )}
      </div>
      <AdaFooter className="pt-0" />
    </div>
  );
}
