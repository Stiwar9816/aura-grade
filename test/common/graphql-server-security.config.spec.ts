import { ApolloServer } from '@apollo/server';
import { createGraphqlServerSecurityOptions } from 'src/common/graphql';

describe('GraphQL server security configuration', () => {
  it('disables production introspection, stack traces and batched requests', async () => {
    const securityOptions = createGraphqlServerSecurityOptions(false);
    const server = new ApolloServer({
      typeDefs: 'type Query { ping: String }',
      resolvers: { Query: { ping: () => 'pong' } },
      ...securityOptions,
    });

    const response = await server.executeOperation({
      query: 'query IntrospectionProbe { __schema { queryType { name } } }',
    });
    await server.stop();

    expect(securityOptions).toEqual(
      expect.objectContaining({
        csrfPrevention: true,
        introspection: false,
        includeStacktraceInErrorResponses: false,
        hideSchemaDetailsFromClientErrors: true,
        allowBatchedHttpRequests: false,
        maxRecursiveSelections: 250,
      })
    );
    expect(response.body.kind).toBe('single');
    if (response.body.kind !== 'single') throw new Error('Respuesta incremental inesperada.');
    expect(response.body.singleResult.errors?.[0].message).toContain(
      'GraphQL introspection is not allowed'
    );
  });

  it('keeps introspection available only for local development tooling', async () => {
    const securityOptions = createGraphqlServerSecurityOptions(true);
    const server = new ApolloServer({
      typeDefs: 'type Query { ping: String }',
      resolvers: { Query: { ping: () => 'pong' } },
      ...securityOptions,
    });

    const response = await server.executeOperation({
      query: 'query IntrospectionProbe { __schema { queryType { name } } }',
    });
    await server.stop();

    expect(response.body.kind).toBe('single');
    if (response.body.kind !== 'single') throw new Error('Respuesta incremental inesperada.');
    expect(response.body.singleResult.errors).toBeUndefined();
    expect(response.body.singleResult.data).toEqual({
      __schema: { queryType: { name: 'Query' } },
    });
  });

  it('rejects operations above the recursive selection budget', async () => {
    const server = new ApolloServer({
      typeDefs: 'type Query { ping: String }',
      resolvers: { Query: { ping: () => 'pong' } },
      ...createGraphqlServerSecurityOptions(false),
    });
    const selections = Array.from({ length: 251 }, () => 'ping').join('\n');

    const response = await server.executeOperation({
      query: `query ExcessiveSelections { ${selections} }`,
    });
    await server.stop();

    expect(response.body.kind).toBe('single');
    if (response.body.kind !== 'single') throw new Error('Respuesta incremental inesperada.');
    expect(response.body.singleResult.errors?.[0].extensions).toEqual(
      expect.objectContaining({
        validationErrorCode: 'MAX_RECURSIVE_SELECTIONS_EXCEEDED',
      })
    );
  });
});
