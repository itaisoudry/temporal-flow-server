import fetch from 'node-fetch';
import {HistoryResponse, Event} from "./domain";
export interface FormattedResult {
    completedTasks: Record<string, Event[]>;
    additionalEvents: Record<string, Event[]>;
}

export default class Temporal {
    apiKey: string
    endpoint: string
    constructor() {
        this.apiKey = process.env.TEMPORAL_API_KEY ?? ""
        this.endpoint = process.env.TEMPORAL_ENDPOINT ?? ""

        if (!this.apiKey) {
            throw new Error("Temporal API Key is required")
        }

        if(!this.endpoint) {
            throw new Error("Temporal Endpoint is required")
        }
    }

    async getWorkflowData(namespace:string, workflowId: string) {
        const url = `https://${this.endpoint}.web.tmprl.cloud/api/v1/namespaces/${namespace}/workflows/${workflowId}/history`

        const response = await fetch(url, {headers:{"Authorization": `Bearer ${this.apiKey}`}})
        if (!response.ok) {
            throw new Error(`Failed to fetch workflow history. Status: ${response.status}`);
        }

        const data = await response.json() as HistoryResponse;
        return this.formatWorkflowData(data);
    }

    private formatWorkflowData(historyResponse: HistoryResponse): FormattedResult {
        const completedTasks: Record<string, Event[]> = {};
        const additionalEvents: Record<string, Event[]> = {};

        for (const event of historyResponse.history.events) {
            const workflowTaskCompletedEventId = this.getWorkflowTaskCompletedEventId(event);

            if (workflowTaskCompletedEventId) {
                // Place in completedTasks under the workflowTaskCompletedEventId
                if (!completedTasks[workflowTaskCompletedEventId]) {
                    completedTasks[workflowTaskCompletedEventId] = [];
                }
                completedTasks[workflowTaskCompletedEventId].push(event);
            } else {
                // Place in additionalEvents under the event type
                const eventTypeKey = event.eventType;
                if (!additionalEvents[eventTypeKey]) {
                    additionalEvents[eventTypeKey] = [];
                }
                additionalEvents[eventTypeKey].push(event);
            }
        }

        // Sort the lists by eventId numerically
        for (const key in completedTasks) {
            completedTasks[key].sort((a, b) => Number(a.eventId) - Number(b.eventId));
        }

        for (const key in additionalEvents) {
            additionalEvents[key].sort((a, b) => Number(a.eventId) - Number(b.eventId));
        }

        return {
            completedTasks,
            additionalEvents,
        };
    }

    private getWorkflowTaskCompletedEventId(event: Event): string | undefined {
        // Check activityTaskScheduledEventAttributes
        if (event.activityTaskScheduledEventAttributes?.workflowTaskCompletedEventId) {
            return event.activityTaskScheduledEventAttributes.workflowTaskCompletedEventId;
        }

        // Check workflowExecutionCompletedEventAttributes
        if (event.workflowExecutionCompletedEventAttributes?.workflowTaskCompletedEventId) {
            return event.workflowExecutionCompletedEventAttributes.workflowTaskCompletedEventId;
        }

        return undefined;
    }
}

