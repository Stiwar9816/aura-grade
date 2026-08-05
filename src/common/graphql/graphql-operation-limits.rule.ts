import {
  ASTNode,
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLError,
  Kind,
  OperationDefinitionNode,
  SelectionSetNode,
  ValidationContext,
  ValidationRule,
} from 'graphql';

export type GraphqlOperationLimits = {
  maxDepth: number;
  maxAliases: number;
  maxFragmentSpreads: number;
  maxFragments: number;
  maxDirectives: number;
  maxOperations: number;
  allowIntrospection: boolean;
};

export const DEFAULT_GRAPHQL_OPERATION_LIMITS: GraphqlOperationLimits = {
  maxDepth: 10,
  maxAliases: 20,
  maxFragmentSpreads: 25,
  maxFragments: 20,
  maxDirectives: 30,
  maxOperations: 1,
  allowIntrospection: false,
};

type OperationMetrics = {
  depth: number;
  aliases: number;
  fragmentSpreads: number;
  directives: number;
};

export const createGraphqlOperationLimitsRule = (
  overrides: Partial<GraphqlOperationLimits> = {}
): ValidationRule => {
  const limits = { ...DEFAULT_GRAPHQL_OPERATION_LIMITS, ...overrides };

  return (context: ValidationContext) => ({
    Document: {
      leave(document: DocumentNode) {
        const operations = document.definitions.filter(
          (definition): definition is OperationDefinitionNode =>
            definition.kind === Kind.OPERATION_DEFINITION
        );
        const fragments = new Map(
          document.definitions
            .filter(
              (definition): definition is FragmentDefinitionNode =>
                definition.kind === Kind.FRAGMENT_DEFINITION
            )
            .map((fragment) => [fragment.name.value, fragment])
        );

        reportLimit(context, document, 'operations', operations.length, limits.maxOperations);
        reportLimit(context, document, 'fragments', fragments.size, limits.maxFragments);

        for (const operation of operations) {
          if (limits.allowIntrospection && isIntrospectionOnly(operation)) continue;
          const metrics = analyzeOperation(operation, fragments);
          reportLimit(context, operation, 'depth', metrics.depth, limits.maxDepth);
          reportLimit(context, operation, 'aliases', metrics.aliases, limits.maxAliases);
          reportLimit(
            context,
            operation,
            'fragmentSpreads',
            metrics.fragmentSpreads,
            limits.maxFragmentSpreads
          );
          reportLimit(context, operation, 'directives', metrics.directives, limits.maxDirectives);
        }
      },
    },
  });
};

const analyzeOperation = (
  operation: OperationDefinitionNode,
  fragments: Map<string, FragmentDefinitionNode>
): OperationMetrics => {
  const metrics: OperationMetrics = {
    depth: 0,
    aliases: 0,
    fragmentSpreads: 0,
    directives: operation.directives?.length ?? 0,
  };

  analyzeSelectionSet(operation.selectionSet, 1, fragments, new Set(), metrics);
  return metrics;
};

const analyzeSelectionSet = (
  selectionSet: SelectionSetNode,
  depth: number,
  fragments: Map<string, FragmentDefinitionNode>,
  activeFragments: Set<string>,
  metrics: OperationMetrics
): void => {
  for (const selection of selectionSet.selections) {
    metrics.directives += selection.directives?.length ?? 0;

    if (selection.kind === Kind.FIELD) {
      metrics.depth = Math.max(metrics.depth, depth);
      if (selection.alias) metrics.aliases += 1;
      if (selection.selectionSet)
        analyzeSelectionSet(selection.selectionSet, depth + 1, fragments, activeFragments, metrics);
      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      analyzeSelectionSet(selection.selectionSet, depth, fragments, activeFragments, metrics);
      continue;
    }

    metrics.fragmentSpreads += 1;
    const fragmentName = selection.name.value;
    const fragment = fragments.get(fragmentName);
    if (!fragment || activeFragments.has(fragmentName)) continue;

    const nextActiveFragments = new Set(activeFragments).add(fragmentName);
    metrics.directives += fragment.directives?.length ?? 0;
    analyzeSelectionSet(fragment.selectionSet, depth, fragments, nextActiveFragments, metrics);
  }
};

const isIntrospectionOnly = (operation: OperationDefinitionNode): boolean =>
  operation.selectionSet.selections.length > 0 &&
  operation.selectionSet.selections.every(
    (selection) => selection.kind === Kind.FIELD && selection.name.value.startsWith('__')
  );

const reportLimit = (
  context: ValidationContext,
  node: ASTNode,
  limit: string,
  actual: number,
  maximum: number
): void => {
  if (actual <= maximum) return;
  context.reportError(
    new GraphQLError(`La operación GraphQL excede el límite permitido de ${limit}.`, {
      nodes: node,
      extensions: {
        code: 'GRAPHQL_OPERATION_LIMIT_EXCEEDED',
        limit,
        maximum,
        actual,
      },
    })
  );
};
