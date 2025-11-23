export enum DiagramType {
  SEQUENCE = 'sequence',
  USECASE = 'usecase',
  CLASS = 'class',
  ACTIVITY = 'activity',
  COMPONENT = 'component',
  STATE = 'state',
  MINDMAP = 'mindmap',
  GANTT = 'gantt'
}

export interface CodeState {
  code: string;
  isLoading: boolean;
}

export interface GeneratedImage {
  url: string;
  error?: string;
}
