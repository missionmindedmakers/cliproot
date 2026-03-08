type Simplify<T> = { [K in keyof T]: T[K] } & {};

type RequiredKeys<Schema> = Schema extends { required: readonly (infer Keys)[] }
  ? Extract<Keys, string>
  : never;

type ResolveRef<Root, Ref extends string> = Ref extends `#/$defs/${infer Name}`
  ? Root extends { $defs: Record<string, unknown> }
    ? Name extends keyof Root['$defs']
      ? Root['$defs'][Name]
      : never
    : never
  : never;

type ObjectFromProperties<
  Properties extends Record<string, unknown>,
  Required extends string,
  Root,
> = Simplify<
  {
    [K in keyof Properties & string as K extends Required ? K : never]-?: FromJsonSchema<
      Properties[K],
      Root
    >;
  } & {
    [K in keyof Properties & string as K extends Required ? never : K]?: FromJsonSchema<
      Properties[K],
      Root
    >;
  }
>;

export type FromJsonSchema<Schema, Root = Schema> = Schema extends {
  $ref: infer Ref extends string;
}
  ? FromJsonSchema<ResolveRef<Root, Ref>, Root>
  : Schema extends { const: infer ConstValue }
    ? ConstValue
    : Schema extends { enum: readonly (infer EnumValue)[] }
      ? EnumValue
      : Schema extends { type: 'string' }
        ? string
        : Schema extends { type: 'integer' | 'number' }
          ? number
          : Schema extends { type: 'boolean' }
            ? boolean
            : Schema extends { type: 'array'; items: infer ItemSchema }
              ? FromJsonSchema<ItemSchema, Root>[]
              : Schema extends {
                    type: 'object';
                    properties: infer Properties extends Record<string, unknown>;
                  }
                ? ObjectFromProperties<Properties, RequiredKeys<Schema>, Root>
                : unknown;
