
# Portal de Finanças Pessoais

App full-stack com login, registro de receitas/despesas, dashboard com gráficos, gestão de usuários (admin) e exportação Excel/PDF.

## Stack
- TanStack Start + React + Tailwind (template atual)
- Lovable Cloud (Postgres + Auth + RLS) — banco SQL gerenciado
- Design: paleta Emerald Prestige (verde esmeralda + dourado, sensação premium)
- Gráficos: Recharts | Excel: SheetJS (xlsx) | PDF: jsPDF + autotable

## Modelo de dados (SQL)
- `profiles` — id (FK auth.users), display_name, created_at
- `user_roles` — user_id, role (`admin` | `user`) — tabela separada + função `has_role()` (segurança)
- `categories` — id, user_id (nullable p/ globais), name, type (`expense`|`income`), icon, color
- `transactions` — id, user_id, type (`expense`|`income`), amount (numeric), currency (BRL/USD/EUR…), category_id, source (`pix`|`dinheiro`|`credito`|`debito`|`transferencia`|`boleto`), description, occurred_at, created_at

Categorias pré-cadastradas (seed global): Alimentação, Moradia, Transporte, Saúde, Lazer, Educação, Assinaturas, Salário, Investimentos, Outros.

## RLS
- `transactions`/`categories`: usuário vê/edita os próprios; **admin vê todos** (via `has_role(auth.uid(),'admin')`)
- `user_roles`: leitura própria; insert/update/delete só admin
- `profiles`: leitura própria + admin lê todos

## Rotas
- `/login` — email/senha (+ Google opcional)
- `/_authenticated/` (layout protegido)
  - `/` dashboard (KPIs mês/ano, gráfico pizza por categoria, barras mês a mês, saldo)
  - `/transactions` lista + filtros (período, categoria, tipo, fonte) + form novo lançamento (receita/despesa, valor, moeda, categoria, fonte, data, descrição)
  - `/export` exportar Excel (.xlsx) ou PDF, com filtros de período/usuário
  - `/settings` perfil + (admin) gestão de usuários: convidar/criar, alterar role, desativar
- `/_authenticated/_admin/users` (gate por role)

## Componentes principais
- `AppShell` (sidebar verde esmeralda + topbar dourado-accent)
- `TransactionForm`, `TransactionTable`, `KpiCard`, `CategoryPieChart`, `MonthlyBarChart`
- `ExportDialog` (escolhe formato + período)
- `UserManagementTable` (admin)

## Fluxos chave
1. Cadastro inicial: primeiro usuário criado vira admin (trigger) — demais criados via tela admin
2. Lançamento: form valida com zod → insert via Supabase client (RLS aplica)
3. Dashboard: server fn agrega por mês/categoria (SQL `sum` group by) e devolve séries
4. Export: server fn busca lançamentos filtrados → gera xlsx/pdf → download

## Detalhes técnicos
- Multi-moeda: armazena `amount` + `currency`; dashboard agrupa por moeda (sem conversão automática nesta v1)
- Trigger `handle_new_user` cria profile e atribui role `user` (ou `admin` se for o 1º)
- Server functions com `requireSupabaseAuth` para todas leituras/escritas
- Validação zod em todos os formulários

## Entregáveis
1. Habilitar Lovable Cloud + schema (migration) com RLS, roles, categorias seed
2. Auth (login/signup) + layout protegido
3. CRUD de transações + categorias
4. Dashboard com gráficos
5. Tela admin de usuários
6. Exportação Excel/PDF
7. Design system Emerald Prestige aplicado em `styles.css`

Posso seguir e implementar?
