import {Activity, ChronologicalItem, HistoryResponse, ParseOptions, Workflow} from "./domain";


export class TemporalWorkflowChronologicalItems {
    rootWorkflow: ChronologicalItem[]
    childWorkflows: Record<string, ChronologicalItem[]>

    constructor(rootWorkflow: ChronologicalItem[], childWorkflows: Record<string, ChronologicalItem[]>) {
        this.rootWorkflow = rootWorkflow;
        this.childWorkflows = childWorkflows;
    }
}

export default class TemporalService {

    apiKey: string
    endpoint: string

    constructor() {
        this.apiKey = process.env.TEMPORAL_API_KEY ?? ""
        this.endpoint = process.env.TEMPORAL_ENDPOINT ?? ""

        if (!this.apiKey) {
            throw new Error("Temporal API Key is required")
        }

        if (!this.endpoint) {
            throw new Error("Temporal Endpoint is required")
        }
    }

    async getRootWorkflowData(namespace: string, rootWorkflowId: string) {
        const historyResponse = await this.getWorkflowData(namespace, rootWorkflowId);

        const childWorkflowsMap: Record<string, ChronologicalItem[]> = {};
        const rootWorkflowChronologicalItems = this.parseTemporalHistory(historyResponse);

        for (const item of rootWorkflowChronologicalItems) {
            if (item.type === 'childWorkflow') {
                const childWorkflowId = item.workflowId;
                const childWorkflowHistoryResponse = await this.getWorkflowData(namespace, childWorkflowId);
                childWorkflowsMap[childWorkflowId] = this.parseTemporalHistory(childWorkflowHistoryResponse);
            }
        }

        return new TemporalWorkflowChronologicalItems(rootWorkflowChronologicalItems, childWorkflowsMap);
    }

    private async getWorkflowData(namespace: string, workflowId: string) {
        const url = `https://${this.endpoint}.web.tmprl.cloud/api/v1/namespaces/${namespace}/workflows/${workflowId}/history`

        const response =  await fetch(url, {headers: {"Authorization": `Bearer ${this.apiKey}`}})
        if (!response.ok) {
            throw new Error(`Failed to fetch workflow history. Status: ${response.status}`);
        }

        return await response.json() as HistoryResponse;
    }

    parseTemporalHistory(data: HistoryResponse, options?: ParseOptions): ChronologicalItem[] {
        const events = data.history.events;

        const chronologicalList: ChronologicalItem[] = [];

        // Maps
        const workflowMap: Record<string, Workflow> = {};
        // We'll key workflows by their workflowId, but be mindful that runId might also be needed if multiple runs.
        // For simplicity, assume workflowId is unique or we can store `workflowId#runId` as key.

        const activityMap: Record<string, Activity> = {};
        // Key activity by a combination of workflowId + activityId to ensure uniqueness if multiple workflows appear.
        // We'll store them as `${workflowId}:${activityId}`

        // For locating which workflow an event belongs to:
        // The given history might contain multiple workflows: main and children.
        // The main workflow is known from EVENT_TYPE_WORKFLOW_EXECUTION_STARTED (no parent).
        // Child workflows appear in CHILD_WORKFLOW_EXECUTION_STARTED events.
        //
        // However, a single combined history containing multiple workflows is unusual unless you're merging them yourself.
        // We'll assume `workflowId` known from start events. If not, you might need additional logic.

        // Track the currently "active" workflowId. The main history usually pertains to a single main workflow.
        // If multiple workflows appear, we rely on childWorkflowExecutionStartedEventAttributes.
        //
        // Actually, each event belongs to a single workflow execution's history. If we have multiple workflows,
        // we must know which workflow they belong to. In a single history, all events belong to one workflow execution
        // plus references to children. If we actually get children events inline,
        // `childWorkflowExecutionStartedEventAttributes` gives us the child's workflowId and runId.
        // We'll create a separate workflow object for that child and add it to the list.

        // For simplicity, assume all activity events belong to the main workflow unless preceded by child workflow start.
        // In real scenarios, you'd have separate histories per workflow.
        // Here, if we detect a child workflow started, we just add it. Activities triggered by the child should appear
        // after its start event. Without additional info, we can't differentiate easily. We'll assume:
        // - Activities belong to the most recently started workflow that hasn't ended (stack-based approach).
        // In a real scenario, you'd have runId/workflowId associated with each event. For now, let's simplify:

        // We'll keep a stack of "current workflow" contexts. The top of the stack is the current active workflow.
        const workflowStack: string[] = [];

        for (const event of events) {
            switch (event.eventType) {
                case 'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED': {
                    const attrs = event.workflowExecutionStartedEventAttributes;
                    if (attrs) {
                        const wf: Workflow = {
                            type: 'workflow',
                            workflowId: attrs.workflowId,
                            runId: attrs.firstExecutionRunId,
                            workflowType: attrs.workflowType.name,
                            startTime: event.eventTime,
                            status: 'RUNNING',
                            relatedEventIds: [event.eventId],
                        };
                        workflowMap[attrs.workflowId] = wf;
                        chronologicalList.push(wf);
                        workflowStack.push(attrs.workflowId);
                    }
                    break;
                }

                case 'EVENT_TYPE_WORKFLOW_EXECUTION_COMPLETED': {
                    const topWorkflowId = workflowStack[workflowStack.length - 1];
                    const wf = workflowMap[topWorkflowId];
                    if (wf) {
                        wf.status = 'COMPLETED';
                        wf.endTime = event.eventTime;
                        wf.relatedEventIds?.push(event.eventId);
                    }
                    // Pop the workflow since it's ended
                    workflowStack.pop();
                    break;
                }

                case 'EVENT_TYPE_WORKFLOW_EXECUTION_FAILED': {
                    const topWorkflowId = workflowStack[workflowStack.length - 1];
                    const wf = workflowMap[topWorkflowId];
                    if (wf) {
                        wf.status = 'FAILED';
                        wf.endTime = event.eventTime;
                        wf.relatedEventIds?.push(event.eventId);
                    }
                    workflowStack.pop();
                    break;
                }

                case 'EVENT_TYPE_WORKFLOW_EXECUTION_TIMED_OUT': {
                    const topWorkflowId = workflowStack[workflowStack.length - 1];
                    const wf = workflowMap[topWorkflowId];
                    if (wf) {
                        wf.status = 'TIMED_OUT';
                        wf.endTime = event.eventTime;
                        wf.relatedEventIds?.push(event.eventId);
                    }
                    workflowStack.pop();
                    break;
                }

                case 'EVENT_TYPE_WORKFLOW_EXECUTION_CANCELED': {
                    const topWorkflowId = workflowStack[workflowStack.length - 1];
                    const wf = workflowMap[topWorkflowId];
                    if (wf) {
                        wf.status = 'CANCELED';
                        wf.endTime = event.eventTime;
                        wf.relatedEventIds?.push(event.eventId);
                    }
                    workflowStack.pop();
                    break;
                }

                case 'EVENT_TYPE_WORKFLOW_EXECUTION_TERMINATED': {
                    const topWorkflowId = workflowStack[workflowStack.length - 1];
                    const wf = workflowMap[topWorkflowId];
                    if (wf) {
                        wf.status = 'TERMINATED';
                        wf.endTime = event.eventTime;
                        wf.relatedEventIds?.push(event.eventId);
                    }
                    workflowStack.pop();
                    break;
                }

                case 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED': {
                    // Create an activity object and put it into the chronological list.
                    const topWorkflowId = workflowStack[workflowStack.length - 1];
                    const attrs = event.activityTaskScheduledEventAttributes;
                    if (attrs && topWorkflowId) {
                        const activityId = `${topWorkflowId}:${attrs.activityId}`;
                        const act: Activity = {
                            type: 'activity',
                            activityId: attrs.activityId,
                            activityType: attrs.activityType.name,
                            workflowId: topWorkflowId,
                            scheduleTime: event.eventTime,
                            status: 'SCHEDULED',
                            relatedEventIds: [event.eventId],
                        };
                        activityMap[activityId] = act;
                        chronologicalList.push(act);
                    }
                    break;
                }

                case 'EVENT_TYPE_ACTIVITY_TASK_STARTED': {
                    const attrs = event.activityTaskStartedEventAttributes;
                    if (attrs) {
                        // We only know scheduledEventId. We must find which activity that corresponds to.
                        // In a complete solution, you'd map eventIds to activityIds. For simplicity:
                        // We'll scan backwards through chronologicalList to find the last scheduled activity with no startTime.
                        // This is a simplification. Ideally, maintain a map from eventId->activityId at schedule time.
                        const topWorkflowId = workflowStack[workflowStack.length - 1];
                        // We'll do a quick search from the end:
                        for (let i = chronologicalList.length - 1; i >= 0; i--) {
                            const item = chronologicalList[i];
                            if (item.type === 'activity' && item.workflowId === topWorkflowId && item.status === 'SCHEDULED') {
                                item.startTime = event.eventTime;
                                item.status = 'STARTED';
                                item.relatedEventIds?.push(event.eventId);
                                break;
                            }
                        }
                    }
                    break;
                }

                case 'EVENT_TYPE_ACTIVITY_TASK_COMPLETED':
                case 'EVENT_TYPE_ACTIVITY_TASK_FAILED':
                case 'EVENT_TYPE_ACTIVITY_TASK_TIMED_OUT':
                case 'EVENT_TYPE_ACTIVITY_TASK_CANCELED': {
                    const topWorkflowId = workflowStack[workflowStack.length - 1];
                    // Similar to started, we find the last "in-progress" activity and update it.
                    // For a robust solution, you'd store a map of scheduledEventId to activityId when scheduled.
                    let status: string;
                    if (event.eventType === 'EVENT_TYPE_ACTIVITY_TASK_COMPLETED') {
                        status = 'COMPLETED';
                    } else if (event.eventType === 'EVENT_TYPE_ACTIVITY_TASK_FAILED') {
                        status = 'FAILED';
                    } else if (event.eventType === 'EVENT_TYPE_ACTIVITY_TASK_TIMED_OUT') {
                        status = 'TIMED_OUT';
                    } else {
                        status = 'CANCELED';
                    }

                    for (let i = chronologicalList.length - 1; i >= 0; i--) {
                        const item = chronologicalList[i];
                        if (item.type === 'activity' && item.workflowId === topWorkflowId && (item.status === 'STARTED' || item.status === 'SCHEDULED')) {
                            item.endTime = event.eventTime;
                            item.status = status;
                            item.relatedEventIds?.push(event.eventId);

                            // If completed and has result, store it
                            if (status === 'COMPLETED' && event.activityTaskCompletedEventAttributes?.result?.payloads) {
                                item.resultPayload = event.activityTaskCompletedEventAttributes.result.payloads;
                            }
                            break;
                        }
                    }
                    break;
                }

                case 'EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_STARTED': {
                    const attrs = event.childWorkflowExecutionStartedEventAttributes;
                    if (attrs && attrs.workflowExecution) {
                        const childWfId = attrs.workflowExecution.workflowId;
                        const childRunId = attrs.workflowExecution.runId;

                        const childWorkflow: Workflow = {
                            type: 'childWorkflow',
                            workflowId: childWfId,
                            runId: childRunId,
                            startTime: event.eventTime,
                            status: 'RUNNING',
                            // If parent info is available
                            parentWorkflowId: attrs.parentWorkflowExecution?.workflowId,
                            parentRunId: attrs.parentWorkflowExecution?.runId,
                            // We might not know the workflowType name from this event or it might be provided in attributes
                            workflowType: attrs.workflowType?.name,
                            relatedEventIds: [event.eventId],
                        };

                        workflowMap[childWfId] = childWorkflow;
                        chronologicalList.push(childWorkflow);
                        workflowStack.push(childWfId);
                    }
                    break;
                }

                default:
                    // Ignore other events for now
                    break;
            }
        }

        return chronologicalList;
    }


}


