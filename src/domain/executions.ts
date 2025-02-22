export interface WorkflowExecution {
  workflowId: string;
  runId: string;
}

export interface WorkflowType {
  name: string;
}

export interface SearchAttributeValue {
  metadata: {
    encoding: string;
    type: string;
  };
  data: string;
}

export interface SearchAttributes {
  indexedFields: {
    [key: string]: SearchAttributeValue;
  };
}

export interface WorkflowExecutionInfo {
  execution: WorkflowExecution;
  type: WorkflowType;
  startTime: string;
  closeTime: string;
  status: string;
  historyLength: string;
  parentExecution?: WorkflowExecution;
  executionTime: string;
  memo: Record<string, any>;
  searchAttributes: SearchAttributes;
  taskQueue: string;
  stateTransitionCount: string;
  historySizeBytes: string;
  executionDuration: string;
  rootExecution: WorkflowExecution;
}

export interface SearchResponse {
  executions: WorkflowExecutionInfo[];
  nextPageToken?: string;
}
