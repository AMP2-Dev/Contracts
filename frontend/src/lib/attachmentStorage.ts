import type { Project, AnexoAdicional } from '../types/database';

const DB_NAME = 'amp_contracts_storage';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Salva um anexo grande (PDF ou imagem Base64) no IndexedDB
 */
export async function saveAttachment(projectId: string, fieldKey: string, b64Data: string): Promise<void> {
  if (!projectId || !fieldKey || !b64Data) return;
  try {
    const db = await getDb();
    const key = `${projectId}_${fieldKey}`;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(b64Data, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[attachmentStorage] Erro ao gravar anexo no IndexedDB:', err);
  }
}

/**
 * Recupera um anexo grande do IndexedDB
 */
export async function getAttachment(projectId: string, fieldKey: string): Promise<string | null> {
  if (!projectId || !fieldKey) return null;
  try {
    const db = await getDb();
    const key = `${projectId}_${fieldKey}`;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('[attachmentStorage] Erro ao ler anexo do IndexedDB:', err);
    return null;
  }
}

/**
 * Remove um anexo do IndexedDB
 */
export async function deleteAttachment(projectId: string, fieldKey: string): Promise<void> {
  if (!projectId || !fieldKey) return;
  try {
    const db = await getDb();
    const key = `${projectId}_${fieldKey}`;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[attachmentStorage] Erro ao deletar anexo do IndexedDB:', err);
  }
}

/**
 * Salva todos os binários pesados de um projeto no IndexedDB
 */
export async function saveProjectAttachmentsToIdb(project: Project): Promise<void> {
  if (!project || !project.id || !project.dados_extra) return;
  const { id, dados_extra } = project;

  if (dados_extra.termo_assinado_b64) {
    await saveAttachment(id, 'termo_assinado_b64', dados_extra.termo_assinado_b64);
  }
  if (dados_extra.nota_fiscal_b64) {
    await saveAttachment(id, 'nota_fiscal_b64', dados_extra.nota_fiscal_b64);
  }
  if (dados_extra.foto_cliente) {
    await saveAttachment(id, 'foto_cliente', dados_extra.foto_cliente);
  }
  if (Array.isArray(dados_extra.anexos_adicionais)) {
    for (const anx of dados_extra.anexos_adicionais) {
      if (anx && anx.id && anx.b64) {
        await saveAttachment(id, `anexo_${anx.id}`, anx.b64);
      }
    }
  }
}

/**
 * Hidrata os Base64 de um projeto a partir do IndexedDB se estiverem ausentes em memória
 */
export async function hydrateProjectFromIdb(project: Project): Promise<Project> {
  if (!project || !project.id) return project;
  const extra = { ...(project.dados_extra || {}) };
  let changed = false;

  if (!extra.termo_assinado_b64 && extra.termo_assinado_nome) {
    const b64 = await getAttachment(project.id, 'termo_assinado_b64');
    if (b64) {
      extra.termo_assinado_b64 = b64;
      changed = true;
    }
  }

  if (!extra.nota_fiscal_b64 && extra.nota_fiscal_nome) {
    const b64 = await getAttachment(project.id, 'nota_fiscal_b64');
    if (b64) {
      extra.nota_fiscal_b64 = b64;
      changed = true;
    }
  }

  if (!extra.foto_cliente) {
    const b64 = await getAttachment(project.id, 'foto_cliente');
    if (b64) {
      extra.foto_cliente = b64;
      changed = true;
    }
  }

  if (Array.isArray(extra.anexos_adicionais)) {
    const hydratedAnexos = await Promise.all(
      extra.anexos_adicionais.map(async (anx) => {
        if (!anx.b64 && anx.id) {
          const b64 = await getAttachment(project.id, `anexo_${anx.id}`);
          if (b64) {
            changed = true;
            return { ...anx, b64 };
          }
        }
        return anx;
      })
    );
    extra.anexos_adicionais = hydratedAnexos;
  }

  if (changed) {
    return { ...project, dados_extra: extra };
  }
  return project;
}

/**
 * Remove strings Base64 pesadas de um projeto para caber perfeitamente no localStorage (limite de 5MB)
 * Mantém 100% dos metadados (nome do arquivo, data, tamanho, id, etc.)
 */
export function sanitizeProjectForLocalStorage(project: Project): Project {
  if (!project) return project;
  const extra = project.dados_extra ? { ...project.dados_extra } : {};

  // Se houver Base64 maior que 2KB, remove do snapshot do localStorage
  if (typeof extra.termo_assinado_b64 === 'string' && extra.termo_assinado_b64.length > 2000) {
    delete extra.termo_assinado_b64;
  }
  if (typeof extra.nota_fiscal_b64 === 'string' && extra.nota_fiscal_b64.length > 2000) {
    delete extra.nota_fiscal_b64;
  }
  if (typeof extra.foto_cliente === 'string' && extra.foto_cliente.length > 5000) {
    delete extra.foto_cliente;
  }
  if (Array.isArray(extra.anexos_adicionais)) {
    extra.anexos_adicionais = extra.anexos_adicionais.map((anx) => {
      if (anx && typeof anx.b64 === 'string' && anx.b64.length > 2000) {
        return { ...anx, b64: '' };
      }
      return anx;
    });
  }

  return {
    ...project,
    dados_extra: extra,
  };
}

/**
 * Sanitiza a lista inteira de projetos para localStorage
 */
export function sanitizeProjectsForLocalStorage(projects: Project[]): Project[] {
  if (!Array.isArray(projects)) return [];
  return projects.map(sanitizeProjectForLocalStorage);
}

/**
 * Grava a lista de projetos no localStorage de forma 100% segura, protegida contra QuotaExceededError
 */
export function safeSaveProjectsToLocalStorage(projects: Project[]): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    const sanitized = sanitizeProjectsForLocalStorage(projects);
    const serialized = JSON.stringify(sanitized);
    localStorage.setItem('amp_projects', serialized);
    return true;
  } catch (err: any) {
    console.warn('[safeSaveProjectsToLocalStorage] Erro ao gravar amp_projects no localStorage:', err);
    // Se ainda assim der QuotaExceededError, tenta limpar chaves antigas não críticas
    try {
      localStorage.removeItem('amp_projects');
      const minimal = projects.map((p) => ({
        id: p.id,
        codigo_rae: p.codigo_rae,
        nome_cliente: p.nome_cliente,
        status: p.status,
        valor_consultoria: p.valor_consultoria,
      }));
      localStorage.setItem('amp_projects', JSON.stringify(minimal));
      return true;
    } catch (fallbackErr) {
      console.error('[safeSaveProjectsToLocalStorage] Fallback de emergência falhou:', fallbackErr);
      return false;
    }
  }
}
