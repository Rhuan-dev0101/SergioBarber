import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Cookie } from 'lucide-react'

export default function PoliticaDeCookies() {
  return (
    <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <Cookie className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold font-serif tracking-tight text-foreground">Política de Cookies</h1>
          </div>
          <Link 
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors bg-secondary px-3 py-1.5 rounded-md border border-border"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </Link>
        </div>

        <div className="prose prose-invert max-w-none text-muted-foreground space-y-6 text-sm leading-relaxed">
          <p className="text-xs text-muted-foreground font-medium italic">Última atualização: 10 de Julho de 2026 | Versão 1.0</p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">1. O que são Cookies?</h2>
            <p>
              Cookies são pequenos arquivos de texto salvos no seu computador ou dispositivo móvel quando você visita nossa plataforma. Eles ajudam o site a se lembrar de suas ações e preferências (como login, idioma e outras opções de visualização) ao longo do tempo, para que você não precise digitá-las novamente ao retornar.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">2. Como Utilizamos os Cookies?</h2>
            <p>
              Nós categorizamos os cookies utilizados em nossa plataforma da seguinte forma:
            </p>
            <ul className="list-disc pl-5 space-y-3">
              <li>
                <strong>Cookies Essenciais (Estritamente Necessários):</strong> São imprescindíveis para permitir que você navegue em nosso site e use seus recursos com segurança. Sem estes cookies, funcionalidades como o login de usuário e a finalização de agendamentos não podem ser executadas.
              </li>
              <li>
                <strong>Cookies Estatísticos (Analíticos):</strong> Coletam informações anônimas sobre como os visitantes utilizam a plataforma (ex: quais páginas são mais visitadas, velocidade de carregamento). Nós usamos esses dados apenas para otimizar a experiência geral do sistema.
              </li>
              <li>
                <strong>Cookies de Marketing:</strong> Utilizados para monitorar a eficácia de nossos anúncios e apresentar conteúdos promocionais mais relevantes baseados em seus interesses de navegação.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">3. Gerenciamento do seu Consentimento</h2>
            <p>
              Na sua primeira visita, exibimos nosso banner de consentimento. Você pode optar por aceitar todos os cookies ou configurar suas preferências de estatísticas e marketing separadamente. Seus cookies essenciais não podem ser desabilitados, pois inviabilizariam o funcionamento do sistema de agendamento.
            </p>
            <p>
              Seus dados de consentimento são associados a um identificador anônimo de visitante (`visitor_id`) e registrados em nosso banco de dados seguro para fins de conformidade com a LGPD.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">4. Como Desativar via Navegador</h2>
            <p>
              Além de nosso painel de preferências, você pode gerenciar ou desativar os cookies diretamente nas configurações do seu navegador web (Google Chrome, Firefox, Safari, Microsoft Edge). Observe que desabilitar completamente os cookies do navegador pode fazer com que partes significativas do nosso site e de outros portais parem de funcionar perfeitamente.
            </p>
          </section>

          <div className="pt-6 border-t border-border flex justify-between items-center text-xs">
            <span>Osanchez Barbearia © 2026</span>
            <div className="flex gap-4">
              <Link href="/termos-de-uso" className="text-primary hover:underline">
                Termos de Uso
              </Link>
              <Link href="/politica-de-privacidade" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
