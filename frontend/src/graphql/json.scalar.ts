import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';

function literalToJson(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
      try {
        return JSON.parse(ast.value);
      } catch {
        return ast.value;
      }
    case Kind.OBJECT: {
      const obj: Record<string, unknown> = {};
      for (const field of ast.fields) {
        obj[field.name.value] = literalToJson(field.value);
      }
      return obj;
    }
    case Kind.LIST:
      return ast.values.map((v) => literalToJson(v));
    case Kind.INT:
      return parseInt(ast.value, 10);
    case Kind.FLOAT:
      return parseFloat(ast.value);
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.NULL:
      return null;
    default:
      // Variables and other nodes are resolved before this point.
      return null;
  }
}

/**
 * island.is-style JSON scalar: carries GeoJSON features, the template
 * answers and any other structured payload through GraphQL without
 * modelling every field. Values pass through unchanged.
 */
export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description:
    'Arbitrary JSON value (GeoJSON features, template answers, ...)',
  serialize: (value: unknown): unknown => value,
  parseValue: (value: unknown): unknown => value,
  parseLiteral: (ast: ValueNode): unknown => literalToJson(ast),
});
