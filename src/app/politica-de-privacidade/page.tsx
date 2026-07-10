import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'

export default function PoliticaDePrivacidade() {
  return (
    <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <Lock className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold font-serif tracking-tight text-foreground">Política de Privacidade (LGPD)</h1>
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
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">1. Compromisso com a Privacidade</h2>
            <p>
              A <strong>Osanchez Barbearia</strong> valoriza a sua privacidade e se compromete a proteger os dados pessoais fornecidos pelos nossos clientes. Esta política detalha como coletamos, usamos, armazenamos e protegemos suas informações de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">2. Dados Pessoais que Coletamos</h2>
            <p>
              Para prestar nossos serviços e facilitar seus agendamentos, coletamos os seguintes dados:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Dados de Identificação:</strong> Nome completo, endereço de e-mail e número de telefone (WhatsApp).</li>
              <li><strong>Dados de Acesso:</strong> Senha criptografada e credenciais de login.</li>
              <li><strong>Dados de Agendamento:</strong> Data, horário, barbeiro escolhido, serviços contratados e observações adicionais.</li>
              <li><strong>Dados de Pagamento:</strong> Comprovantes de transações (ex: chaves e códigos Pix) e histórico de pagamentos.</li>
              <li><strong>Consentimentos Legais:</strong> Histórico de aceite dos termos de uso e política de cookies (salvos com IP e timestamp).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">3. Finalidade da Coleta de Dados</h2>
            <p>
              Suas informações são tratadas sob os seguintes fundamentos legais da LGPD e finalidades comerciais:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Execução de Contrato:</strong> Garantir que seu agendamento seja associado à sua conta e processado corretamente pelos nossos profissionais.</li>
              <li><strong>Comunicação e Notificações:</strong> Enviar lembretes de agendamentos, avisos de alterações e atualizações importantes via e-mail ou WhatsApp.</li>
              <li><strong>Segurança da Informação:</strong> Prevenir fraudes, mitigar riscos cibernéticos e registrar aceites de termos para conformidade jurídica.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">4. Compartilhamento e Armazenamento</h2>
            <p>
              Os seus dados são mantidos em servidores de nuvem altamente seguros fornecidos pela <strong>Supabase (PostgreSQL)</strong>. Nós <strong>nunca vendemos ou alugamos</strong> seus dados pessoais a terceiros. O compartilhamento ocorre estritamente com os barbeiros da Osanchez Barbearia para a prestação do serviço e no cumprimento de obrigações legais.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">5. Direitos do Titular dos Dados</h2>
            <p>
              De acordo com o Art. 18 da LGPD, você possui os seguintes direitos em relação aos seus dados:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Confirmar a existência de tratamento e acessar seus dados.</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados em sua página de Perfil.</li>
              <li>Solicitar a exclusão definitiva dos seus dados (revogação do consentimento), o que resultará na exclusão da sua conta de cliente.</li>
              <li>Opor-se ao tratamento de dados fundamentados em interesses legítimos.</li>
            </ul>
            <p>
              Para exercer qualquer um destes direitos, entre em contato através do e-mail de suporte cadastrado ou diretamente pelo nosso WhatsApp.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-l-2 border-primary pl-2">6. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados, tais como criptografia de ponta a ponta na transmissão, controle rígido de RLS (Row Level Security) no banco de dados e políticas rigorosas de controle de acesso interno.
            </p>
          </section>

          <div className="pt-6 border-t border-border flex justify-between items-center text-xs">
            <span>Osanchez Barbearia © 2026</span>
            <Link href="/termos-de-uso" className="text-primary hover:underline">
              Termos de Uso
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
