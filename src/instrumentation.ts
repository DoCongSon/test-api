import * as appInsights from 'applicationinsights';
import { logger } from './lib/logger';
import { appConfig } from './config/env';

// Biến client để các file khác dùng
export let aiClient: appInsights.TelemetryClient | undefined;

if (appConfig.appInsightsConnectionString) {
  appInsights
    .setup(appConfig.appInsightsConnectionString)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true)
    .start();

  aiClient = appInsights.defaultClient;

  logger.info('Azure Application Insights started');
}
