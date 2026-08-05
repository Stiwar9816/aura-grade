import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { createGraphqlOperationLimitsRule } from './graphql-operation-limits.rule';

export const GRAPHQL_MAX_RECURSIVE_SELECTIONS = 250;

export const createGraphqlServerSecurityOptions = (isDevelopment: boolean) => ({
  csrfPrevention: true as const,
  introspection: isDevelopment,
  includeStacktraceInErrorResponses: isDevelopment,
  hideSchemaDetailsFromClientErrors: !isDevelopment,
  allowBatchedHttpRequests: false,
  maxRecursiveSelections: GRAPHQL_MAX_RECURSIVE_SELECTIONS,
  validationRules: [
    createGraphqlOperationLimitsRule({
      allowIntrospection: isDevelopment,
    }),
  ],
  plugins: [
    isDevelopment
      ? ApolloServerPluginLandingPageLocalDefault()
      : ApolloServerPluginLandingPageDisabled(),
  ],
});
