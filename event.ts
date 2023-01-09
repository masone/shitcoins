import { client, v1 } from "@datadog/datadog-api-client";
const configuration = client.createConfiguration({
  authMethods: {
    apiKeyAuth: process.env.DATADOG_API_KEY,
  },
});
const apiInstance = new v1.EventsApi(configuration);

export async function sendEvent(title: string, tags: string[] = []) {
  const params: v1.EventsApiCreateEventRequest = {
    body: {
      title,
      text: title,
      tags,
    },
  };

  apiInstance.createEvent(params).catch((error: any) => console.error(error));
}
