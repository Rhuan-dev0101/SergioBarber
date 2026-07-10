import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold font-serif tracking-tight text-foreground">Termos de Uso</h1>
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
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">1. Introdução</h2>
            <p>
              Estes Termos de Uso regem o acesso e utilização da plataforma de agendamento online da <strong>Osanchez Barbearia</strong>. Ao utilizar nosso sistema, criar uma conta ou realizar agendamentos, você concorda integralmente com as condições estipuladas aqui.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">2. Cadastro e Acesso à Conta</h2>
            <p>
              Para utilizar as funcionalidades de agendamento, é necessário realizar um cadastro fornecendo informações exatas, atualizadas e completas. O usuário é o único responsável pela guarda e confidencialidade de suas credenciais de login.
            </p>
            <p>
              Caso suspeite de qualquer uso indevido de sua conta, você deve nos notificar imediatamente pelos nossos canais de suporte.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">3. Regras de Agendamento, Atrasos e Cancelamento</h2>
            <p>
              Para oferecer um serviço premium de excelência, operamos sob diretrizes estritas de horários:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Sinal de Reserva:</strong> Para garantir o horário, poderá ser solicitado o pagamento de um sinal de <strong>50% (cinquenta por cento)</strong> do valor do serviço contratado via Pix.
              </li>
              <li>
                <strong>Política de Cancelamento:</strong> O cancelamento ou reagendamento de um horário deve ser realizado com no mínimo <strong>2 horas de antecedência</strong> através do painel do cliente. Cancelamentos fora desse prazo podem acarretar a perda do sinal de reserva.
              </li>
              <li>
                <strong>Atrasos:</strong> Toleramos um atraso máximo de <strong>10 minutos</strong>. Passado esse período, o agendamento poderá ser marcado como &quot;não comparecido&quot; (No-show) e a realização do serviço ficará sujeita à disponibilidade da agenda do barbeiro, sem reembolso de sinal.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">4. Taxas e Pagamentos</h2>
            <p>
              Os preços dos serviços são exibidos de forma clara durante o fluxo de agendamento. O pagamento restante (ou total) deve ser quitado no local, logo após a conclusão do serviço, aceitando-se Pix, Cartões de Débito/Crédito e Dinheiro.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">5. Limitação de Responsabilidade</h2>
            <p>
              A Osanchez Barbearia se esforça para manter o sistema de agendamento online estável e acessível. Contudo, não nos responsabilizamos por interrupções temporárias decorrentes de manutenções, falhas de conectividade de internet ou problemas de terceiros.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">6. Alterações nos Termos</h2>
            <p>
              Reservamo-nos o direito de alterar estes Termos de Uso a qualquer momento. Modificações substanciais serão notificadas aos usuários cadastrados e entrarão em vigor após a publicação na plataforma. O uso contínuo após as mudanças indica a aceitação das novas regras.
            </p>
          </section>

          <div className="pt-6 border-t border-border flex justify-between items-center text-xs">
            <span>Osanchez Barbearia © 2026</span>
            <Link href="/politica-de-privacidade" className="text-primary hover:underline">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
