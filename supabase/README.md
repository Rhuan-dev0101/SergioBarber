# supabase

`migrations/` contem apenas as mudancas incrementais. O schema base (profiles, barbers, services,
appointments, payments, days_off etc.) anterior a elas NAO esta no repo.

Para gerar o baseline a partir do banco de producao (ja linkado com `supabase link`):

    supabase db dump --schema-only -f supabase/migrations/20260101000000_baseline.sql

O baseline deve ter timestamp menor que o das demais migrations. Em bancos que ja o possuem,
marque-o como aplicado: `supabase migration repair --status applied 20260101000000`.
