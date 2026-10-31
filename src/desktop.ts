export type DocumentRecord = {
  id: string; title: string; original_name: string; bytes: number; pages: number;
  category: string; favorite: number; status: 'unread' | 'reading' | 'done';
  page: number; offset: number; zoom: string; imported_at: string; last_opened: string | null;
};
export type DocumentChange = Partial<Pick<DocumentRecord, 'title' | 'category' | 'favorite' | 'status' | 'page' | 'offset' | 'zoom'>> & { last_opened?: true };
export type DataInfo = { directory: string; version: string; electron: string; node: string };
export interface DesktopBridge {
  annotationList(id:string):Promise<AnnotationState>;
  annotationSave(id:string,input:{id?:string;turn_id?:string;fragments?:SelectionFragment[];color:string;note:string}):Promise<AnnotationState>;
  annotationDelete(id:string,note:string):Promise<AnnotationState>;
  annotationAsk(id:string,input:{mode?:'paper-chat';contextMode?:'standard'|'whole';focus?:ChatFocus|null;question:string;fragments?:SelectionFragment[];retry?:string}):Promise<string>;
  annotationCancel(id:string,turn:string):Promise<void>;
  annotationExport(id:string):Promise<boolean>;
  modelConfig(): Promise<ModelConfig>;
  saveModelConfig(input: ModelConfig): Promise<ModelConfig>;
  detectCLI(): Promise<string>;
  snapshot(id: string): Promise<Analysis>;
  saveParse(id: string, payload: { version: string; pages: import('./bilingual/presentation').ReadingPage[] }): Promise<Analysis>;
  savePageImage(id: string, page: number, image: string): Promise<void>;
  saveContentPosition(id: string, block: string | null, mode: ReadingMode, offset?: number): Promise<void>;
  startTranslation(id: string, range: { type: 'block' | 'page' | 'all'; page: number; blockID?: string; pipeline?: 'pages-1' | 'pages-2' | 'pages-3'; refine?: boolean }): Promise<string>;
  resumeTranslation(job: string): Promise<void>;
  stopTranslation(job: string, cancel?: boolean): Promise<void>;
  list(): Promise<DocumentRecord[]>;
  choose(): Promise<string[]>;
  stage(path: string): Promise<{ duplicate?: DocumentRecord; token?: string; data?: Uint8Array; name?: string }>;
  commit(token: string, metadata: { pages: number; title: string }): Promise<DocumentRecord>;
  discard(token: string): Promise<void>;
  read(id: string): Promise<Uint8Array>;
  update(id: string, change: DocumentChange): Promise<DocumentRecord>;
  info(): Promise<DataInfo>;
  showData(): Promise<string>;
  pathForFile(file: File): string;
  onClosing(callback: () => void): () => void;
  finishClose(success: boolean): Promise<void>;
}
declare global { interface Window { reader?: DesktopBridge } }
export type ReadingMode = 'original' | 'dual' | 'focus';
export type ModelConfig = { provider: 'api' | 'codex'; model: string; baseURL: string; executable: string; hasKey?: boolean; key?: string; clearKey?: boolean; vision?: boolean; workflow?: string };
export type ContentBlock = import('./bilingual/presentation').VisualBlock & { id: string; source_hash: string; translation?: string; semanticType?: string; location?: string; alignment?: {source:string;translation:string}[]; latex?: string; equation_number?: string; continues_previous?: boolean };
export type Analysis = {
  assets: number[];
  reading: {version:string;job_id:string;pages:{page:number;blocks:ContentBlock[];warnings:string[]}[];blocks:ContentBlock[];glossary:{source:string;translation:string}[]}|null;
  parse: { id: string; version: string; pages: { page: number; layout: string; warning: string; presentation_version?: string; blocks: ContentBlock[] }[] } | null;
  translations: { cache_key: string; block_id: string; source_hash: string; provider: string; model: string; target: string; prompt_version: string; text: string; created_at: string }[];
  jobs: { id: string; parse_id: string; state: string; provider_key: string; provider: ModelConfig; created_at: string; items: { block_id: string; state: string; error: string }[] }[];
  position: { block_id: string | null; mode: ReadingMode; offset: number };
};

export type AnnotationContext={source_mode?:'paper';block_id:string;side:'en'|'zh';language:'en'|'zh';full:string;version:string;parse_id:string;page:number;source_order?:number;regions:import('./bilingual/parser').Region[];source_hash:string;original:string};
export type SelectionFragment=AnnotationContext&{start:number;end:number;quote:string;prefix?:string;suffix?:string;segments?:number[]|null;status?:'exact'|'review';current_block?:string|null};
export type CitationSource=AnnotationContext&{id:string;document_id:string;role:string;content:string};
export type QATurn={mode?:'paper-chat';scope?:PaperScope;id:string;document_id:string;question:string;fragments:SelectionFragment[];sources:CitationSource[];state:'running'|'failed'|'cancelled'|'completed';answer:string;citations:{source_id:string;document_id:string}[];error:string;provider:string;model:string;created_at:string};
export type Annotation={id:string;document_id:string;kind:'ai'|'user';note:string;color:'yellow'|'green'|'pink';fragments:SelectionFragment[];created_at:string;updated_at:string;ai?:Pick<QATurn,'question'|'answer'|'citations'|'sources'|'provider'|'model'>&{turn_id:string}};
export type ChatFocus={block_id?:string;page:number;parse_id?:string|null;side?:'en'|'zh'};
export type PaperSummary={title:string;parse_id:string|null;totalPages:number;textPages:number;missingPages:number[];blocks:number};
export type PaperScope=PaperSummary&{contextMode?:'standard'|'whole';focus?:{page:number;block_id:string;kind:'paragraph'|'page';origin?:string}|null;chapter?:string;kind:'reading-context'|'full-text'|'partial-text';providedBlocks:number;totalBlocks:number;providedCharacters:number;historyUsed:number;historyTotal:number;attached:number};
export type AnnotationState={paper?:PaperSummary;contexts:AnnotationContext[];notes:Annotation[];turns:QATurn[]};
