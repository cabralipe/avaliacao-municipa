export type Role = 'superadmin' | 'admin' | 'professor';

export interface Secretaria {
  id: number;
  nome: string;
  cnpj: string;
  cidade: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  secretaria: Secretaria | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Escola {
  id: number;
  secretaria: number;
  nome: string;
  codigo_inep: string;
}

export interface Turma {
  id: number;
  secretaria: number;
  escola: number;
  nome: string;
  ano: string;
}

export interface Aluno {
  id: number;
  secretaria: number;
  turma: number;
  nome: string;
  cpf: string;
}

export interface Competencia {
  id: number;
  secretaria: number | null;
  codigo: string;
  descricao: string;
}

export interface Habilidade {
  id: number;
  secretaria: number | null;
  codigo: string;
  descricao: string;
}

export interface Questao {
  id: number;
  secretaria: number | null;
  enunciado: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c: string;
  alternativa_d: string;
  alternativa_e: string;
  correta: 'A' | 'B' | 'C' | 'D' | 'E';
  competencia: number | null;
  habilidade: number | null;
  status: 'pendente' | 'aprovada';
}

export interface Avaliacao {
  id: number;
  secretaria: number;
  titulo: string;
  data_aplicacao: string;
  turmas: number[];
  liberada_para_professores: boolean;
  habilitar_correcao_qr: boolean;
}

export interface Caderno {
  id: number;
  secretaria: number;
  avaliacao: number;
  codigo: string;
}

export interface CadernoQuestao {
  id: number;
  caderno: number;
  questao: number;
  ordem: number;
}

export interface ProvaAluno {
  id: number;
  secretaria: number;
  avaliacao: number;
  aluno: number;
  caderno: number | null;
  qr_payload: Record<string, unknown>;
}

export interface Resposta {
  id: number;
  secretaria: number;
  prova_aluno: number;
  caderno_questao: number;
  alternativa: string;
  correta: boolean | null;
}

export interface Gabarito {
  id: number;
  secretaria: number;
  caderno_questao: number;
  alternativa_correta: string;
}
