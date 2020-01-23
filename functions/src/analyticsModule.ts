import appInsights = require('applicationinsights');

let isInsightsInitialized = false;

export function initAppInsights(apiKey: string) {
  appInsights.setup(apiKey).start();
  isInsightsInitialized = true;

  appInsights.defaultClient.commonProperties = {
    environment: 'DEVELOPMENT'
  };
}

export function trackMetric(name: string, value: number) {
  console.log(`analytics track metric => name: ${name}, value ${value}`);

  if (isInsightsInitialized) {
    appInsights.defaultClient.trackMetric({ name: name, value: value });
  }
}

export function trackEvent(name: string, properties: any) {
  console.log(`analytics track event => name: ${name}, value ${JSON.stringify(properties)}`);

  if (isInsightsInitialized) {
    appInsights.defaultClient.trackEvent({ name: name, properties: properties });
  }
}
