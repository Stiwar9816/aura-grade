import { buildSchema, parse, validate } from 'graphql';
import { createGraphqlOperationLimitsRule } from 'src/common/graphql';

describe('GraphQL operation limits rule', () => {
  const schema = buildSchema(`
    type Query {
      ping: String
      root: Node
    }

    type Node {
      value: String
      child: Node
    }
  `);

  const validateQuery = (source: string, limits = {}) =>
    validate(schema, parse(source), [createGraphqlOperationLimitsRule(limits)]);

  it('accepts a normal application query', () => {
    const errors = validateQuery(`
      query NormalOperation {
        root {
          value
          child {
            value
          }
        }
      }
    `);

    expect(errors).toEqual([]);
  });

  it('rejects an operation deeper than the configured limit', () => {
    const errors = validateQuery(`query DeepOperation { root { child { child { value } } } }`, {
      maxDepth: 3,
    });

    expect(errors[0].extensions).toEqual(
      expect.objectContaining({
        code: 'GRAPHQL_OPERATION_LIMIT_EXCEEDED',
        limit: 'depth',
        maximum: 3,
        actual: 4,
      })
    );
  });

  it('rejects excessive aliases', () => {
    const errors = validateQuery(`query Aliases { first: ping second: ping third: ping }`, {
      maxAliases: 2,
    });

    expect(errors[0].extensions).toEqual(
      expect.objectContaining({ limit: 'aliases', maximum: 2, actual: 3 })
    );
  });

  it('counts every fragment expansion and rejects excessive spreads', () => {
    const errors = validateQuery(
      `
        query RepeatedFragments {
          root {
            ...NodeFields
            ...NodeFields
          }
        }
        fragment NodeFields on Node {
          value
        }
      `,
      { maxFragmentSpreads: 1 }
    );

    expect(errors[0].extensions).toEqual(
      expect.objectContaining({ limit: 'fragmentSpreads', maximum: 1, actual: 2 })
    );
  });

  it('rejects documents containing multiple operations', () => {
    const errors = validateQuery(`query First { ping } query Second { ping }`);

    expect(errors[0].extensions).toEqual(
      expect.objectContaining({ limit: 'operations', maximum: 1, actual: 2 })
    );
  });

  it('can exempt a development introspection operation from custom depth limits', () => {
    const errors = validateQuery(
      `query Introspection { __schema { types { fields { type { name } } } } }`,
      {
        maxDepth: 1,
        allowIntrospection: true,
      }
    );

    expect(errors).toEqual([]);
  });
});
