import {
  Activity,
  ChronologicalItem,
  Event,
  EventType,
  HistoryResponse,
  ParseOptions,
  Workflow,
  WorkflowResponse,
} from "./domain";
import { InternalServerError, NotFoundException } from "./excpetions";

export default class TemporalService {
  apiKey: string;
  endpoint: string;
  headers: Record<string, string>;
  constructor() {
    this.apiKey = process.env.TEMPORAL_API_KEY ?? "";
    this.endpoint = process.env.TEMPORAL_ENDPOINT ?? "";

    if (!this.apiKey) {
      throw new Error("Temporal API Key is required");
    }

    if (!this.endpoint) {
      throw new Error("Temporal Endpoint is required");
    }

    this.headers = {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async getRootWorkflowData(namespace: string, rootWorkflowId: string) {
    const historyResponse = await this.getWorkflowHistoryData(
      namespace,
      rootWorkflowId
    );
    const items = await this.parseTemporalHistory(historyResponse, namespace);

    // Get additional data for non-completed workflows
    for (const item of items) {
      if (
        (item.type === "workflow" || item.type === "childWorkflow") &&
        item.status !== "COMPLETED"
      ) {
        const workflowData = await this.getWorkflowData(
          namespace,
          item.workflowId
        );

        item.status = this.convertWorkflowStatusToStatus(
          workflowData.workflowExecutionInfo.status
        );
        item.startTime = workflowData.workflowExecutionInfo.startTime;
        item.endTime = workflowData.workflowExecutionInfo.closeTime;
        item.parentWorkflowId =
          workflowData.workflowExecutionInfo?.parentExecution?.workflowId;
        item.parentRunId =
          workflowData.workflowExecutionInfo?.parentExecution?.runId;
        if (workflowData.pendingActivities) {
          for (const pendingActivity of workflowData.pendingActivities) {
            const activityItem = items.find(
              (item) =>
                item.type === "activity" &&
                item.activityId === pendingActivity.activityId
            ) as Activity | undefined;

            if (activityItem) {
              activityItem.attempts = pendingActivity.attempt;
              if (activityItem.attempts > 1) {
                activityItem.status = "RETRYING";
              }
              if (activityItem.status == "SCHEDULED") {
                activityItem.status = "PENDING";
              }
              activityItem.lastStartedTime = pendingActivity.lastStartedTime;
              activityItem.lastAttemptCompleteTime =
                pendingActivity.lastAttemptCompleteTime;
              activityItem.lastWorkerIdentity =
                pendingActivity.lastWorkerIdentity;

              if (pendingActivity.lastFailure) {
                activityItem.lastFailure = JSON.stringify(
                  pendingActivity.lastFailure
                );
              }
            }
          }
        }
      }
    }

    return items;
  }

  private async getWorkflowData(
    namespace: string,
    workflowId: string
  ): Promise<WorkflowResponse> {
    const url = `https://${this.endpoint}.web.tmprl.cloud/api/v1/namespaces/${namespace}/workflows/${workflowId}`;
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundException(`workflow ${workflowId} not found`);
      }
      throw new InternalServerError(
        `Failed to fetch workflow data. Status: ${response.status}`
      );
    }

    return await response.json();
  }
  // TODO: add request without history to get pending activities
  private async getWorkflowHistoryData(namespace: string, workflowId: string) {
    const baseUrl = `https://${this.endpoint}.web.tmprl.cloud/api/v1/namespaces/${namespace}/workflows/${workflowId}/history?next_page_token=`;
    const allEvents = [];
    let nextPageToken = null;
    do {
      // encode nextPageToken with url encoding
      let url = nextPageToken
        ? baseUrl + encodeURIComponent(nextPageToken)
        : baseUrl;
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) {
        if (response.status === 404) {
          throw new NotFoundException(`workflow ${workflowId} not found`);
        }
        throw new InternalServerError(
          `Failed to fetch workflow history. Status: ${response.status}`
        );
      }
      const data = (await response.json()) as HistoryResponse;
      allEvents.push(...data.history.events);
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    return allEvents;
  }

  private parsePayloads(
    payloads?: { metadata?: Record<string, string>; data?: string }[]
  ): string | undefined {
    if (!payloads || payloads.length === 0) {
      return undefined;
    }

    // If single payload, return decoded string
    if (payloads.length === 1) {
      return payloads[0]?.data
        ? Buffer.from(payloads[0].data, "base64").toString()
        : "null";
    }

    // If multiple payloads, convert to JSON array string
    const decodedPayloads = payloads
      .map((payload) =>
        payload?.data
          ? Buffer.from(payload.data, "base64").toString()
          : "null"
      )
      .filter((payload): payload is string => payload !== undefined);

    return decodedPayloads.length > 0
      ? `[${decodedPayloads.join(", ")}]`
      : undefined;
  }

  private parseTemporalHistory(
    events: Event[],
    namespace: string
  ): ChronologicalItem[] {
    const chronologicalList: ChronologicalItem[] = [];

    const workflowMap: Record<string, Workflow> = {};
    const activityMap: Record<string, Activity> = {};
    // We'll track the currently active workflows. The top of the stack is the one to which activities are attributed.
    const workflowStack: string[] = [];

    for (const event of events) {
      switch (event.eventType) {
        case EventType.WORKFLOW_EXECUTION_STARTED: {
          const attrs = event.workflowExecutionStartedEventAttributes;
          if (attrs) {
            const wf: Workflow = {
              type: "workflow",
              workflowId: attrs.workflowId,
              runId: attrs.firstExecutionRunId,
              workflowType: attrs.workflowType.name,
              startTime: event.eventTime,
              status: "RUNNING",
              relatedEventIds: [event.eventId],
              input: this.parsePayloads(attrs.input?.payloads),
              header: attrs.header,
              attempts: attrs.attempt,
              searchAttributes: attrs.searchAttributes,
              memo: attrs.memo,
              taskQueue: attrs.taskQueue,
              namespace: namespace,
              parentWorkflowId: attrs.parentWorkflowExecution?.workflowId,
            };

            workflowMap[attrs.workflowId] = wf;
            chronologicalList.push(wf);
            workflowStack.push(attrs.workflowId);
          }
          break;
        }

        case EventType.WORKFLOW_EXECUTION_COMPLETED:
        case EventType.WORKFLOW_EXECUTION_FAILED:
        case EventType.WORKFLOW_EXECUTION_TIMED_OUT:
        case EventType.WORKFLOW_EXECUTION_CANCELED:
        case EventType.WORKFLOW_EXECUTION_TERMINATED: {
          // These are terminal states for the currently active workflow
          const topWorkflowId = workflowStack[workflowStack.length - 1];
          const wf = workflowMap[topWorkflowId];
          if (wf) {
            wf.endTime = event.eventTime;
            wf.relatedEventIds = wf.relatedEventIds || [];
            wf.relatedEventIds.push(event.eventId);
            wf.status = this.convertEventTypeToStatus(event.eventType);
          }
          workflowStack.pop();

          if (event.eventType === EventType.WORKFLOW_EXECUTION_COMPLETED) {
            wf.result = this.parsePayloads(
              event.workflowExecutionCompletedEventAttributes?.result?.payloads
            );
          }
          if (event.eventType === EventType.WORKFLOW_EXECUTION_FAILED) {
            wf.result = JSON.stringify(event.workflowExecutionFailedEventAttributes)
          }
          break;
        }

        case EventType.ACTIVITY_TASK_SCHEDULED: {
          const topWorkflowId = workflowStack[workflowStack.length - 1];
          const attrs = event.activityTaskScheduledEventAttributes;
          if (attrs && topWorkflowId) {
            const activityIdKey = `${topWorkflowId}:${attrs.activityId}`;
            const act: Activity = {
              type: "activity",
              activityId: attrs.activityId,
              activityType: attrs.activityType.name,
              workflowId: topWorkflowId,
              scheduleTime: event.eventTime,
              scheduleToCloseTimeout: attrs.scheduleToCloseTimeout,
              scheduleToStartTimeout: attrs.scheduleToStartTimeout,
              startToCloseTimeout: attrs.startToCloseTimeout,
              heartbeatTimeout: attrs.heartbeatTimeout,
              retryPolicy: attrs.retryPolicy,
              input: this.parsePayloads(attrs.input?.payloads),
              status: "SCHEDULED",
              relatedEventIds: [event.eventId],
              workflowTaskCompletedEventId: attrs.workflowTaskCompletedEventId,
            };
            activityMap[activityIdKey] = act;
            chronologicalList.push(act);
          }
          break;
        }

        case EventType.ACTIVITY_TASK_STARTED: {
          const attrs = event.activityTaskStartedEventAttributes;
          if (attrs) {
            const topWorkflowId = workflowStack[workflowStack.length - 1];
            // Find last scheduled activity without a startTime
            for (let i = chronologicalList.length - 1; i >= 0; i--) {
              const item = chronologicalList[i];
              if (
                item.type === "activity" &&
                item.workflowId === topWorkflowId
              ) {
                if (item.status === "SCHEDULED") {
                  item.status = "STARTED";
                }
                item.startTime = event.eventTime;
                item.relatedEventIds = item.relatedEventIds || [];
                item.relatedEventIds.push(event.eventId);

                if (event.activityTaskStartedEventAttributes?.lastFailure) {
                  item.lastFailure = JSON.stringify(
                    event.activityTaskStartedEventAttributes.lastFailure
                  );
                }
                break;
              }
            }
          }
          break;
        }

        case EventType.ACTIVITY_TASK_COMPLETED:
        case EventType.ACTIVITY_TASK_FAILED:
        case EventType.ACTIVITY_TASK_TIMED_OUT:
        case EventType.ACTIVITY_TASK_CANCELED: {
          const topWorkflowId = workflowStack[workflowStack.length - 1];

          for (let i = chronologicalList.length - 1; i >= 0; i--) {
            const item = chronologicalList[i];
            if (
              item.type === "activity" &&
              item.workflowId === topWorkflowId 
            ) {
              item.endTime = event.eventTime;
              item.status = this.convertEventTypeToStatus(event.eventType);
              item.relatedEventIds = item.relatedEventIds || [];
              item.relatedEventIds.push(event.eventId);

              if (
                event.eventType === EventType.ACTIVITY_TASK_COMPLETED &&
                event.activityTaskCompletedEventAttributes?.result?.payloads
              ) {
                item.result = this.parsePayloads(
                  event.activityTaskCompletedEventAttributes.result.payloads
                );
              }
              if (event.activityTaskFailedEventAttributes) {
                item.failure = JSON.stringify(
                  event.activityTaskFailedEventAttributes.failure
                );
              }
              break;
            }
          }
          break;
        }
        case EventType.CHILD_WORKFLOW_EXECUTION_COMPLETED: {
          const attrs = event.childWorkflowExecutionCompletedEventAttributes;
          if (attrs && attrs.workflowExecution) {
            const childWfId = attrs.workflowExecution.workflowId;

            const childWorkflow = workflowMap[childWfId];
            if (childWorkflow) {
              childWorkflow.endTime = event.eventTime;
              childWorkflow.status = "COMPLETED";
              childWorkflow.relatedEventIds =
                childWorkflow.relatedEventIds || [];
              childWorkflow.relatedEventIds.push(event.eventId);
            }
          }
          break;
        }
        case EventType.CHILD_WORKFLOW_EXECUTION_STARTED: {
          const attrs = event.childWorkflowExecutionStartedEventAttributes;
          if (attrs && attrs.workflowExecution) {
            const childWfId = attrs.workflowExecution.workflowId;
            const childRunId = attrs.workflowExecution.runId;

            if (childWfId in workflowMap) {
              // If the child workflow has already been started, update the existing entry
              const existingChildWorkflow = workflowMap[childWfId];
              existingChildWorkflow.startTime = event.eventTime;
              existingChildWorkflow.relatedEventIds =
                existingChildWorkflow.relatedEventIds || [];
              existingChildWorkflow.relatedEventIds.push(event.eventId);
            } else {
              const childWorkflow: Workflow = {
                type: "childWorkflow",
                workflowId: childWfId,
                runId: childRunId,
                startTime: event.eventTime,
                status: "RUNNING",
                parentWorkflowId: attrs.parentWorkflowExecution?.workflowId,
                parentRunId: attrs.parentWorkflowExecution?.runId,
                workflowType: attrs.workflowType?.name,
                relatedEventIds: [event.eventId],
                input: this.parsePayloads(attrs.input?.payloads),
                header: attrs.header,
                memo: attrs.memo,
                namespace: attrs.namespace,
                taskQueue: attrs.taskQueue,
                workflowRunTimeout: attrs.workflowRunTimeout,
                workflowTaskTimeout: attrs.workflowTaskTimeout,
                workflowReusePolicy: attrs.workflowReusePolicy,
              };

              workflowMap[childWfId] = childWorkflow;
              chronologicalList.push(childWorkflow);
              workflowStack.push(childWfId);
            }
          }
          break;
        }

        case EventType.START_CHILD_WORKFLOW_EXECUTION_INITIATED: {
          const attrs =
            event.startChildWorkflowExecutionInitiatedEventAttributes;
          if (attrs) {
            if (attrs.workflowId in workflowMap) {
              // If the child workflow has already been started, update the existing entry
              const existingChildWorkflow = workflowMap[attrs.workflowId];
              existingChildWorkflow.startTime = event.eventTime;
              existingChildWorkflow.relatedEventIds =
                existingChildWorkflow.relatedEventIds || [];
              existingChildWorkflow.relatedEventIds.push(event.eventId);
              existingChildWorkflow.workflowTaskCompletedEventId =
                attrs.workflowTaskCompletedEventId;
            } else {
              const currentWorkflowId = workflowStack[workflowStack.length - 1];
              const childWorkflow: Workflow = {
                type: "childWorkflow",
                workflowId: attrs.workflowId,
                startTime: event.eventTime,
                status: "INITIATED",
                parentWorkflowId: currentWorkflowId,
                workflowType: attrs.workflowType?.name,
                relatedEventIds: [event.eventId],
                workflowTaskCompletedEventId:
                  attrs.workflowTaskCompletedEventId,
                namespace: attrs.namespace,
                taskQueue: attrs.taskQueue,
                workflowRunTimeout: attrs.workflowRunTimeout,
                workflowTaskTimeout: attrs.workflowTaskTimeout,
                workflowReusePolicy: attrs.workflowReusePolicy,
              };

              workflowMap[attrs.workflowId] = childWorkflow;
              chronologicalList.push(childWorkflow);
            }
          }
          break;
        }

        default:
          break;
      }
    }

    return chronologicalList;
  }

  private convertEventTypeToStatus(status: string) {
    switch (status) {
      case "EVENT_TYPE_WORKFLOW_EXECUTION_STARTED":
      case "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_STARTED":
      case "EVENT_TYPE_ACTIVITY_TASK_STARTED":
        return "RUNNING";
      case "EVENT_TYPE_WORKFLOW_EXECUTION_COMPLETED":
      case "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_COMPLETED":
      case "EVENT_TYPE_ACTIVITY_TASK_COMPLETED":
        return "COMPLETED";
      case "EVENT_TYPE_WORKFLOW_EXECUTION_FAILED":
      case "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_FAILED":
      case "EVENT_TYPE_ACTIVITY_TASK_FAILED":
        return "FAILED";
      case "EVENT_TYPE_WORKFLOW_EXECUTION_TIMED_OUT":
      case "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_TIMED_OUT":
      case "EVENT_TYPE_ACTIVITY_TASK_TIMED_OUT":
        return "TIMED_OUT";
      case "EVENT_TYPE_WORKFLOW_EXECUTION_CANCELED":
      case "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_CANCELED":
      case "EVENT_TYPE_ACTIVITY_TASK_CANCELED":
        return "CANCELED";
      case "EVENT_TYPE_WORKFLOW_EXECUTION_TERMINATED":
      case "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_TERMINATED":
        return "TERMINATED";
      case "EVENT_TYPE_ACTIVITY_TASK_SCHEDULED":
        return "SCHEDULED";
      default:
        return status;
    }
  }

  private convertWorkflowStatusToStatus(status: string) {
    switch (status) {
      case "WORKFLOW_EXECUTION_STATUS_RUNNING":
        return "RUNNING";
      case "WORKFLOW_EXECUTION_STATUS_COMPLETED":
        return "COMPLETED";
      case "WORKFLOW_EXECUTION_STATUS_FAILED":
        return "FAILED";
      case "WORKFLOW_EXECUTION_STATUS_TIMED_OUT":
        return "TIMED_OUT";
      case "WORKFLOW_EXECUTION_STATUS_CANCELED":
        return "CANCELED";
      case "WORKFLOW_EXECUTION_STATUS_TERMINATED":
        return "TERMINATED";
      default:
        return status;
    }
  }
}
