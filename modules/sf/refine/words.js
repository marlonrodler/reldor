'use strict';

/**
 * Words for reading a task written in Portuguese against a project whose labels are in English (and the other
 * way round). General business and CRM vocabulary, not tied to any project: a word can have several meanings,
 * all are tried, and only the ones that form an object's name in the project count.
 */
const PT_EN = {
  // CRM and standard objects
  conta: 'account', cliente: 'customer client account', contato: 'contact', oportunidade: 'opportunity opp', caso: 'case',
  chamado: 'case ticket', lead: 'lead', candidato: 'candidate lead applicant', tarefa: 'task', evento: 'event', atividade: 'activity task',
  campanha: 'campaign', membro: 'member', usuario: 'user', perfil: 'profile', produto: 'product', cotacao: 'quote',
  proposta: 'proposal quote', contrato: 'contract', pedido: 'order request', ordem: 'order', catalogo: 'catalog pricebook',
  ativo: 'asset active', parceiro: 'partner', grupo: 'group', fila: 'queue', equipe: 'team', time: 'team',
  // money and sales
  pagamento: 'payment', parcela: 'installment payment', doacao: 'donation gift', doador: 'donor', presente: 'gift present',
  credito: 'credit', debito: 'debit', fatura: 'invoice bill', cobranca: 'billing charge', recibo: 'receipt', venda: 'sale',
  compra: 'purchase', preco: 'price', valor: 'amount value', desconto: 'discount', comissao: 'commission', meta: 'goal target',
  orcamento: 'budget quote', fundo: 'fund', financiamento: 'funding financing', desembolso: 'disbursement', alocacao: 'allocation',
  investimento: 'investment', carteira: 'portfolio wallet', saldo: 'balance', limite: 'limit', taxa: 'rate fee', juros: 'interest',
  emprestimo: 'loan', cartao: 'card', transacao: 'transaction', lancamento: 'entry posting', reembolso: 'refund', imposto: 'tax',
  moeda: 'currency', contabil: 'accounting', contabilidade: 'accounting', unidade: 'unit', geral: 'general', receita: 'revenue',
  // operations
  entrega: 'delivery deliverable shipment', envio: 'shipment', remessa: 'shipment', frete: 'freight', estoque: 'inventory stock',
  armazem: 'warehouse', fornecedor: 'supplier vendor', fabricante: 'manufacturer', fabricacao: 'manufacturing', producao: 'production',
  revendedor: 'reseller dealer', distribuidor: 'distributor', item: 'item', peca: 'part', componente: 'component', familia: 'family household',
  marca: 'brand', modelo: 'template model', servico: 'service', atendimento: 'service case', suporte: 'support', reserva: 'reservation booking',
  espaco: 'space', sala: 'room', vaga: 'slot position', imovel: 'property', propriedade: 'property', corretor: 'broker agent',
  // people and organizations
  pessoa: 'person', funcionario: 'employee', colaborador: 'employee', departamento: 'department', organizacao: 'organization',
  empresa: 'company account', instituicao: 'institution', domicilio: 'household', casa: 'household house', voluntario: 'volunteer',
  turno: 'shift', cargo: 'position role title', funcao: 'role function', papel: 'role', relacionamento: 'relationship', relacao: 'relationship',
  afiliacao: 'affiliation', beneficiario: 'beneficiary', dependente: 'dependent', hospede: 'guest', experiencia: 'experience',
  // education
  aluno: 'student', estudante: 'student', professor: 'faculty teacher', docente: 'faculty', curso: 'course', disciplina: 'course subject',
  turma: 'class section', oferta: 'offering offer', conexao: 'connection', matricula: 'enrollment registration', inscricao: 'enrollment registration application subscription',
  candidatura: 'application', admissao: 'admission', semestre: 'term semester', termo: 'term', periodo: 'term period', nota: 'grade score note',
  pontuacao: 'score', teste: 'test', exame: 'test exam', prova: 'test exam', credencial: 'credential', certificacao: 'certification',
  certificado: 'certificate certification', diploma: 'diploma degree', grau: 'degree', historico: 'history', educacao: 'education',
  educacional: 'education educational', academico: 'academic', presenca: 'attendance presence', frequencia: 'attendance frequency',
  idioma: 'language', lingua: 'language', fluencia: 'fluency', comportamento: 'behavior', envolvimento: 'involvement', bloco: 'block',
  horario: 'time schedule', instalacao: 'facility installation', plano: 'plan', requisito: 'requirement', requerimento: 'requirement request',
  // programs and cases
  programa: 'program', coorte: 'cohort', engajamento: 'engagement', participante: 'participant', sessao: 'session', cronograma: 'schedule',
  agenda: 'schedule calendar', agendamento: 'schedule appointment', calendario: 'calendar', projeto: 'project', etapa: 'stage step',
  estagio: 'stage', fase: 'phase stage', solicitacao: 'request', aprovacao: 'approval', revisao: 'review', avaliacao: 'review evaluation rating',
  reclamacao: 'complaint', incidente: 'incident', ocorrencia: 'incident occurrence', problema: 'problem issue', sinistro: 'claim',
  apolice: 'policy', seguro: 'insurance', garantia: 'warranty guarantee collateral', direito: 'entitlement right', acordo: 'agreement',
  assinatura: 'subscription signature', renovacao: 'renewal', cancelamento: 'cancellation', devolucao: 'return refund',
  // data and system
  endereco: 'address', cidade: 'city', estado: 'state status', pais: 'country', regiao: 'region', territorio: 'territory', local: 'location',
  localizacao: 'location', mercado: 'market', segmento: 'segment', categoria: 'category', tipo: 'type', nivel: 'level', status: 'status',
  prioridade: 'priority', origem: 'source origin', canal: 'channel', data: 'date', dado: 'data', dados: 'data', importacao: 'import',
  exportacao: 'export', lote: 'batch', registro: 'record log', erro: 'error', log: 'log', auditoria: 'audit', mensagem: 'message',
  notificacao: 'notification', alerta: 'alert', aviso: 'notice alert', documento: 'document', arquivo: 'file', anexo: 'attachment',
  comentario: 'comment', observacao: 'note comment', configuracao: 'setting settings configuration', parametro: 'parameter',
  mapeamento: 'mapping', regra: 'rule', permissao: 'permission', acesso: 'access', campo: 'field', objeto: 'object', gatilho: 'trigger',
  manipulador: 'handler', verificacao: 'verification', validacao: 'validation', recorrente: 'recurring', recorrencia: 'recurrence recurring',
  mudanca: 'change', alteracao: 'change', leve: 'soft', parcial: 'partial', primario: 'primary', primaria: 'primary',
  reciproco: 'reciprocal', principal: 'primary main', padrao: 'default standard', personalizado: 'custom', cabecalho: 'header',
  coluna: 'column', tabela: 'table', pesquisa: 'survey search', questionario: 'survey', pergunta: 'question', resposta: 'response answer',
  comunidade: 'community', portal: 'portal', resultado: 'result outcome', indicador: 'indicator metric',
  entregavel: 'deliverable', prazo: 'deadline term', motivo: 'reason', saida: 'exit', entrada: 'entry intake', inicio: 'start',
  fim: 'end', termino: 'end', duracao: 'duration', dia: 'day', mes: 'month', ano: 'year', semana: 'week',
  pacote: 'package bundle', kit: 'bundle kit', colheita: 'harvest', irrigacao: 'irrigation', mercadoria: 'merchandise product',
  chave: 'key', token: 'token', integracao: 'integration', sincronizacao: 'sync synchronization',
  // states written as adjectives
  submetido: 'submitted', enviado: 'submitted sent', aprovado: 'approved', rejeitado: 'rejected', cancelado: 'cancelled canceled',
  criado: 'created', alterado: 'changed', fechado: 'closed', aberto: 'open', pago: 'paid', ordenado: 'ordered', encomendado: 'ordered',
  desativado: 'unsubmitted inactive',
};

/** Abbreviations seen in API names. */
const ABBREVIATIONS = { opp: 'opportunity', addr: 'address', affl: 'affiliation', acct: 'account', con: 'contact', rd: 'recurring donation', gau: 'gau', pmt: 'payment', mgmt: 'management', cfg: 'configuration' };

/** Words that never name an object. */
const STOPWORDS = new Set(('a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para pra com sem sob sobre ' +
  'e ou mas que se quando como onde qual quais quem cujo deve devem pode podem precisa precisam tem ter ser estar esta este esse essa isso ' +
  'nao sim ja mais menos muito pouco todo toda todos todas cada outro outra outros outras mesmo mesma ao aos a as ' +
  'the an of to in on for with without by from at as and or but if when which who that this these those is are be must should can ' +
  'not no yes all each every other same new old into onto').split(/\s+/));

/** Portuguese and English plural to singular (both kept, the caller tries each). */
function singulars(w) {
  const out = new Set([w]);
  if (w.length <= 3) return [...out];
  if (/oes$|aes$/.test(w)) out.add(w.replace(/(oes|aes)$/, 'ao'));
  if (/ais$/.test(w)) out.add(w.replace(/ais$/, 'al'));
  if (/eis$/.test(w)) out.add(w.replace(/eis$/, 'el'));
  if (/ns$/.test(w)) out.add(w.replace(/ns$/, 'm'));
  if (/(r|z|s)es$/.test(w)) out.add(w.replace(/es$/, ''));
  if (/ies$/.test(w)) out.add(w.replace(/ies$/, 'y'));
  if (/s$/.test(w) && !/ss$/.test(w)) out.add(w.replace(/s$/, ''));
  return [...out];
}

/** All the meanings of one written word: itself, its singular, and its translations. */
function meanings(word) {
  const out = new Set();
  for (const s of singulars(word)) {
    out.add(s);
    if (PT_EN[s]) for (const t of PT_EN[s].split(' ')) out.add(t);
    if (ABBREVIATIONS[s]) for (const t of ABBREVIATIONS[s].split(' ')) out.add(t);
  }
  return out;
}

module.exports = { PT_EN, ABBREVIATIONS, STOPWORDS, singulars, meanings };
